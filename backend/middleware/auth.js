const { auth, db } = require('../config/firebase');

const verifyToken = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
    const token = header.split('Bearer ')[1];
    const decoded = await auth.verifyIdToken(token);
    req.user = { uid: decoded.uid, email: decoded.email, name: decoded.name };
    if (db) {
      const snap = await db.collection('users').doc(decoded.uid).get();
      if (snap.exists) req.userData = snap.data();
    }
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = { verifyToken };
