import { badRequest, unauthorized } from '../lib/errors.js';
import { hashPassword, normalizeEmail, normalizeIndianMobile, signToken, verifyPassword } from '../lib/auth.js';

/** Customer (phone) and cashier (email + password) sign-in. */
export const createAuthService = ({ store, config }) => {
  // Used to keep response times similar whether or not the email exists.
  const dummyHash = hashPassword('flashcart-timing-guard');

  const customerLogin = ({ phone } = {}) => {
    const normalized = normalizeIndianMobile(phone);
    if (!normalized) {
      throw badRequest('INVALID_PHONE', 'Enter a valid 10-digit Indian mobile number.');
    }
    const customer = store.loginCustomer(normalized);
    const token = signToken({ sub: customer.id, role: 'customer', phone: customer.phone }, config.authSecret, config.customerTokenTtlHours);
    return { token, role: 'customer', customer: { id: customer.id, phone: customer.phone, isNew: customer.isNew } };
  };

  const cashierLogin = async ({ email, password } = {}) => {
    const normalized = normalizeEmail(email);
    if (!normalized || typeof password !== 'string' || !password) {
      throw badRequest('INVALID_CREDENTIALS', 'Enter your work email and password.');
    }
    const cashier = store.findCashierByEmail(normalized);
    const valid = cashier?.active
      ? await verifyPassword(password, cashier.passwordHash)
      : (await verifyPassword(password, await dummyHash), false);
    if (!valid) throw unauthorized('INVALID_CREDENTIALS', 'Incorrect email or password.');

    store.touchCashierLogin(cashier.id);
    const token = signToken({ sub: cashier.id, role: 'cashier', email: cashier.email }, config.authSecret, config.cashierTokenTtlHours);
    return { token, role: 'cashier', cashier: { id: cashier.id, email: cashier.email, name: cashier.name } };
  };

  /** Resolves a verified token payload to a live account (rejects deleted / disabled accounts). */
  const resolve = (payload) => {
    if (payload?.role === 'customer') {
      const customer = store.getCustomer(payload.sub);
      return customer ? { role: 'customer', id: customer.id, phone: customer.phone } : null;
    }
    if (payload?.role === 'cashier') {
      const cashier = store.getCashier(payload.sub);
      return cashier?.active ? { role: 'cashier', id: cashier.id, email: cashier.email, name: cashier.name } : null;
    }
    return null;
  };

  return { customerLogin, cashierLogin, resolve };
};
