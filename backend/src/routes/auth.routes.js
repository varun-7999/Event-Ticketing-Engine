const express = require('express');
const { register, login, logout } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);

// Profile route to verify that the logged-in cookie/token works
router.get('/me', protect, (req, res) => {
  res.status(200).json({ success: true, user: req.user });
});
module.exports = router;