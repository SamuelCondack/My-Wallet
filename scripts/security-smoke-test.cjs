/**
 * Live security smoke tests against the Firebase project from .env.
 * Usage: node scripts/security-smoke-test.cjs
 */
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const { initializeApp } = require("firebase/app");
const { getAuth, signInWithCustomToken, signOut } = require("firebase/auth");
const { getFirestore, doc, setDoc, deleteDoc } = require("firebase/firestore");
const {
  resolveAppRedirectUrl,
  getAppOrigin,
} = require("../netlify/functions/_shared/stripe.cjs");

function loadEnv(filePath) {
  const env = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function normalizePrivateKey(raw) {
  let key = String(raw || "").trim();
  for (let i = 0; i < 8; i += 1) {
    if (!key.includes("\\n")) break;
    key = key.split("\\n").join("\n");
  }
  const begin = "-----BEGIN PRIVATE KEY-----";
  const end = "-----END PRIVATE KEY-----";
  const body = key.replace(begin, "").replace(end, "").replace(/\s+/g, "");
  const wrapped = body.match(/.{1,64}/g) || [];
  return `${begin}\n${wrapped.join("\n")}\n${end}\n`;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function expectDenied(err, label) {
  const code = err?.code || "";
  assert(
    code === "permission-denied" || /permission/i.test(String(err?.message || "")),
    `${label}: expected permission-denied, got ${code || err}`
  );
}

async function main() {
  const env = loadEnv(path.resolve(".env"));
  Object.assign(process.env, {
    APP_URL: env.APP_URL || process.env.APP_URL || "http://localhost:8888",
  });

  const projectId = env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = env.FIREBASE_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(env.FIREBASE_PRIVATE_KEY);

  assert(projectId && clientEmail && privateKey, "Missing Firebase Admin env");
  assert(env.VITE_FIREBASE_API_KEY, "Missing VITE_FIREBASE_API_KEY");

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  const uid = `sec-smoke-${Date.now()}`;
  const results = [];
  let incomeRef = null;
  let budgetRef = null;
  let auth = null;
  let userRef = null;

  try {
  // --- 1) Redirect allowlist (unit) ---
  const origin = getAppOrigin();
  assert(
    resolveAppRedirectUrl(null, "/home/profile") === `${origin}/home/profile`,
    "fallback redirect"
  );
  assert(
    resolveAppRedirectUrl(`${origin}/home/profile?ok=1`, "/x") ===
      `${origin}/home/profile?ok=1`,
    "same-origin redirect allowed"
  );
  let blocked = false;
  try {
    resolveAppRedirectUrl("https://evil.example/phish", "/home/profile");
  } catch {
    blocked = true;
  }
  assert(blocked, "external redirect must be rejected");
  results.push("PASS redirect allowlist");
  console.log("ok: redirect allowlist");

  // --- 2) Firestore Pro gate (live rules) ---
  userRef = admin.firestore().doc(`users/${uid}`);
  await userRef.set({
    email: `${uid}@example.test`,
    subscription: {
      status: "none",
      planId: "free",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      priceId: null,
      trialEndsAt: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    },
  });
  console.log("ok: created free user", uid);

  const clientApp = initializeApp(
    {
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID || projectId,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: env.VITE_FIREBASE_APP_ID,
    },
    `sec-smoke-${uid}`
  );
  auth = getAuth(clientApp);
  const db = getFirestore(clientApp);

  const token = await admin.auth().createCustomToken(uid);
  await signInWithCustomToken(auth, token);
  console.log("ok: signed in");

  budgetRef = doc(db, `users/${uid}/categoryBudgets/sec-test-cat`);
  const payload = {
    categoryId: "sec-test-cat",
    monthlyLimit: 100,
    updatedAt: new Date().toISOString(),
  };

  let freeBlocked = false;
  try {
    await setDoc(budgetRef, payload, { merge: true });
    console.log("unexpected: free write succeeded");
  } catch (err) {
    expectDenied(err, "free budget write");
    freeBlocked = true;
    console.log("ok: free blocked", err.code);
  }
  assert(freeBlocked, "Free user must NOT write categoryBudgets");
  results.push("PASS free user blocked from categoryBudgets");

  await userRef.set(
    {
      subscription: {
        status: "active",
        planId: "pro_monthly",
        stripeCustomerId: "cus_sec_test",
        stripeSubscriptionId: "sub_sec_test",
        priceId: "price_sec_test",
        trialEndsAt: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      },
    },
    { merge: true }
  );

  const afterPro = await userRef.get();
  const sub = afterPro.data()?.subscription || {};
  console.log("ok: upgraded to", sub.status, "keys", Object.keys(sub));
  assert(sub.status === "active", `expected active subscription, got ${sub.status}`);

  try {
    await setDoc(budgetRef, payload, { merge: true });
    console.log("ok: pro budget write");
    results.push("PASS pro user can write categoryBudgets");
  } catch (err) {
    console.error("pro write detail:", err.code, err.message);
    console.error("subscription snapshot:", sub);
    throw new Error(`pro budget write failed: ${err.code} ${err.message}`);
  }

  incomeRef = doc(db, `users/${uid}/income/sec-test-income`);
  try {
    await setDoc(incomeRef, {
      description: "sec test",
      amount: 1,
      categoryId: "income-other",
      incomePeriod: "2026-10",
      expectedDate: "2026-10-06",
      status: "pending",
      notes: "",
    });
    console.log("ok: income write");
    results.push("PASS owner can still write income");
  } catch (err) {
    throw new Error(`income write failed: ${err.code} ${err.message}`);
  }

  // --- 3) sync-subscription source check (static) ---
  const syncSrc = fs.readFileSync(
    path.resolve("netlify/functions/sync-subscription.cjs"),
    "utf8"
  );
  assert(
    !/customers\.list\(\s*\{\s*email/.test(syncSrc),
    "sync-subscription must not look up Stripe customers by email"
  );
  assert(
    /SUBSCRIPTION_OWNED_ELSEWHERE/.test(syncSrc),
    "sync-subscription must reject foreign subscription ownership"
  );
  results.push("PASS sync-subscription no email claim + ownership check");
  console.log("ok: sync-subscription static checks");

  console.log("\nSecurity smoke tests OK:");
  for (const line of results) console.log(" -", line);
  console.log("\nSafe to treat as verified.");
  } finally {
    // Always remove temporary Auth user + docs
    try {
      await admin.firestore().doc(`users/${uid}/categoryBudgets/sec-test-cat`).delete();
    } catch {}
    try {
      await admin.firestore().doc(`users/${uid}/income/sec-test-income`).delete();
    } catch {}
    try {
      if (userRef) await userRef.delete();
    } catch {}
    try {
      await admin.auth().deleteUser(uid);
    } catch {}
    try {
      if (auth) await signOut(auth);
    } catch {}
  }
}

main().catch((err) => {
  console.error("\nSecurity smoke tests FAILED:");
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
