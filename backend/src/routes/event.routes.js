const express = require('express');
const { createEvent, getAllEvents, getEventSeatMap, updateEvent, deleteEvent } = require('../controllers/event.controller');
const { protect, requireRole, verifyOrganizerOrAdmin } = require('../middleware/auth.middleware');

const router = express.Router();

// Public: View all events
router.get('/', getAllEvents);

// Public: View seat arrangement for a specific event
router.get('/:id/seats', getEventSeatMap);

// Protected: Only logged-in users/organizers can publish events
router.post('/', protect, requireRole('organizer', 'admin'), createEvent);
router.put('/:id', protect, verifyOrganizerOrAdmin, updateEvent);
router.delete('/:id', protect, verifyOrganizerOrAdmin, deleteEvent);

module.exports = router;
