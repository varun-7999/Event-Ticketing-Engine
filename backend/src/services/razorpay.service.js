const crypto = require('crypto');
const Razorpay = require('razorpay');

function getRazorpayClient() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
  }

  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

function verifyPaymentSignature(orderId, paymentId, signature) {
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  const actual = Buffer.from(signature || '');
  const expected = Buffer.from(expectedSignature);
  return actual.length === expected.length && crypto.timingSafeEqual(expected, actual);
}

function verifyWebhookSignature(rawBody, signature) {
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || '')
    .update(rawBody)
    .digest('hex');

  const actual = Buffer.from(signature || '');
  const expected = Buffer.from(expectedSignature);
  return actual.length === expected.length && crypto.timingSafeEqual(expected, actual);
}

module.exports = { getRazorpayClient, verifyPaymentSignature, verifyWebhookSignature };