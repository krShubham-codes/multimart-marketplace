const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['customer', 'vendor', 'admin'], default: 'customer' },
  shopName: String,                                  // only for vendors
  approved: { type: Boolean, default: false },       // vendors need admin approval
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
