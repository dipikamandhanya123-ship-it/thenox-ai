const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { db, admin } = require('../config/firebase');

// Increment daily usage
router.post('/increment', verifyToken, async (req, res) => {
  try {
    await db.collection('users').doc(req.user.uid).update({
      messagesUsedToday: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Daily reset (cron job)
router.post('/daily-reset', async (req, res) => {
  try {
    if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) return res.status(401).json({ error: 'Unauthorized' });
    const snap = await db.collection('users').get();
    const batch = db.batch();
    snap.docs.forEach(doc => {
      batch.update(doc.ref, { messagesUsedToday: 0, tokensUsedToday: 0, lastTokenReset: admin.firestore.FieldValue.serverTimestamp() });
    });
    await batch.commit();
    res.json({ success: true, reset: snap.size });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
