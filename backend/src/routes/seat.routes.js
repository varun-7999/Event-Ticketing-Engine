const express = require('express');
const { lockSeat, unlockSeat } = require('../controllers/seat.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/:id/lock', protect, lockSeat);
router.post('/:id/unlock', protect, unlockSeat);

module.exports = router;