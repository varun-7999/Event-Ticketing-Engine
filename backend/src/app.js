const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth.routes');
const eventRoutes = require('./routes/event.routes'); 
const seatRoutes = require('./routes/seat.routes');
const bookingRoutes = require('./routes/booking.routes');
const { handlePaymentWebhook } = require('./controllers/booking.controller');
const { allowedOrigins, isOriginAllowed } = require('./config/origins');
// 1. Require event routes
const app = express();
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) return callback(null, true);
      console.error(`[CORS] Blocked origin "${origin}". Allowed origins: ${allowedOrigins.join(', ')}`);
      return callback(null, false);
    },
    credentials: true,
  })
);
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), handlePaymentWebhook);
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes); // 2. Mount event routes
app.use('/api/seats', seatRoutes);
app.use('/api/bookings', bookingRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

module.exports = app;