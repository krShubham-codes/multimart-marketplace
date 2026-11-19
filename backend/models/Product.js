const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 },
  stock: { type: Number, default: 0, min: 0 },
  category: { type: String, default: 'general' },
  image: { type: String, default: '' },
  ratingAvg: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
