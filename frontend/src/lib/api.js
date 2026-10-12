import axios from 'axios';

const API_ROOT = `${(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}/api`;

export const http = axios.create({ baseURL: API_ROOT, timeout: 15_000 });

/** Storage can throw (private mode, blocked cookies) — never let that break the app. */
export const safeStorage = {
  get(key, store = globalThis.localStorage) {
    try {
      return store?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  set(key, value, store = globalThis.localStorage) {
    try {
      if (value === null || value === undefined) store?.removeItem(key);
      else store?.setItem(key, value);
    } catch {
      /* ignore */
    }
  },
};

// ---------- Signed-in accounts ----------
// Customers and cashiers are kept separately so one device can run both during a demo.

const AUTH_KEYS = { customer: 'flashcart.customer', cashier: 'flashcart.cashier' };
export const SIGNED_OUT_EVENT = 'flashcart:signed-out';

export const authStore = {
  get(role) {
    try {
      return JSON.parse(safeStorage.get(AUTH_KEYS[role]) ?? 'null');
    } catch {
      return null;
    }
  },
  set(role, account) {
    safeStorage.set(AUTH_KEYS[role], JSON.stringify(account));
  },
  clear(role) {
    safeStorage.set(AUTH_KEYS[role], null);
  },
};

/** Every failed call rejects with an ApiError carrying the server's error code and a human message. */
export class ApiError extends Error {
  constructor(message, { code = 'UNKNOWN', status = 0, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const normalizeError = (err) => {
  if (err.response) {
    const { status, data } = err.response;
    const e = data?.error;
    return new ApiError(e?.message || `Request failed with status ${status}.`, {
      code: e?.code || `HTTP_${status}`,
      status,
      details: e?.details,
    });
  }
  if (err.code === 'ECONNABORTED') {
    return new ApiError('The server took too long to respond. Check your connection and try again.', { code: 'TIMEOUT' });
  }
  return new ApiError("Can't reach the FlashCart server. Check your connection and make sure the backend is running.", {
    code: 'NETWORK',
  });
};

/**
 * `auth` names the account whose token to send (`customer` / `cashier`).
 * A 401 on an authenticated call signs that account out and notifies the app.
 */
const request = async (method, url, { data, params, signal, auth } = {}) => {
  const token = auth ? authStore.get(auth)?.token : null;
  try {
    const res = await http.request({
      method,
      url,
      data,
      params,
      signal,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return res.data;
  } catch (err) {
    if (axios.isCancel(err)) throw err;
    const apiError = normalizeError(err);
    if (auth && apiError.status === 401) {
      authStore.clear(auth);
      window.dispatchEvent(new CustomEvent(SIGNED_OUT_EVENT, { detail: { role: auth, reason: apiError.message } }));
    }
    throw apiError;
  }
};

const enc = encodeURIComponent;
const asCustomer = { auth: 'customer' };
const asCashier = { auth: 'cashier' };

export const api = {
  config: () => request('get', '/config'),

  auth: {
    customerLogin: (phone) => request('post', '/auth/customer/login', { data: { phone } }),
    cashierLogin: (email, password) => request('post', '/auth/cashier/login', { data: { email, password } }),
  },

  createSession: () => request('post', '/sessions', asCustomer),

  products: (params, signal) => request('get', '/products', { params, signal }),
  product: (code) => request('get', `/products/${enc(code)}`),

  cart: (sessionId) => request('get', `/cart/${enc(sessionId)}`, asCustomer),
  addToCart: (sessionId, barcode, quantity = 1) =>
    request('post', `/cart/${enc(sessionId)}/add`, { ...asCustomer, data: { barcode, quantity } }),
  updateItem: (sessionId, itemId, quantity) =>
    request('put', `/cart/${enc(sessionId)}/items/${enc(itemId)}`, { ...asCustomer, data: { quantity } }),
  removeItem: (sessionId, itemId) => request('delete', `/cart/${enc(sessionId)}/items/${enc(itemId)}`, asCustomer),

  createOrder: (sessionId) => request('post', '/razorpay/orders', { ...asCustomer, data: { sessionId } }),
  verifyPayment: (payload) => request('post', '/razorpay/verify', { ...asCustomer, data: payload }),
  mockPay: (payload) => request('post', '/razorpay/mock/pay', { ...asCustomer, data: payload }),
  payAtDesk: (sessionId) => request('post', '/checkout/payment', { ...asCustomer, data: { sessionId, method: 'cash' } }),

  receipt: (transactionId) => request('get', `/receipt/${enc(transactionId)}`, asCustomer),
  myReceipts: () => request('get', '/me/receipts', asCustomer),

  pos: {
    pending: () => request('get', '/pos/pending', asCashier),
    lookup: (code) => request('post', '/pos/lookup', { ...asCashier, data: { code } }),
    collect: (transactionId, cashReceived) =>
      request('post', `/pos/bills/${enc(transactionId)}/collect`, { ...asCashier, data: { cashReceived } }),
    shift: () => request('get', '/pos/shift', asCashier),
    openShift: (openingCash) => request('post', '/pos/shift/open', { ...asCashier, data: { openingCash } }),
    closeShift: (countedCash) => request('post', '/pos/shift/close', { ...asCashier, data: { countedCash } }),
  },
};
