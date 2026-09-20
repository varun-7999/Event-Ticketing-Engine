const nodemailer = require('nodemailer');

function getTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.EMAIL_FROM) {
    throw new Error('SMTP email is not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and EMAIL_FROM.');
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_PORT) === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function sendBookingConfirmationEmail({ to, userName, booking, event }) {
  const seatNumbers = (booking.seats || []).map((seat) => seat.seatNumber || seat).join(', ');
  const eventDate = event?.date ? new Date(event.date).toLocaleString() : 'Date to be announced';
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(booking.bookingReference)}`;

  return getTransporter().sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: `Your TicketEngine booking ${booking.bookingReference}`,
    html: `<!doctype html>
<html><body style="margin:0;background:#020617;color:#e2e8f0;font-family:Arial,sans-serif;padding:24px">
  <div style="max-width:600px;margin:0 auto;background:#0f172a;border:1px solid #1e293b;border-radius:16px;overflow:hidden">
    <div style="padding:28px 24px;border-bottom:1px solid #1e293b">
      <div style="color:#67e8f9;font-size:12px;letter-spacing:3px;text-transform:uppercase">TicketEngine</div>
      <h1 style="margin:12px 0 0;color:#f8fafc;font-size:24px">Booking confirmed</h1>
      <p style="margin:8px 0 0;color:#94a3b8">Hi ${escapeHtml(userName)}, your payment was successful.</p>
    </div>
    <div style="padding:24px">
      <h2 style="margin:0 0 16px;color:#f8fafc;font-size:20px">${escapeHtml(event?.title || 'Your event')}</h2>
      <p style="margin:8px 0;color:#cbd5e1"><strong>Venue:</strong> ${escapeHtml(event?.venue || 'Venue to be announced')}</p>
      <p style="margin:8px 0;color:#cbd5e1"><strong>Date:</strong> ${escapeHtml(eventDate)}</p>
      <p style="margin:8px 0;color:#cbd5e1"><strong>Seats:</strong> ${escapeHtml(seatNumbers || 'See your ticket')}</p>
      <p style="margin:8px 0;color:#cbd5e1"><strong>Total paid:</strong> INR ${Number(booking.totalAmount || 0).toFixed(2)}</p>
      <div style="margin-top:24px;padding:16px;border:1px solid #334155;border-radius:12px;background:#1e293b;text-align:center">
        <div style="color:#94a3b8;font-size:11px;letter-spacing:2px;text-transform:uppercase">Booking reference</div>
        <div style="margin-top:8px;color:#f8fafc;font-family:monospace;font-size:18px;font-weight:bold">${escapeHtml(booking.bookingReference)}</div>
        <img src="${qrUrl}" alt="Check-in QR code" width="150" height="150" style="display:block;margin:16px auto 0;background:#fff;padding:8px;border-radius:8px" />
      </div>
    </div>
    <div style="padding:18px 24px;border-top:1px solid #1e293b;color:#64748b;font-size:12px">Present this QR code at the venue for check-in.</div>
  </div>
</body></html>`,
  });
}

module.exports = { sendBookingConfirmationEmail };
