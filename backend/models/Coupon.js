const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true },
  percent: { type: Number, required: true, min: 1, max: 90 },
  active: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Coupon', couponSchema);
