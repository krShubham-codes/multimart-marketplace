const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Product = require('../models/Product');
const { protect, allow } = require('../middleware/auth');
const { indexProduct, removeProduct, searchProducts, s3Enabled, uploadToS3, cacheGet, cacheSet, cacheDel } = require('../config/services');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024 } });

// Vendors must be approved by admin before selling
const approvedVendor = (req, res, next) => {
  if (req.user.role === 'vendor' && !req.user.approved) {
    return res.status(403).json({ message: 'Your shop is waiting for admin approval' });
  }
  next();
};

// POST /api/products/upload  -> returns image url (S3 or local folder)
router.post('/upload', protect, allow('vendor', 'admin'), upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Please choose an image' });
    if (!req.file.mimetype.startsWith('image/')) return res.status(400).json({ message: 'Only image files allowed' });

    if (s3Enabled) {
      const url = await uploadToS3(req.file);
      return res.json({ url });
    }
    // fallback: save on our own server
    const fileName = Date.now() + '-' + req.file.originalname.replace(/\s+/g, '_');
    fs.writeFileSync(path.join(__dirname, '..', 'uploads', fileName), req.file.buffer);
    res.json({ url: '/uploads/' + fileName });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/products/categories
router.get('/categories', async (req, res) => {
  let categories = await cacheGet('categories');       // Redis caching example
  if (!categories) {
    categories = await Product.distinct('category');
    await cacheSet('categories', categories, 300);
  }
  res.json(categories);
});

// GET /api/products/mine  (vendor's own products)
router.get('/mine', protect, allow('vendor'), async (req, res) => {
  const products = await Product.find({ vendor: req.user._id }).sort('-createdAt');
  res.json(products);
});

// GET /api/products?q=&category=&minPrice=&maxPrice=&sort=&page=
router.get('/', async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = 12;
    const { q, category, minPrice, maxPrice, sort } = req.query;

    // 1) try Elasticsearch
    const esResult = await searchProducts({ q, category, minPrice, maxPrice, sort, page, limit });
    if (esResult) return res.json({ ...esResult, page, pages: Math.ceil(esResult.total / limit) });

    // 2) fallback: normal MongoDB query
    const filter = {};
    if (q) filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } },
      { category: { $regex: q, $options: 'i' } },
    ];
    if (category) filter.category = category;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    const sortMap = { price_asc: 'price', price_desc: '-price', rating: '-ratingAvg', newest: '-createdAt' };

    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .sort(sortMap[sort] || '-createdAt')
      .skip((page - 1) * limit)
      .limit(limit);
    res.json({ products, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('vendor', 'shopName name');
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(404).json({ message: 'Product not found' });
  }
});

// POST /api/products  (vendor adds product)
router.post('/', protect, allow('vendor'), approvedVendor, async (req, res) => {
  try {
    const { name, description, price, stock, category, image } = req.body;
    if (!name || price === undefined) return res.status(400).json({ message: 'Name and price are required' });
    const product = await Product.create({
      vendor: req.user._id, name, description, price, stock, category: (category || 'general').toLowerCase(), image,
    });
    await indexProduct(product);
    await cacheDel('categories');
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/products/:id  (only the owner vendor)
router.put('/:id', protect, allow('vendor'), approvedVendor, async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, vendor: req.user._id });
    if (!product) return res.status(404).json({ message: 'Product not found' });

    ['name', 'description', 'price', 'stock', 'category', 'image'].forEach((field) => {
      if (req.body[field] !== undefined) product[field] = req.body[field];
    });
    await product.save();
    await indexProduct(product);
    await cacheDel('categories');
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/products/:id
router.delete('/:id', protect, allow('vendor', 'admin'), async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, vendor: req.user._id };
    const product = await Product.findOneAndDelete(filter);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    await removeProduct(product._id);
    await cacheDel('categories');
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
