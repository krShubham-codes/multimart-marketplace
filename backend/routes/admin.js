const router = require('express').Router();
const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const { protect, allow } = require('../middleware/auth');

router.use(protect, allow('admin'));

// GET /api/admin/stats  (analytics page)
router.get('/stats', async (req, res) => {
  const [customers, vendors, products] = await Promise.all([
    User.countDocuments({ role: 'customer' }),
    User.countDocuments({ role: 'vendor' }),
    Product.countDocuments(),
  ]);

  const paidOrders = await Order.find({ paymentStatus: 'paid' });
  const revenue = paidOrders.reduce((s, o) => s + o.total, 0);
  const commission = paidOrders.reduce((s, o) => s + (o.commission || 0), 0);

  const byStatus = await Order.aggregate([
    { $match: { paymentStatus: 'paid' } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const topProducts = await Order.aggregate([
    { $match: { paymentStatus: 'paid' } },
    { $unwind: '$items' },
    { $group: { _id: '$items.name', sold: { $sum: '$items.qty' } } },
    { $sort: { sold: -1 } },
    { $limit: 5 },
  ]);

  res.json({ customers, vendors, products, orders: paidOrders.length, revenue, commission, byStatus, topProducts });
});

// GET /api/admin/vendors
router.get('/vendors', async (req, res) => {
  res.json(await User.find({ role: 'vendor' }).select('-password').sort('-createdAt'));
});

// PUT /api/admin/vendors/:id/approve  { approved: true/false }
router.put('/vendors/:id/approve', async (req, res) => {
  const vendor = await User.findOneAndUpdate(
    { _id: req.params.id, role: 'vendor' },
    { approved: !!req.body.approved },
    { new: true }
  ).select('-password');
  if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
  res.json(vendor);
});

// Coupons
router.get('/coupons', async (req, res) => res.json(await Coupon.find().sort('-createdAt')));

router.post('/coupons', async (req, res) => {
  try {
    const { code, percent } = req.body;
    const coupon = await Coupon.create({ code, percent: Number(percent) });
    res.status(201).json(coupon);
  } catch (err) {
    res.status(400).json({ message: err.code === 11000 ? 'Coupon code already exists' : err.message });
  }
});

router.delete('/coupons/:id', async (req, res) => {
  await Coupon.findByIdAndDelete(req.params.id);
  res.json({ message: 'Coupon deleted' });
});

module.exports = router;
