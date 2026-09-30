const admin = require("firebase-admin");

let initialized = false;

function getPrivateKey() {
  const raw = process.env.FIREBASE_PRIVATE_KEY;
  if (!raw) return null;
  return raw.replace(/\\n/g, "\n");
}

function ensureFirebaseAdmin() {
  if (initialized) return admin;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getPrivateKey();

  if (!projectId || !clientEmail || !privateKey) {
    const error = new Error(
      "Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY."
    );
    error.code = "FIREBASE_ADMIN_MISSING";
    throw error;
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  initialized = true;
  return admin;
}

async function verifyBearerToken(event) {
  const header =
    event.headers.authorization || event.headers.Authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    const error = new Error("Missing Authorization bearer token.");
    error.statusCode = 401;
    error.code = "UNAUTHORIZED";
    throw error;
  }

  const app = ensureFirebaseAdmin();
  try {
    return await app.auth().verifyIdToken(match[1]);
  } catch (err) {
    const error = new Error("Invalid or expired auth token.");
    error.statusCode = 401;
    error.code = "UNAUTHORIZED";
    error.cause = err;
    throw error;
  }
}

function getFirestore() {
  return ensureFirebaseAdmin().firestore();
}

module.exports = {
  ensureFirebaseAdmin,
  verifyBearerToken,
  getFirestore,
  admin,
};
