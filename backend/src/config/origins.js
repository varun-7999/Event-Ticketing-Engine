// Single source of truth for the CORS allow-list shared by the REST API
// (src/app.js) and Socket.IO (src/socket.js).
//
// FRONTEND_URL may hold a comma-separated list, so production plus Vercel
// preview/staging origins can all be whitelisted at once:
//   FRONTEND_URL=https://event-ticketing-engine.vercel.app,https://event-ticketing-engine-git-main-varun-7999.vercel.app
//
// Values are trimmed and trailing slashes removed, because pasting
// "https://app.vercel.app/" into a hosting dashboard is an easy mistake and the
// comparison below is an exact string match.

const LOCAL_DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:5174'];

// Strips surrounding whitespace and any trailing slash.
const normalizeOrigin = (origin) => String(origin ?? '').trim().replace(/\/+$/, '');

const allowedOrigins = [...String(process.env.FRONTEND_URL ?? '').split(','), ...LOCAL_DEV_ORIGINS]
  .map(normalizeOrigin)
  .filter(Boolean);

// Requests with no Origin header (curl, server-to-server webhooks, health
// checks) are always allowed: CORS is enforced by browsers, not by servers.
const isOriginAllowed = (origin) => !origin || allowedOrigins.includes(normalizeOrigin(origin));

console.log(`[CORS] Allowed origins: ${allowedOrigins.join(', ')}`);

module.exports = { allowedOrigins, isOriginAllowed, normalizeOrigin };
