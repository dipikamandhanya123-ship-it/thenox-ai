const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { db, admin } = require('../config/firebase');
const crypto = require('crypto');

const PLANS = {
  pro_monthly:   { amount: 29900,  plan: 'pro',   period: 'monthly' },
  pro_yearly:    { amount: 249900, plan: 'pro',   period: 'yearly'  },
  ultra_monthly: { amount: 79900,  plan: 'ultra', period: 'monthly' },
  ultra_yearly:  { amount: 699900, plan: 'ultra', period: 'yearly'  },
};

// Create Razorpay order
router.post('/create-order', verifyToken, async (req, res) => {
  try {
    const { planId } = req.body;
    const plan = PLANS[planId];
    if (!plan) return res.status(400).json({ error: 'Invalid plan' });

    // Razorpay not configured yet
    if (!process.env.RAZORPAY_KEY_ID) {
      return res.status(503).json({ error: 'Payment system coming soon! Contact support@thenox.ai' });
    }

    const Razorpay = require('razorpay');
    const rzp = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
    const order = await rzp.orders.create({ amount: plan.amount, currency: 'INR', receipt: `thenox_${req.user.uid}_${Date.now()}`, notes: { userId: req.user.uid, planId } });
    res.json({ success: true, orderId: order.id, amount: plan.amount, key: process.env.RAZORPAY_KEY_ID });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Verify payment - PREVENTS FAKE PAYMENTS
router.post('/verify', verifyToken, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId } = req.body;
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(body).digest('hex');
    if (expected !== razorpay_signature) return res.status(400).json({ error: 'Invalid payment signature' });

    // Check duplicate
    const dup = await db.collection('payments').where('paymentId', '==', razorpay_payment_id).get();
    if (!dup.empty) return res.status(400).json({ error: 'Payment already processed' });

    const plan = PLANS[planId];
    const expiry = new Date();
    if (plan.period === 'monthly') expiry.setMonth(expiry.getMonth() + 1);
    else expiry.setFullYear(expiry.getFullYear() + 1);

    // Hold payment until period ends (escrow logic)
    await db.collection('payments').add({
      userId: req.user.uid, planId, orderId: razorpay_order_id,
      paymentId: razorpay_payment_id, amount: plan.amount,
      status: 'active', plan: plan.plan, period: plan.period,
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: expiry, releasedAt: null
    });

    await db.collection('users').doc(req.user.uid).update({
      plan: plan.plan, planExpiry: expiry,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true, message: `${plan.plan} plan activated!` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
