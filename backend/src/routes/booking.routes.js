const express = require('express');
const { createPaymentOrder, verifyPayment, markPaymentFailed, getMyBookings } = require('../controllers/booking.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(protect); // All booking routes require authentication

router.post('/payment/order', createPaymentOrder);
router.post('/payment/verify', verifyPayment);
router.post('/payment/failed', markPaymentFailed);
router.get('/my-bookings', getMyBookings);

module.exports = router;