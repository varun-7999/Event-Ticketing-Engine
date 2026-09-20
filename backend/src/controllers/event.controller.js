const Event = require('../models/event.model');
const Seat = require('../models/seat.model');

// Helper: Generate seats array (e.g., 50 seats -> Rows A to E, 10 seats per row)
const generateSeatsData = (eventId, totalSeats, price) => {
  const seats = [];
  const seatsPerRow = 10;
  const rows = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  for (let i = 0; i < totalSeats; i++) {
    const rowIndex = Math.floor(i / seatsPerRow);
    const seatInRow = (i % seatsPerRow) + 1;
    const rowLetter = rows[rowIndex] || `R${rowIndex + 1}`;
    const seatNumber = `${rowLetter}${seatInRow}`;

    seats.push({
      eventId,
      seatNumber,
      price,
      status: 'AVAILABLE',
    });   
  }

  return seats;
};

// @desc    Create new Event & generate its seat map
// @route   POST /api/events
// @access  Private (Logged-in users)
const createEvent = async (req, res) => {
  try {
    const { title, description, date, venue, totalSeats, ticketPrice } = req.body;

    if (!title || !description || !date || !venue || !totalSeats || ticketPrice === undefined) {
      return res.status(400).json({ success: false, message: 'Please fill all required fields' });
    }

    // 1. Create the Event record
    const event = await Event.create({
      title,
      description,
      date,
      venue,
      totalSeats,
      ticketPrice,
      organizer: req.user._id, // Provided by the protect middleware
    });

    // 2. Build seat definitions
    const seatsToInsert = generateSeatsData(event._id, totalSeats, ticketPrice);

    // 3. Batch insert all seats atomically into MongoDB
    await Seat.insertMany(seatsToInsert);

    res.status(201).json({
      success: true,
      message: `Event created successfully with ${totalSeats} generated seats.`,
      event,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all upcoming events
// @route   GET /api/events
// @access  Public
const getAllEvents = async (req, res) => {
  try {
    const events = await Event.find({ date: { $gte: new Date() } }).populate('organizer', 'name email').sort({ date: 1 });
    res.status(200).json({ success: true, count: events.length, events });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateEvent = async (req, res) => {
  try {
    const { title, description, date, venue, totalSeats, ticketPrice } = req.body;
    const event = req.event;
    const nextTotalSeats = totalSeats === undefined ? event.totalSeats : Number(totalSeats);
    const nextTicketPrice = ticketPrice === undefined ? event.ticketPrice : Number(ticketPrice);

    if (!title || !description || !date || !venue || !Number.isInteger(nextTotalSeats) || nextTotalSeats < 1 || !Number.isFinite(nextTicketPrice) || nextTicketPrice < 0) {
      return res.status(400).json({ success: false, message: 'Please provide valid event details' });
    }

    if (nextTotalSeats !== event.totalSeats) {
      const activeSeats = await Seat.countDocuments({ eventId: event._id, status: { $ne: 'AVAILABLE' } });
      if (activeSeats > 0) {
        return res.status(400).json({ success: false, message: 'Seat count cannot change while seats are held or booked.' });
      }
      await Seat.deleteMany({ eventId: event._id });
      await Seat.insertMany(generateSeatsData(event._id, nextTotalSeats, nextTicketPrice));
    } else if (nextTicketPrice !== event.ticketPrice) {
      await Seat.updateMany({ eventId: event._id, status: 'AVAILABLE' }, { $set: { price: nextTicketPrice } });
    }

    event.title = title;
    event.description = description;
    event.date = date;
    event.venue = venue;
    event.totalSeats = nextTotalSeats;
    event.ticketPrice = nextTicketPrice;
    await event.save();

    return res.status(200).json({ success: true, event });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const deleteEvent = async (req, res) => {
  try {
    const bookedSeats = await Seat.exists({ eventId: req.event._id, status: 'BOOKED' });
    if (bookedSeats) {
      return res.status(400).json({ success: false, message: 'Cannot delete an event with active bookings. Please cancel or archive it instead.' });
    }

    await Seat.deleteMany({ eventId: req.event._id });
    await Event.deleteOne({ _id: req.event._id });
    return res.status(200).json({ success: true, message: 'Event deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

//  Get single event with its full seat layout
//  GET /api/events/:id/seats
// @access  Public
const getEventSeatMap = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    // Fetch all seats belonging to this event
    const seats = await Seat.find({ eventId: req.params.id }).sort({ seatNumber: 1 });

    res.status(200).json({
      success: true,
      event,
      totalSeats: seats.length,
      seats,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createEvent,
  getAllEvents,
  getEventSeatMap,
  updateEvent,
  deleteEvent,
};