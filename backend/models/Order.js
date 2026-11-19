const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String,
    price: Number,
    qty: Number,
  }],
  address: { type: String, required: true },
  subtotal: Number,
  discount: { type: Number, default: 0 },
  couponCode: String,
  total: Number,
  commission: Number,                                // platform's cut
  vendorEarnings: [{                                 // what each vendor gets
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    amount: Number,
  }],
  status: { type: String, enum: ['placed', 'packed', 'shipped', 'delivered'], default: 'placed' },
  paymentStatus: { type: String, enum: ['pending', 'paid'], default: 'pending' },
  razorpayOrderId: String,
  paymentId: String,
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
