Markdown
# Real-Time Event Ticketing Engine — System Specification

## Network & Environment
- Base REST API URL: http://localhost:5000/api
- WebSocket URL: http://localhost:5000
- Auth Header: `Authorization: Bearer <token>` (JWT stored in localStorage)

## Database Models & Data Shapes

### User
```typescript
{
  _id: string;
  name: string;
  email: string;
}
Seat
TypeScript
{
  _id: string;
  eventId: string;
  seatNumber: string; // e.g., "A1", "B5"
  price: number;
  status: 'AVAILABLE' | 'LOCKED' | 'BOOKED';
  lockedBy: string | null; // User ObjectId
  lockedUntil: string | null; // ISO Date String (10-minute hold window)
  version: number;
}
Booking
TypeScript
{
  _id: string;
  user: string;
  event: {
    _id: string;
    title: string;
    date: string;
    venue: string;
  };
  seats: Array<{
    _id: string;
    seatNumber: string;
    price: number;
  }>;
  totalAmount: number;
  paymentStatus: 'PAID' | 'PENDING';
  bookingReference: string; // e.g., "TKT-A8F9C12"
  createdAt: string;
}
REST API Contracts
Authentication (/api/auth)
POST /api/auth/register

Body: { name, email, password }

Returns: { success: true, token, user: { _id, name, email } }

POST /api/auth/login

Body: { email, password }

Returns: { success: true, token, user: { _id, name, email } }

Seats (/api/events)
GET /api/events/:eventId/seats

Public

Returns: { success: true, count: number, seats: Seat[] }

POST /api/seats/:id/lock

Protected (Bearer <token>)

Returns: { success: true, message: string, seat: Seat }

Error: 409 Conflict if seat is already locked or booked

POST /api/seats/:id/unlock

Protected (Bearer <token>)

Returns: { success: true, message: string, seat: Seat }

Bookings (/api/bookings)
POST /api/bookings/checkout

Protected (Bearer <token>)

Body: { seatId: string }

Returns: { success: true, message: string, booking: Booking }

GET /api/bookings/my-bookings

Protected (Bearer <token>)

Returns: { success: true, count: number, bookings: Booking[] }

WebSocket Architecture (Socket.IO)
Room Pattern: Scoped to specific events via event:<eventId>.

Client Emissions:

socket.emit('join:event', eventId) when entering an event seat map.

socket.emit('leave:event', eventId) when exiting the view.

Server Broadcasts (emitted to event:<eventId>):

seat:locked: { seatId, eventId, seatNumber, status: 'LOCKED', lockedUntil }

seat:unlocked: { seatId, eventId, seatNumber, status: 'AVAILABLE' }

seat:booked: { seatId, eventId, seatNumber, status: 'BOOKED' }

UI/UX Design System Standards
Theme: Dark-mode first (bg-slate-950), subtle borders (border-slate-800), glassmorphic panels (backdrop-blur-md bg-slate-900/70).

Status Colors:

AVAILABLE: Slate fill, green hover glow (border-slate-700 hover:border-emerald-500).

LOCKED (by others): Amber fill with pulse animation (bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse).

LOCKED (by current user): Cyan fill with glowing outline (bg-cyan-500 text-white shadow-[0_0_12px_rgba(6,182,212,0.5)]).

BOOKED: Charcoal gray, disabled cursor, low contrast.

Visual Architecture: Curved glowing auditorium stage at the top of the grid; Apple Wallet style pass with perforated tear-line and QR code on the tickets screen.