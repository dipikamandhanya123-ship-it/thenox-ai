const express = require('express');
const router = express.Router();
const { auth, db, admin } = require('../config/firebase');
const { body, validationResult } = require('express-validator');

// Sync user after Google/Email login
router.post('/sync', async (req, res) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
    const token = header.split('Bearer ')[1];
    const decoded = await auth.verifyIdToken(token);
    const ref = db.collection('users').doc(decoded.uid);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        uid: decoded.uid, email: decoded.email,
        name: decoded.name || decoded.email?.split('@')[0] || 'User',
        plan: 'free', messagesUsedToday: 0, tokensUsedToday: 0,
        workers: [], connectors: [], profileComplete: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    const data = (await ref.get()).data();
    res.json({ success: true, user: data });
  } catch (e) { res.status(401).json({ error: e.message }); }
});

module.exports = router;
