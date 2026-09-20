const Seat = require('../models/seat.model');
const { getIO } = require('../socket');

const cleanupExpiredLocks = async () => {
  try {
    const now = new Date();

    // Find all expired locks
    const expiredSeats = await Seat.find({
      status: 'LOCKED',
      lockedUntil: { $lt: now },
    });

    if (expiredSeats.length === 0) return;

    // Reset them to AVAILABLE in bulk
    const seatIds = expiredSeats.map((s) => s._id);
    await Seat.updateMany(
      { _id: { $in: seatIds } },
      {
        $set: {
          status: 'AVAILABLE',
          lockedBy: null,
          lockedUntil: null,
        },
        $inc: { version: 1 },
      }
    );

    // Broadcast unlock events to connected clients
    try {
      const io = getIO();
      expiredSeats.forEach((seat) => {
        io.to(`event:${seat.eventId}`).emit('seat:unlocked', {
          seatId: seat._id,
          eventId: seat.eventId,
          seatNumber: seat.seatNumber,
          status: 'AVAILABLE',
        });
      });
    } catch (socketErr) {
      // Socket not ready yet or no clients connected
    }

    console.log(`[SeatWorker] Cleaned up ${expiredSeats.length} expired seat lock(s).`);
  } catch (error) {
    console.error('[SeatWorker] Error running lock cleanup:', error.message);
  }
};

// Starts the worker interval (runs every 30 seconds)
const startSeatCleanupWorker = (intervalMs = 30000) => {
  setInterval(cleanupExpiredLocks, intervalMs);
  console.log(`[SeatWorker] Seat expiration worker started (interval: ${intervalMs / 1000}s)`);
};

module.exports = { startSeatCleanupWorker, cleanupExpiredLocks };