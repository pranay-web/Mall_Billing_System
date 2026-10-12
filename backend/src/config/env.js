import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const int = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const keyId = process.env.RAZORPAY_KEY_ID?.trim() || '';
const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || '';

/**
 * Payment mode is derived from the configured keys:
 *  - "test" / "live": real Razorpay Checkout with the matching key prefix
 *  - "mock": no keys configured — a local simulated gateway signs payments
 *            with an ephemeral secret so the HMAC verification path still runs.
 */
const paymentMode = !keyId || !keySecret ? 'mock' : keyId.startsWith('rzp_live_') ? 'live' : 'test';

const databasePath = process.env.DATABASE_PATH?.trim();

export const config = Object.freeze({
  env: process.env.NODE_ENV || 'development',
  port: int(process.env.PORT, 5005),
  corsOrigin: process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean) || true,

  mall: Object.freeze({
    name: process.env.MALL_NAME || 'Phoenix Grand Mall',
    legalName: process.env.MALL_LEGAL_NAME || 'FlashCart Retail Services Pvt. Ltd.',
    gstin: process.env.MALL_GSTIN || '29ABCDE1234F1Z5',
    address: process.env.MALL_ADDRESS || 'Whitefield Main Road, Bengaluru, Karnataka 560066',
  }),

  // SQLite file (created on first run). Use ":memory:" for throwaway databases.
  databasePath:
    databasePath === ':memory:'
      ? ':memory:'
      : path.resolve(backendRoot, databasePath || 'data/flashcart.db'),

  // Signs login tokens. Without it, everyone is signed out whenever the server restarts.
  authSecret: process.env.AUTH_SECRET || crypto.randomBytes(32).toString('hex'),
  customerTokenTtlHours: int(process.env.CUSTOMER_TOKEN_TTL_HOURS, 24 * 30),
  cashierTokenTtlHours: int(process.env.CASHIER_TOKEN_TTL_HOURS, 12),

  // First cashier account, created only when the cashiers table is empty.
  seedCashier: Object.freeze({
    email: process.env.SEED_CASHIER_EMAIL?.trim() || '',
    password: process.env.SEED_CASHIER_PASSWORD || '',
    name: process.env.SEED_CASHIER_NAME?.trim() || 'Desk Cashier',
  }),

  sessionTtlMinutes: int(process.env.SESSION_TTL_MINUTES, 240),
  maxLineQuantity: int(process.env.MAX_LINE_QUANTITY, 25),

  razorpay: Object.freeze({
    mode: paymentMode,
    keyId: paymentMode === 'mock' ? 'rzp_mock_flashcart' : keyId,
    keySecret: paymentMode === 'mock' ? crypto.randomBytes(24).toString('hex') : keySecret,
  }),
});
