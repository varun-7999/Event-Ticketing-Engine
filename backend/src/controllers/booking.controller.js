const crypto = require('crypto');
const mongoose = require('mongoose');
const Booking = require('../models/booking.model');
const Seat = require('../models/seat.model');
const User = require('../models/user.model');
const { getIO } = require('../socket');
const { sendBookingConfirmationEmail } = require('../services/email.service');
const {
  getRazorpayClient,
  verifyPaymentSignature,
  verifyWebhookSignature,
} = require('../services/razorpay.service');

const getValidHeldSeats = async (seatIds, userId, now, session) => {
  const query = Seat.find({
    _id: { $in: seatIds },
    status: 'LOCKED',
    lockedBy: userId,
    lockedUntil: { $gt: now },
  });
  if (session) query.session(session);
  const seats = await query;
  if (seats.length !== seatIds.length) throw new Error('One or more seat holds expired or changed.');
  return seats;
};

const sendConfirmationEmail = async (bookingId) => {
  const booking = await Booking.findOneAndUpdate(
    { _id: bookingId, paymentStatus: 'PAID', confirmationEmailSentAt: { $exists: false } },
    { $set: { confirmationEmailSentAt: new Date() } },
    { new: true }
  ).populate('event', 'title date venue').populate('seats', 'seatNumber price');
  if (!booking) return;

  try {
    const user = await User.findById(booking.user).select('name email');
    if (!user?.email) throw new Error('Booking user has no email address');
    await sendBookingConfirmationEmail({ to: user.email, userName: user.name, booking, event: booking.event });
  } catch (error) {
    await Booking.updateOne({ _id: bookingId }, { $unset: { confirmationEmailSentAt: 1 } });
    throw error;
  }
};

