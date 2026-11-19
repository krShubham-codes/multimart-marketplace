const router = require('express').Router();
const Product = require('../models/Product');
const { protect, allow } = require('../middleware/auth');
const { cacheGet, cacheSet, cacheDel } = require('../config/services');

// The cart is stored in Redis (or memory) as: [{ product: "id", qty: 2 }]
const cartKey = (userId) => 'cart:' + userId;

// Returns cart items with full product details (used by cart page and orders)
async function getCartItems(userId) {
  const raw = (await cacheGet(cartKey(userId))) || [];
  const items = [];
  for (const row of raw) {
    const product = await Product.findById(row.product);
    if (product) items.push({ product, qty: row.qty });
  }
  return items;
}

router.use(protect, allow('customer'));

// GET /api/cart
router.get('/', async (req, res) => {
  const items = await getCartItems(req.user._id);
  const total = items.reduce((sum, i) => sum + i.product.price * i.qty, 0);
  res.json({ items, total });
});

// POST /api/cart/add  { productId, qty }
router.post('/add', async (req, res) => {
  const { productId, qty = 1 } = req.body;
  const product = await Product.findById(productId);
  if (!product) return res.status(404).json({ message: 'Product not found' });

  const cart = (await cacheGet(cartKey(req.user._id))) || [];
  const existing = cart.find((i) => i.product === productId);
  const newQty = (existing ? existing.qty : 0) + Number(qty);
  if (newQty > product.stock) return res.status(400).json({ message: `Only ${product.stock} in stock` });

  if (existing) existing.qty = newQty;
  else cart.push({ product: productId, qty: newQty });

  await cacheSet(cartKey(req.user._id), cart, 7 * 24 * 3600);
  res.json({ message: 'Added to cart' });
});

// PUT /api/cart/update  { productId, qty }  (qty 0 removes the item)
router.put('/update', async (req, res) => {
  const { productId, qty } = req.body;
  let cart = (await cacheGet(cartKey(req.user._id))) || [];
  if (Number(qty) <= 0) {
    cart = cart.filter((i) => i.product !== productId);
  } else {
    const product = await Product.findById(productId);
    if (product && Number(qty) > product.stock) return res.status(400).json({ message: `Only ${product.stock} in stock` });
    const item = cart.find((i) => i.product === productId);
    if (item) item.qty = Number(qty);
  }
  await cacheSet(cartKey(req.user._id), cart, 7 * 24 * 3600);
  res.json({ message: 'Cart updated' });
});

module.exports = router;
module.exports.getCartItems = getCartItems;
module.exports.clearCart = (userId) => cacheDel(cartKey(userId));
