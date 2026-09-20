const test = require('node:test');
const assert = require('node:assert/strict');

const ORIGINS_MODULE = require.resolve('../src/config/origins');

// The allow-list is built from the environment at load time, so each test
// reloads the module with a different FRONTEND_URL value.
function loadOrigins(frontendUrl) {
  delete require.cache[ORIGINS_MODULE];
  if (frontendUrl === undefined) {
    delete process.env.FRONTEND_URL;
  } else {
    process.env.FRONTEND_URL = frontendUrl;
  }
  return require(ORIGINS_MODULE);
}

test('allows the production origin exactly as configured', () => {
  const { isOriginAllowed } = loadOrigins('https://event-ticketing-engine.vercel.app');
  assert.equal(isOriginAllowed('https://event-ticketing-engine.vercel.app'), true);
});

test('tolerates a trailing slash in FRONTEND_URL', () => {
  const { isOriginAllowed } = loadOrigins('https://event-ticketing-engine.vercel.app/');
  assert.equal(isOriginAllowed('https://event-ticketing-engine.vercel.app'), true);
});

test('accepts a comma-separated list of origins with surrounding whitespace', () => {
  const { isOriginAllowed } = loadOrigins(' https://app.example.com , https://preview-app.vercel.app/ ');
  assert.equal(isOriginAllowed('https://app.example.com'), true);
  assert.equal(isOriginAllowed('https://preview-app.vercel.app'), true);
});

test('always allows the local Vite dev servers', () => {
  const { isOriginAllowed } = loadOrigins(undefined);
  assert.equal(isOriginAllowed('http://localhost:5173'), true);
  assert.equal(isOriginAllowed('http://localhost:5174'), true);
});

test('rejects an origin that is not whitelisted', () => {
  const { isOriginAllowed } = loadOrigins('https://event-ticketing-engine.vercel.app');
  assert.equal(isOriginAllowed('https://evil.example.com'), false);
});

test('allows requests without an Origin header (curl, webhooks, health checks)', () => {
  const { isOriginAllowed } = loadOrigins('https://event-ticketing-engine.vercel.app');
  assert.equal(isOriginAllowed(undefined), true);
  assert.equal(isOriginAllowed(''), true);
});
