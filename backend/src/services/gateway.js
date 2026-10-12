import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { badGateway, badRequest, forbidden } from '../lib/errors.js';

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

const describeRazorpayError = (err) => {
  if (err?.statusCode === 401) {
    return 'Razorpay rejected the API credentials. Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.';
  }
  return err?.error?.description || err?.message || 'Unknown gateway error.';
};

/**
 * Thin wrapper around Razorpay. With no keys configured it runs a local
 * "mock" gateway that signs payments with an ephemeral secret, so the exact
 * same HMAC-SHA256 verification path is exercised end to end.
 */
export const createGateway = ({ razorpay: { mode, keyId, keySecret } }) => {
  const client = mode === 'mock' ? null : new Razorpay({ key_id: keyId, key_secret: keySecret });
  const mockPayments = new Map();

  const sign = (orderId, paymentId) =>
    crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');

  return {
    mode,
    keyId,

    async createOrder({ amount, receipt, notes }) {
      if (mode === 'mock') {
        return { id: `order_mock${crypto.randomBytes(7).toString('hex')}`, amount, currency: 'INR', status: 'created' };
      }
      try {
        return await withTimeout(
          client.orders.create({ amount, currency: 'INR', receipt, notes, payment_capture: 1 }),
          10_000,
        );
      } catch (err) {
        console.error('[razorpay] order creation failed:', describeRazorpayError(err));
        throw badGateway('GATEWAY_ERROR', `Could not reach the payment gateway: ${describeRazorpayError(err)}`);
      }
    },

    /** Constant-time check of Razorpay's `HMAC_SHA256(order_id|payment_id, key_secret)`. */
    verifySignature({ orderId, paymentId, signature }) {
      if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false;
      const expected = Buffer.from(sign(orderId, paymentId), 'hex');
      return crypto.timingSafeEqual(expected, Buffer.from(signature, 'hex'));
    },

    /** Best-effort lookup of how the customer paid (UPI / card / …) for the invoice. */
    async fetchPaymentDetails(paymentId) {
      if (mode === 'mock') return mockPayments.get(paymentId) ?? null;
      try {
        const p = await withTimeout(client.payments.fetch(paymentId, { 'expand[]': 'card' }), 4_000);
        return {
          method: p.method,
          vpa: p.vpa || null,
          bank: p.bank || null,
          wallet: p.wallet || null,
          cardNetwork: p.card?.network || null,
          cardLast4: p.card?.last4 || null,
        };
      } catch (err) {
        console.warn('[razorpay] could not fetch payment details:', describeRazorpayError(err));
        return null;
      }
    },

    /** Mock mode only: plays the role of Razorpay Checkout and returns a signed payment. */
    simulatePayment({ orderId, method = 'upi', outcome = 'success' }) {
      if (mode !== 'mock') {
        throw forbidden('MOCK_DISABLED', 'The simulated gateway is only available when Razorpay keys are not configured.');
      }
      if (!['upi', 'card'].includes(method)) throw badRequest('INVALID_METHOD', 'Unsupported payment method.');
      if (outcome !== 'success') {
        return {
          error: {
            code: 'BAD_REQUEST_ERROR',
            description: method === 'upi' ? 'Payment was declined by the UPI app.' : 'Your bank declined this card transaction.',
            reason: 'payment_failed',
          },
        };
      }
      const paymentId = `pay_mock${crypto.randomBytes(7).toString('hex')}`;
      mockPayments.set(
        paymentId,
        method === 'upi'
          ? { method: 'upi', vpa: 'success@razorpay' }
          : { method: 'card', cardNetwork: 'Visa', cardLast4: '1111' },
      );
      return {
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: sign(orderId, paymentId),
      };
    },
  };
};
