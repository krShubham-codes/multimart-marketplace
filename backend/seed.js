// Run with: npm run seed
// Creates an admin, a demo vendor, a demo customer, a coupon and sample products
// (sample products come from the free DummyJSON API).
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Product = require('./models/Product');
const Coupon = require('./models/Coupon');
const { indexProduct } = require('./config/services');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  const password = await bcrypt.hash('password123', 10);

  const people = [
    { name: 'Admin', email: 'admin@multimart.com', role: 'admin', approved: true },
    { name: 'Demo Vendor', email: 'vendor@multimart.com', role: 'vendor', shopName: 'Demo Store', approved: true },
    { name: 'Demo Customer', email: 'customer@multimart.com', role: 'customer' },
  ];
  let vendor;
  for (const p of people) {
    let user = await User.findOne({ email: p.email });
    if (!user) user = await User.create({ ...p, password });
    if (p.role === 'vendor') vendor = user;
  }

  await Coupon.updateOne({ code: 'WELCOME10' }, { code: 'WELCOME10', percent: 10, active: true }, { upsert: true });

  if ((await Product.countDocuments()) === 0) {
    const res = await fetch('https://dummyjson.com/products?limit=40');
    const data = await res.json();
    for (const p of data.products) {
      const product = await Product.create({
        vendor: vendor._id,
        name: p.title,
        description: p.description,
        price: Math.round(p.price * 80),               // dollars -> rupees (roughly)
        stock: 20,
        category: p.category,
        image: p.thumbnail,
      });
      await indexProduct(product);
    }
    console.log('Added sample products');
  }

  console.log('Seed done. Logins (password: password123):');
  people.forEach((p) => console.log(' ', p.role, '->', p.email));
  process.exit(0);
}

seed().catch((err) => { console.log(err); process.exit(1); });
