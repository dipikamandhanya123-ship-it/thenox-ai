const admin = require('firebase-admin');

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (projectId && clientEmail && privateKey) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey })
      });
      console.log('✅ Firebase Admin initialized');
    } catch (e) { console.error('❌ Firebase:', e.message); }
  } else {
    console.warn('⚠️ Firebase env vars missing');
  }
}

const db = admin.apps.length ? admin.firestore() : null;
const auth = admin.apps.length ? admin.auth() : null;
if (db) db.settings({ ignoreUndefinedProperties: true });

module.exports = { admin, db, auth };
