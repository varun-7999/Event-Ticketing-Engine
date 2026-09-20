const mongoose = require('mongoose');
const Seat = require('../models/seat.model');
const { getIO } = require('../socket');

const HOLD_DURATION_MS = 10 * 60 * 1000; // 10 minutes

// Safe broadcast helper targeting the specific event room
const broadcastSeatUpdate = (eventName, payload) => {
  try {
    const io = getIO();
    // Emits specifically to users viewing this event
    io.to(`event:${payload.eventId}`).emit(eventName, payload);
  } catch (err) {
    console.error(`Socket broadcast error on ${eventName}:`, err.message);
  }
};

// @desc    Get all seats for an event (Seat Map)
// @route   GET /api/events/:eventId/seats
// @access  Public
const getEventSeats = async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID format' });
    }

    const seats = await Seat.find({ eventId }).sort({ seatNumber: 1 });

    res.status(200).json({
      success: true,
      count: seats.length,
      seats,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Lock a seat temporarily for checkout
// @route   POST /api/seats/:id/lock
// @access  Private
const lockSeat = async (req, res) => {
  try {
    const seatId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(seatId)) {
      return res.status(400).json({ success: false, message: 'Invalid seat ID format' });
    }

    const userId = req.user._id;
    const now = new Date();
    const lockExpiry = new Date(now.getTime() + HOLD_DURATION_MS);

    const seat = await Seat.findOneAndUpdate(
      {
        _id: seatId,
        $or: [
          { status: 'AVAILABLE' },
          { status: 'LOCKED', lockedUntil: { $lt: now } },
        ],
      },
      {
        $set: {
          status: 'LOCKED',
          lockedBy: userId,
          lockedUntil: lockExpiry,
        },
        $inc: { version: 1 },
      },
      { new: true }
    );

    if (!seat) {
      return res.status(409).json({
        success: false,
        message: 'This seat is currently unavailable or has already been locked by someone else.',
      });
    }

    broadcastSeatUpdate('seat:locked', {
      seatId: seat._id,
      eventId: seat.eventId,
      seatNumber: seat.seatNumber,
      status: 'LOCKED',
      lockedUntil: seat.lockedUntil,
    });

    res.status(200).json({
      success: true,
      message: `Seat ${seat.seatNumber} locked for 10 minutes.`,
      seat,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Release / Unlock a seat manually
// @route   POST /api/seats/:id/unlock
// @access  Private
const unlockSeat = async (req, res) => {
  try {
    const seatId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(seatId)) {
      return res.status(400).json({ success: false, message: 'Invalid seat ID format' });
    }

    const userId = req.user._id;

    const seat = await Seat.findOneAndUpdate(
      {
        _id: seatId,
        status: 'LOCKED',
        lockedBy: userId,
      },
      {
        $set: {
          status: 'AVAILABLE',
          lockedBy: null,
          lockedUntil: null,
        },
        $inc: { version: 1 },
      },
      { new: true }
    );

    if (!seat) {
      return res.status(400).json({
        success: false,
        message: 'Unable to unlock. You do not hold an active lock on this seat.',
      });
    }

    broadcastSeatUpdate('seat:unlocked', {
      seatId: seat._id,
      eventId: seat.eventId,
      seatNumber: seat.seatNumber,
      status: 'AVAILABLE',
    });

    res.status(200).json({
      success: true,
      message: `Seat ${seat.seatNumber} unlocked.`,
      seat,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getEventSeats,
  lockSeat,
  unlockSeat,
};