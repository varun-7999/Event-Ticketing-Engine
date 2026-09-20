const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Event = require('../models/event.model');

const protect = async (req, res, next) => {
  let token;

  // 1. Look for the token
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // 2. What if there is no token?
  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
  }
  try {
    // 3. Verify the token's cryptographic signature
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_for_development');

    // 4. Fetch the real user from MongoDB and attach it to the request
    req.user = await User.findById(decoded.id);

    // passing to the controller
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Session expired or invalid token' });
  }
};

module.exports = { protect };

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'You do not have permission to perform this action' });
  }
  next();
};

module.exports.requireRole = requireRole;

const verifyOrganizerOrAdmin = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const isOwner = event.organizer.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only the event organizer or an admin can manage this event' });
    }

    req.event = event;
    next();
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Invalid event ID' });
  }
};

module.exports.verifyOrganizerOrAdmin = verifyOrganizerOrAdmin;