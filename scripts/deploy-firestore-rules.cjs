/**
 * Deploy firestore.rules using FIREBASE_* service account from .env
 * (no interactive firebase login required).
 *
 * Usage: node scripts/deploy-firestore-rules.cjs
 */
const fs = require("fs");
const path = require("path");
const { GoogleAuth } = require("google-auth-library");

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
  if (!key.includes(begin) || !key.includes(end)) {
    throw new Error("FIREBASE_PRIVATE_KEY is missing PEM headers");
  }
  const body = key.replace(begin, "").replace(end, "").replace(/\s+/g, "");
  const wrapped = body.match(/.{1,64}/g) || [];
  return `${begin}\n${wrapped.join("\n")}\n${end}\n`;
}

async function main() {
  const envPath = path.resolve(".env");
  if (!fs.existsSync(envPath)) {
    throw new Error("Missing .env with FIREBASE_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY");
  }

  const env = loadEnv(envPath);
  const projectId = env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = env.FIREBASE_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(env.FIREBASE_PRIVATE_KEY);

  if (!projectId || !clientEmail) {
    throw new Error("FIREBASE_PROJECT_ID and FIREBASE_CLIENT_EMAIL are required");
  }

  const auth = new GoogleAuth({
    credentials: {
      type: "service_account",
      project_id: projectId,
      private_key: privateKey,
      client_email: clientEmail,
    },
    scopes: [
      "https://www.googleapis.com/auth/cloud-platform",
      "https://www.googleapis.com/auth/firebase",
    ],
  });

  const accessToken = (await (await auth.getClient()).getAccessToken()).token;
  if (!accessToken) throw new Error("Failed to mint access token");

  const source = fs.readFileSync(path.resolve("firestore.rules"), "utf8");
  const base = `https://firebaserules.googleapis.com/v1/projects/${projectId}`;

  const createRes = await fetch(`${base}/rulesets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source: { files: [{ name: "firestore.rules", content: source }] },
    }),
  });
  const createBody = await createRes.json();
  if (!createRes.ok) {
    throw new Error(
      `Create ruleset failed (${createRes.status}): ${JSON.stringify(createBody)}`
    );
  }

  const rulesetName = createBody.name;
  const releaseRes = await fetch(
    `${base}/releases/cloud.firestore?updateMask=rulesetName`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        release: {
          name: `projects/${projectId}/releases/cloud.firestore`,
          rulesetName,
        },
      }),
    }
  );
  const releaseBody = await releaseRes.json();
  if (!releaseRes.ok) {
    throw new Error(
      `Release failed (${releaseRes.status}): ${JSON.stringify(releaseBody)}`
    );
  }

  console.log("Firestore rules deployed.");
  console.log("ruleset:", rulesetName);
  console.log("updated:", releaseBody.updateTime || "(ok)");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
