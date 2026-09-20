const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../src/models/user.model');
const Event = require('../src/models/event.model');
const Seat = require('../src/models/seat.model');

const DEMO_EMAIL = 'demo.organizer@ticketengine.local';
const DEMO_TITLE = 'Summer Nights Live';

async function seedDemoEvent() {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });

  let organizer = await User.findOne({ email: DEMO_EMAIL });
  if (!organizer) {
    organizer = await User.create({
      name: 'Demo Organizer',
      email: DEMO_EMAIL,
      password: 'DemoPass123!',
      role: 'organizer',
    });
  }

  let event = await Event.findOne({ title: DEMO_TITLE, organizer: organizer._id });
  if (!event) {
    event = await Event.create({
      title: DEMO_TITLE,
      description: 'A demo concert event for testing the real-time seat map and checkout flow.',
      date: new Date('2027-07-24T19:30:00.000Z'),
      venue: 'Harbor Hall',
      totalSeats: 48,
      ticketPrice: 45,
      organizer: organizer._id,
    });
  }

  const existingSeatCount = await Seat.countDocuments({ eventId: event._id });
  if (existingSeatCount === 0) {
    const seats = [];
    for (let index = 0; index < event.totalSeats; index += 1) {
      const row = String.fromCharCode(65 + Math.floor(index / 10));
      const number = (index % 10) + 1;
      seats.push({
        eventId: event._id,
        seatNumber: `${row}${number}`,
        price: event.ticketPrice,
        status: 'AVAILABLE',
      });
    }
    await Seat.insertMany(seats);
  }

  console.log(JSON.stringify({
    eventId: event._id.toString(),
    title: event.title,
    seats: await Seat.countDocuments({ eventId: event._id }),
    url: `http://localhost:5174/events/${event._id}`,
  }, null, 2));
}

seedDemoEvent()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
