const test = require('node:test');
const assert = require('node:assert/strict');
const { requireRole } = require('../src/middleware/auth.middleware');

function responseDouble() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('requireRole allows an organizer', () => {
  const response = responseDouble();
  let nextCalled = false;

  requireRole('organizer')({ user: { role: 'organizer' } }, response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(response.statusCode, null);
});

test('requireRole rejects an attendee', () => {
  const response = responseDouble();
  let nextCalled = false;

  requireRole('organizer')({ user: { role: 'attendee' } }, response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(response.statusCode, 403);
  assert.equal(response.body.success, false);
});