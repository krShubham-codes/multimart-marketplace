const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Checks the JWT token sent in the Authorization header
exports.protect = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.split(' ')[1] : null;
  if (!token) return res.status(401).json({ message: 'Please login first' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(401).json({ message: 'User no longer exists' });
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// Role based access: allow('vendor', 'admin')
exports.allow = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'You do not have access to this' });
  }
  next();
};
