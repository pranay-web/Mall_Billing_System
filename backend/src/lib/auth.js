import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);

// ---------- Signed tokens ----------
// Compact HMAC-SHA256 tokens: base64url(JSON payload) + "." + base64url(signature).

export const signToken = (payload, secret, ttlHours) => {
  const exp = Math.floor(Date.now() / 1000) + Math.round(ttlHours * 3600);
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
};

/** Returns the payload of a valid, unexpired token — otherwise null. */
export const verifyToken = (token, secret) => {
  const [body, sig] = String(token ?? '').split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', secret).update(body).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return payload.exp > Date.now() / 1000 ? payload : null;
  } catch {
    return null;
  }
};

// ---------- Passwords (scrypt) ----------

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LENGTH = 64;

/** Stored as `scrypt$N$r$p$salt$hash` so parameters can be raised later without breaking old hashes. */
export const hashPassword = async (password) => {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH, SCRYPT_PARAMS);
  const { N, r, p } = SCRYPT_PARAMS;
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
};

export const verifyPassword = async (password, stored) => {
  const [scheme, N, r, p, salt, hash] = String(stored ?? '').split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = await scrypt(String(password), Buffer.from(salt, 'base64url'), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
    maxmem: SCRYPT_PARAMS.maxmem,
  });
  return crypto.timingSafeEqual(actual, expected);
};

// ---------- Identifiers ----------

/** Normalises Indian mobile numbers to E.164 (`+919876543210`). Accepts +91 / 91 / 0 prefixes and spaces. */
export const normalizeIndianMobile = (input) => {
  const compact = String(input ?? '').replace(/[\s\-().]/g, '');
  const match = compact.match(/^(?:\+?91|0)?([6-9]\d{9})$/);
  return match ? `+91${match[1]}` : null;
};

/** `+919876543210` → `+91 ••••••3210` — enough for a cashier to confirm with the customer. */
export const maskPhone = (e164) => (e164 ? `+91 ••••••${e164.slice(-4)}` : null);

export const normalizeEmail = (input) => {
  const email = String(input ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254 ? email : null;
};