const createPaymentOrder = async (req, res) => {
  const seatIds = [...new Set(req.body.seatIds || [])];
  if (seatIds.length === 0 || seatIds.some((seatId) => !mongoose.Types.ObjectId.isValid(seatId))) {
    return res.status(400).json({ success: false, message: 'Valid seat IDs are required' });
  }

  try {
    const seats = await getValidHeldSeats(seatIds, req.user._id, new Date());
    const totalAmount = seats.reduce((sum, seat) => sum + seat.price, 0);
    const razorpayOrder = await getRazorpayClient().orders.create({
      amount: Math.round(totalAmount * 100),
      currency: 'INR',
      receipt: `rcpt_${crypto.randomBytes(8).toString('hex')}`,
      notes: { userId: req.user._id.toString(), seatCount: String(seats.length) },
    });
    const booking = await Booking.create({
      user: req.user._id,
      event: seats[0].eventId,
      seats: seatIds,
      totalAmount,
      paymentStatus: 'PENDING',
      paymentOrderId: razorpayOrder.id,
      bookingReference: `TKT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
    });

    return res.status(201).json({
      success: true,
      keyId: process.env.RAZORPAY_KEY_ID,
      order: { id: razorpayOrder.id, amount: razorpayOrder.amount, currency: razorpayOrder.currency },
      bookingId: booking._id,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const verifyPayment = async (req, res) => {
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature, bookingId } = req.body;
  if (!orderId || !paymentId || !signature || !bookingId) {
    return res.status(400).json({ success: false, message: 'Payment verification details are required' });
  }
  if (!verifyPaymentSignature(orderId, paymentId, signature)) {
    return res.status(400).json({ success: false, message: 'Invalid payment signature' });
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const booking = await Booking.findOne({ _id: bookingId, user: req.user._id, paymentOrderId: orderId, paymentStatus: 'PENDING' }).session(session);
    if (!booking) throw new Error('Payment order was not found or has already been processed.');
    const seats = await getValidHeldSeats(booking.seats, req.user._id, new Date(), session);
    for (const seat of seats) {
      seat.status = 'BOOKED';
      seat.lockedUntil = null;
      seat.bookingId = booking._id;
      seat.version += 1;
      await seat.save({ session });
    }
    booking.paymentStatus = 'PAID';
    booking.paymentId = paymentId;
    booking.paymentSignature = signature;
    await booking.save({ session });
    await session.commitTransaction();
    await session.endSession();
    seats.forEach(broadcastBookedSeat);
    const populatedBooking = await Booking.findById(booking._id).populate('event', 'title date venue ticketPrice').populate('seats', 'seatNumber price status');
    sendConfirmationEmail(populatedBooking._id).catch((error) => console.error('[Email] Booking confirmation failed:', error.message));
    return res.status(200).json({ success: true, booking: populatedBooking });
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    await session.endSession();
    return res.status(400).json({ success: false, message: error.message });
  }
};

const handlePaymentWebhook = async (req, res) => {
  if (!verifyWebhookSignature(req.body, req.headers['x-razorpay-signature'])) {
    return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
  }

  let payload;
  try {
    payload = JSON.parse(req.body.toString('utf8'));
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Invalid webhook payload' });
  }

  const event = payload.event;
  const paymentEntity = payload.payload?.payment?.entity;
  const orderId = paymentEntity?.order_id;
  if (!orderId) return res.status(200).json({ success: true });

  if (event === 'payment.failed') {
    await Booking.updateOne(
      { paymentOrderId: orderId, paymentStatus: 'PENDING' },
      { $set: { paymentStatus: 'FAILED', paymentId: paymentEntity.id } }
    );
    const failedBooking = await Booking.findOne({ paymentOrderId: orderId });
    if (failedBooking) {
      await Seat.updateMany(
        { _id: { $in: failedBooking.seats }, status: 'LOCKED', lockedBy: failedBooking.user },
        { $set: { status: 'AVAILABLE', lockedBy: null, lockedUntil: null }, $inc: { version: 1 } }
      );
    }
    return res.status(200).json({ success: true });
  }

  if (event !== 'payment.captured' && event !== 'order.paid') {
    return res.status(200).json({ success: true });
  }

  const booking = await Booking.findOne({ paymentOrderId: orderId, paymentStatus: 'PENDING' });
  if (!booking) return res.status(200).json({ success: true });

  const seats = await getValidHeldSeats(booking.seats, booking.user, new Date());
  await Seat.updateMany(
    { _id: { $in: seats.map((seat) => seat._id) }, status: 'LOCKED', lockedBy: booking.user },
    { $set: { status: 'BOOKED', lockedUntil: null, bookingId: booking._id }, $inc: { version: 1 } }
  );
  await Booking.updateOne(
    { _id: booking._id, paymentStatus: 'PENDING' },
    { $set: { paymentStatus: 'PAID', paymentId: paymentEntity.id } }
  );
  seats.forEach(broadcastBookedSeat);
  sendConfirmationEmail(booking._id).catch((error) => console.error('[Email] Booking confirmation failed:', error.message));
  return res.status(200).json({ success: true });
};

const markPaymentFailed = async (req, res) => {
  const { bookingId, orderId, paymentId, reason } = req.body;
  if (!bookingId || !orderId) {
    return res.status(400).json({ success: false, message: 'Booking and order IDs are required' });
  }

  try {
    const booking = await Booking.findOneAndUpdate(
      { _id: bookingId, user: req.user._id, paymentOrderId: orderId, paymentStatus: 'PENDING' },
      { $set: { paymentStatus: 'FAILED', paymentId: paymentId || null, paymentFailureReason: reason || 'Payment failed' } },
      { new: true }
    );
    if (!booking) return res.status(404).json({ success: false, message: 'Pending payment was not found' });

    const seats = await Seat.find({ _id: { $in: booking.seats }, status: 'LOCKED', lockedBy: req.user._id });
    await Seat.updateMany(
      { _id: { $in: seats.map((seat) => seat._id) }, status: 'LOCKED', lockedBy: req.user._id },
      { $set: { status: 'AVAILABLE', lockedBy: null, lockedUntil: null }, $inc: { version: 1 } }
    );
    seats.forEach((seat) => {
      try {
        getIO().to(`event:${seat.eventId}`).emit('seat:unlocked', {
          seatId: seat._id,
          eventId: seat.eventId,
          seatNumber: seat.seatNumber,
          status: 'AVAILABLE',
        });
      } catch (error) {
        // Payment status remains persisted if live broadcasting is unavailable.
      }
    });
    return res.status(200).json({ success: true, booking });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Confirm booking for a locked seat & create ticket receipt
// @route   POST /api/bookings/checkout
// @access  Private
const checkoutSeat = async (req, res) => {
  try {
    const { seatId } = req.body;
    if (!seatId || !mongoose.Types.ObjectId.isValid(seatId)) {
      return res.status(400).json({ success: false, message: 'Valid seat ID is required' });
    }

    const userId = req.user._id;
    const now = new Date();
    const seat = await Seat.findOneAndUpdate(
      { _id: seatId, status: 'LOCKED', lockedBy: userId, lockedUntil: { $gt: now } },
      { $set: { status: 'BOOKED', lockedUntil: null }, $inc: { version: 1 } },
      { new: true }
    );

    if (!seat) {
      return res.status(400).json({ success: false, message: 'Checkout failed. Lock has expired or seat was modified.' });
    }

    let booking;
    try {
      booking = await Booking.create({
        user: userId,
        event: seat.eventId,
        seats: [seat._id],
        totalAmount: seat.price,
        paymentStatus: 'PAID',
        bookingReference: `TKT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      });
      seat.bookingId = booking._id;
      await seat.save();
    } catch (bookingError) {
      if (booking?._id) await Booking.deleteOne({ _id: booking._id });
      await restoreHeldSeats([seat._id], userId, now);
      throw bookingError;
    }

    broadcastBookedSeat(seat);
    return res.status(201).json({ success: true, message: 'Booking confirmed successfully', booking });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const restoreHeldSeats = async (seatIds, userId, now) => {
  await Seat.updateMany(
    { _id: { $in: seatIds }, status: 'BOOKED', lockedBy: userId },
    {
      $set: { status: 'LOCKED', lockedUntil: new Date(now.getTime() + 10 * 60 * 1000), bookingId: null },
      $inc: { version: 1 },
    }
  );
};

const broadcastBookedSeat = (seat) => {
  try {
    getIO().to(`event:${seat.eventId}`).emit('seat:booked', {
      seatId: seat._id,
      eventId: seat.eventId,
      seatNumber: seat.seatNumber,
      status: 'BOOKED',
    });
  } catch (error) {
    console.error('Socket broadcast error:', error.message);
  }
};

// @desc    Confirm multiple locked seats as one checkout operation
// @route   POST /api/bookings/checkout-many
// @access  Private
const checkoutSeats = async (req, res) => {
  const seatIds = [...new Set(req.body.seatIds || [])];
  const userId = req.user._id;
  const now = new Date();
  const bookings = [];

  if (seatIds.length === 0 || seatIds.some((seatId) => !mongoose.Types.ObjectId.isValid(seatId))) {
    return res.status(400).json({ success: false, message: 'Valid seat IDs are required' });
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    for (const seatId of seatIds) {
      const seat = await Seat.findOneAndUpdate(
        { _id: seatId, status: 'LOCKED', lockedBy: userId, lockedUntil: { $gt: now } },
        { $set: { status: 'BOOKED', lockedUntil: null }, $inc: { version: 1 } },
        { new: true, session }
      );
      if (!seat) throw new Error('Checkout failed. One or more seat holds expired or changed.');

      const booking = await Booking.create({
        user: userId,
        event: seat.eventId,
        seats: [seat._id],
        totalAmount: seat.price,
        paymentStatus: 'PAID',
        bookingReference: `TKT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      }, { session });
      seat.bookingId = booking._id;
      await seat.save({ session });
      bookings.push(booking);
    }

    await session.commitTransaction();
    await session.endSession();

    for (const booking of bookings) {
      const seat = await Seat.findById(booking.seats[0]);
      if (seat) broadcastBookedSeat(seat);
    }
    return res.status(201).json({ success: true, message: 'Booking confirmed successfully', bookings });
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    await session.endSession();
    return res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get all bookings for the currently authenticated user
// @route   GET /api/bookings/my-bookings
// @access  Private
const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id })
      .populate('event', 'title date venue ticketPrice')
      .populate('seats', 'seatNumber price status')
      .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: bookings.length, bookings });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  checkoutSeat,
  checkoutSeats,
  createPaymentOrder,
  verifyPayment,
  markPaymentFailed,
  handlePaymentWebhook,
  getMyBookings,
};