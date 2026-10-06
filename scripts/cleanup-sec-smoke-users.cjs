/**
 * Delete leftover Auth users / docs from security smoke tests.
 * Usage: node scripts/cleanup-sec-smoke-users.cjs
 */
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

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

async function main() {
  const env = loadEnv(path.resolve(".env"));
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: normalizePrivateKey(env.FIREBASE_PRIVATE_KEY),
      }),
    });
  }

  const listed = await admin.auth().listUsers(1000);
  const smoke = listed.users.filter((u) => u.uid.startsWith("sec-smoke-"));
  if (!smoke.length) {
    console.log("No sec-smoke Auth users found.");
    return;
  }

  for (const user of smoke) {
    const uid = user.uid;
    await admin
      .firestore()
      .doc(`users/${uid}/categoryBudgets/sec-test-cat`)
      .delete()
      .catch(() => {});
    await admin
      .firestore()
      .doc(`users/${uid}/income/sec-test-income`)
      .delete()
      .catch(() => {});
    await admin
      .firestore()
      .doc(`users/${uid}`)
      .delete()
      .catch(() => {});
    await admin.auth().deleteUser(uid);
    console.log("deleted", uid);
  }
  console.log(`Cleaned ${smoke.length} smoke user(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
