import crypto from 'node:crypto';

// Crockford-style alphabet without look-alikes (0/O, 1/I/L) — safe to read aloud or type at a desk.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

const randomCode = (length) =>
  Array.from({ length }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');

/** Customer session handle, e.g. `FC-7KQ2MX`. */
export const newSessionId = () => `FC-${randomCode(6)}`;

/** Bill / transaction handle, e.g. `TX-9H4K2W7Q`. */
export const newTransactionId = () => `TX-${randomCode(8)}`;

/** Indian financial year label (April–March), e.g. `2627` for FY 2026-27. */
export const financialYear = (date = new Date()) => {
  const start = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  return `${String(start).slice(-2)}${String(start + 1).slice(-2)}`;
};
