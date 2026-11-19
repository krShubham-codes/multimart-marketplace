const router = require('express').Router();
const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { protect, allow } = require('../middleware/auth');
const { indexProduct } = require('../config/services');

// GET /api/reviews/:productId
router.get('/:productId', async (req, res) => {
  const reviews = await Review.find({ product: req.params.productId }).populate('user', 'name').sort('-createdAt');
  res.json(reviews);
});

// POST /api/reviews/:productId  { rating, comment }  (only customers who bought it)
router.post('/:productId', protect, allow('customer'), async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const productId = req.params.productId;

    const bought = await Order.findOne({ customer: req.user._id, paymentStatus: 'paid', 'items.product': productId });
    if (!bought) return res.status(403).json({ message: 'You can review only products you have bought' });

    // create or update this user's review
    await Review.findOneAndUpdate(
      { product: productId, user: req.user._id },
      { rating: Number(rating), comment },
      { upsert: true, runValidators: true }
    );

    // recalculate the product rating
    const reviews = await Review.find({ product: productId });
    const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    const product = await Product.findByIdAndUpdate(
      productId,
      { ratingAvg: Math.round(avg * 10) / 10, ratingCount: reviews.length },
      { new: true }
    );
    await indexProduct(product);
    res.status(201).json({ message: 'Review saved' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
