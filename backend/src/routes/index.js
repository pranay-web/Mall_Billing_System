import { Router } from 'express';
import { CATEGORIES, SHOWROOMS } from '../data/catalog.js';
import { notFound } from '../lib/errors.js';
import { rateLimit } from '../lib/rateLimit.js';
import { requireRole } from '../middleware/http.js';

const publicProduct = ({ id, barcode, sku, name, description, price, mrp, gstRate, hsn, category, showroomId, showroom, stock }) => ({
  id,
  barcode,
  sku,
  name,
  description,
  price,
  // Shelf price incl. GST: the tag MRP for real retail items, else price + GST.
  mrp: mrp ?? Math.round(price * (100 + gstRate)) / 100,
  gstRate,
  hsn,
  category,
  showroomId,
  showroom,
  stock,
  inStock: stock > 0,
});

export const createApiRouter = ({ config, store, auth, sessions, checkout, cashDesk }) => {
  const api = Router();
  const customer = requireRole('customer');
  const cashier = requireRole('cashier');
  const own = (req) => ({ customerId: req.account.id });

  // ---------- Meta ----------
  api.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: Math.round(process.uptime()), time: new Date().toISOString() });
  });

  api.get('/config', (_req, res) => {
    res.json({
      mall: config.mall,
      currency: 'INR',
      payments: { mode: config.razorpay.mode, keyId: config.razorpay.keyId },
    });
  });

  // ---------- Auth ----------
  const loginLimiter = (scope, max) =>
    rateLimit({
      windowMs: 10 * 60_000,
      max,
      key: (req) => `${scope}:${req.ip}:${String(req.body?.email ?? req.body?.phone ?? '').toLowerCase()}`,
      message: 'Too many sign-in attempts. Please wait a few minutes and try again.',
    });

  api.post('/auth/customer/login', loginLimiter('customer', 20), (req, res) => {
    res.json(auth.customerLogin(req.body));
  });

  api.post('/auth/cashier/login', loginLimiter('cashier', 8), async (req, res) => {
    res.json(await auth.cashierLogin(req.body));
  });

  api.get('/auth/me', requireRole('customer', 'cashier'), (req, res) => {
    res.json({ account: req.account });
  });

  // ---------- Sessions (one open bag per customer) ----------
  api.post('/sessions', customer, (req, res) => {
    const { session, created } = sessions.openForCustomer(req.account.id);
    res.status(created ? 201 : 200).json(sessions.describe(session));
  });

  api.get('/sessions/:sessionId', customer, (req, res) => {
    res.json(sessions.describe(sessions.get(req.params.sessionId, own(req))));
  });

  // ---------- Catalog (public) ----------
  api.get('/products', (req, res) => {
    const category = String(req.query.category ?? '').toLowerCase();
    const showroom = String(req.query.showroom ?? '').toLowerCase();
    const q = String(req.query.q ?? '').trim().toLowerCase();
    const all = store.listProducts();

    const products = all.filter(
      (p) =>
        (!category || category === 'all' || p.category === category) &&
        (!showroom || p.showroomId === showroom) &&
        (!q || [p.name, p.description, p.barcode, p.sku, p.showroom].some((f) => f.toLowerCase().includes(q))),
    );

    res.json({
      products: products.map(publicProduct),
      categories: CATEGORIES.map((c) => ({ ...c, count: all.filter((p) => p.category === c.id).length })),
      showrooms: SHOWROOMS,
    });
  });

  api.get('/products/:barcode', (req, res) => {
    const product = store.findProductByCode(req.params.barcode);
    if (!product) {
      throw notFound('PRODUCT_NOT_FOUND', `No product matches barcode “${req.params.barcode}”.`);
    }
    res.json(publicProduct(product));
  });

  // ---------- Cart ----------
  api.get('/cart/:sessionId', customer, (req, res) => {
    res.json(sessions.cartView(sessions.get(req.params.sessionId, own(req))));
  });

  api.post('/cart/:sessionId/add', customer, (req, res) => {
    res.status(201).json(sessions.addItem(req.params.sessionId, req.body, own(req)));
  });

  api.put('/cart/:sessionId/items/:itemId', customer, (req, res) => {
    res.json(sessions.updateQuantity(req.params.sessionId, req.params.itemId, req.body, own(req)));
  });

  api.delete('/cart/:sessionId/items/:itemId', customer, (req, res) => {
    res.json(sessions.removeItem(req.params.sessionId, req.params.itemId, own(req)));
  });

  // ---------- Payments ----------
  api.post('/razorpay/orders', customer, async (req, res) => {
    res.status(201).json(await checkout.createOrder(req.body, own(req)));
  });

  api.post('/razorpay/verify', customer, async (req, res) => {
    res.json(await checkout.verifyPayment(req.body, own(req)));
  });

  // Simulated Razorpay Checkout — only active when no Razorpay keys are configured.
  api.post('/razorpay/mock/pay', customer, (req, res) => {
    res.json(checkout.simulatePayment(req.body, own(req)));
  });

  // Cash: issues the bill now; the customer pays at the cash desk.
  api.post('/checkout/payment', customer, (req, res) => {
    res.status(201).json(checkout.createCashBill(req.body, own(req)));
  });

  // ---------- Receipts ----------
  api.get('/receipt/:transactionId', requireRole('customer', 'cashier'), (req, res) => {
    res.json(checkout.getReceiptFor(req.params.transactionId, req.account));
  });

  api.get('/me/receipts', customer, (req, res) => {
    res.json({ receipts: checkout.listForCustomer(req.account.id) });
  });

  // ---------- Cash desk (cashiers only) ----------
  const desk = Router();
  desk.use(cashier);

  desk.get('/pending', (_req, res) => {
    res.json({ bills: cashDesk.pending() });
  });

  desk.post('/lookup', (req, res) => {
    res.json(cashDesk.lookup(req.body?.code));
  });

  desk.post('/bills/:transactionId/collect', (req, res) => {
    res.json(cashDesk.collectCash(req.account, req.params.transactionId, req.body));
  });

  desk.get('/shift', (req, res) => {
    res.json(cashDesk.getShift(req.account));
  });

  desk.post('/shift/open', (req, res) => {
    res.status(201).json(cashDesk.openShift(req.account, req.body));
  });

  desk.post('/shift/close', (req, res) => {
    res.json(cashDesk.closeShift(req.account, req.body));
  });

  api.use('/pos', desk);

  return api;
};
