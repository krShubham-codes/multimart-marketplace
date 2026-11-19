const router = require('express').Router();
const crypto = require('crypto');
const Razorpay = require('razorpay');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { protect, allow } = require('../middleware/auth');
const { clearCart } = require('./cart');

const hasKeys = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
const razorpay = hasKeys
  ? new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })
  : null;

router.use(protect, allow('customer'));

// After payment is confirmed: mark paid, reduce stock, empty the cart
async function markPaid(order, paymentId) {
  order.paymentStatus = 'paid';
  order.paymentId = paymentId;
  await order.save();
  for (const item of order.items) {
    await Product.updateOne({ _id: item.product }, { $inc: { stock: -item.qty } });
  }
  await clearCart(order.customer);
}

async function findMyOrder(req, res) {
  const order = await Order.findOne({ _id: req.body.orderId, customer: req.user._id });
  if (!order) { res.status(404).json({ message: 'Order not found' }); return null; }
  if (order.paymentStatus === 'paid') { res.status(400).json({ message: 'Order is already paid' }); return null; }
  return order;
}

// POST /api/payments/create  { orderId }
router.post('/create', async (req, res) => {
  try {
    const order = await findMyOrder(req, res);
    if (!order) return;

    if (!hasKeys) return res.json({ mode: 'mock' });   // demo mode, no Razorpay keys

    const rzpOrder = await razorpay.orders.create({
      amount: order.total * 100,                       // Razorpay uses paise
      currency: 'INR',
      receipt: String(order._id),
    });
    order.razorpayOrderId = rzpOrder.id;
    await order.save();
    res.json({ mode: 'razorpay', key: process.env.RAZORPAY_KEY_ID, razorpayOrderId: rzpOrder.id, amount: rzpOrder.amount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/payments/verify  { orderId, razorpay_payment_id, razorpay_order_id, razorpay_signature }
router.post('/verify', async (req, res) => {
  try {
    const order = await findMyOrder(req, res);
    if (!order) return;

    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (expected !== razorpay_signature || razorpay_order_id !== order.razorpayOrderId) {
      return res.status(400).json({ message: 'Payment verification failed' });
    }
    await markPaid(order, razorpay_payment_id);
    res.json({ message: 'Payment successful', order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/payments/mock-confirm  { orderId }  (only works when Razorpay keys are NOT set)
router.post('/mock-confirm', async (req, res) => {
  try {
    if (hasKeys) return res.status(400).json({ message: 'Demo payment is disabled' });
    const order = await findMyOrder(req, res);
    if (!order) return;
    await markPaid(order, 'demo_' + Date.now());
    res.json({ message: 'Demo payment successful', order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
