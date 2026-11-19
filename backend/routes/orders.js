const router = require('express').Router();
const PDFDocument = require('pdfkit');
const Order = require('../models/Order');
const Coupon = require('../models/Coupon');
const { protect, allow } = require('../middleware/auth');
const { getCartItems } = require('./cart');

const COMMISSION = Number(process.env.COMMISSION_PERCENT) || 10;
const STATUS_FLOW = ['placed', 'packed', 'shipped', 'delivered'];

// POST /api/orders  { address, couponCode }  -> creates an unpaid order from the cart
router.post('/', protect, allow('customer'), async (req, res) => {
  try {
    const { address, couponCode } = req.body;
    if (!address) return res.status(400).json({ message: 'Please enter a delivery address' });

    const cartItems = await getCartItems(req.user._id);
    if (cartItems.length === 0) return res.status(400).json({ message: 'Your cart is empty' });

    // 1. build order items and check stock
    let subtotal = 0;
    const items = [];
    for (const { product, qty } of cartItems) {
      if (product.stock < qty) return res.status(400).json({ message: `Not enough stock for ${product.name}` });
      subtotal += product.price * qty;
      items.push({ product: product._id, vendor: product.vendor, name: product.name, price: product.price, qty });
    }

    // 2. coupon
    let discount = 0;
    let appliedCode;
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), active: true });
      if (!coupon) return res.status(400).json({ message: 'Invalid coupon code' });
      discount = Math.round((subtotal * coupon.percent) / 100);
      appliedCode = coupon.code;
    }
    const total = subtotal - discount;

    // 3. split the money: platform commission + each vendor's share
    const commission = Math.round((total * COMMISSION) / 100);
    const perVendor = {};
    items.forEach((i) => {
      const key = String(i.vendor);
      perVendor[key] = (perVendor[key] || 0) + i.price * i.qty;
    });
    const vendorEarnings = Object.entries(perVendor).map(([vendor, amount]) => ({
      vendor,
      amount: Math.round(amount * (total / subtotal) * (1 - COMMISSION / 100)),
    }));

    const order = await Order.create({
      customer: req.user._id, items, address, subtotal, discount, couponCode: appliedCode, total, commission, vendorEarnings,
    });
    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/orders/mine  (customer's orders)
router.get('/mine', protect, allow('customer'), async (req, res) => {
  const orders = await Order.find({ customer: req.user._id, paymentStatus: 'paid' }).sort('-createdAt');
  res.json(orders);
});

// GET /api/orders/vendor  (orders that contain this vendor's products)
router.get('/vendor', protect, allow('vendor'), async (req, res) => {
  const orders = await Order.find({ 'items.vendor': req.user._id, paymentStatus: 'paid' })
    .populate('customer', 'name email')
    .sort('-createdAt');

  // show only this vendor's items and earning
  const result = orders.map((o) => {
    const mine = o.vendorEarnings.find((e) => String(e.vendor) === String(req.user._id));
    return {
      _id: o._id,
      customer: o.customer,
      address: o.address,
      status: o.status,
      createdAt: o.createdAt,
      items: o.items.filter((i) => String(i.vendor) === String(req.user._id)),
      earning: mine ? mine.amount : 0,
    };
  });
  res.json(result);
});

// PUT /api/orders/:id/status  { status }  (vendor or admin moves the order forward)
router.put('/:id/status', protect, allow('vendor', 'admin'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!STATUS_FLOW.includes(status)) return res.status(400).json({ message: 'Invalid status' });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (req.user.role === 'vendor' && !order.items.some((i) => String(i.vendor) === String(req.user._id))) {
      return res.status(403).json({ message: 'This order does not contain your products' });
    }
    if (STATUS_FLOW.indexOf(status) < STATUS_FLOW.indexOf(order.status)) {
      return res.status(400).json({ message: 'Order cannot go backwards' });
    }
    order.status = status;
    await order.save();
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/orders/:id/invoice  -> PDF invoice
router.get('/:id/invoice', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('customer', 'name email');
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const isOwner = String(order.customer._id) === String(req.user._id);
    if (!isOwner && req.user.role !== 'admin') return res.status(403).json({ message: 'Not allowed' });

    const doc = new PDFDocument({ margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${order._id}.pdf`);
    doc.pipe(res);

    doc.fontSize(22).text('MultiMart - Invoice');
    doc.moveDown(0.5).fontSize(10).text(`Order ID: ${order._id}`);
    doc.text(`Date: ${order.createdAt.toDateString()}`);
    doc.text(`Customer: ${order.customer.name} (${order.customer.email})`);
    doc.text(`Delivery address: ${order.address}`);
    doc.moveDown();

    doc.fontSize(12).text('Items', { underline: true });
    doc.moveDown(0.3);
    order.items.forEach((i) => {
      doc.fontSize(10).text(`${i.name}   x${i.qty}   @ Rs.${i.price}   =   Rs.${i.price * i.qty}`);
    });
    doc.moveDown();
    doc.text(`Subtotal: Rs.${order.subtotal}`);
    if (order.discount) doc.text(`Discount (${order.couponCode}): -Rs.${order.discount}`);
    doc.fontSize(13).text(`Total paid: Rs.${order.total}`);
    doc.end();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
