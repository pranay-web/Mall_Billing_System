import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createApp } from '../src/app.js';
import { createGateway } from '../src/services/gateway.js';
import { buildBill } from '../src/services/pricing.js';

const SECRET = 'test_secret_for_hmac';
const CASHIER = { email: 'desk@test.in', password: 'correct-horse-battery', name: 'Test Cashier' };

const baseConfig = {
  env: 'test',
  port: 0,
  corsOrigin: true,
  mall: { name: 'Test Mall', legalName: 'Test Pvt Ltd', gstin: '29ABCDE1234F1Z5', address: 'Test' },
  databasePath: ':memory:',
  authSecret: 'auth_secret_for_tests',
  customerTokenTtlHours: 1,
  cashierTokenTtlHours: 1,
  seedCashier: CASHIER,
  sessionTtlMinutes: 60,
  maxLineQuantity: 25,
  razorpay: { mode: 'test', keyId: 'rzp_test_dummy', keySecret: SECRET },
};

// Real HMAC verification, stubbed network calls.
const realGateway = createGateway({ razorpay: { mode: 'mock', keyId: 'x', keySecret: SECRET } });
let orderSeq = 0;
const stubGateway = {
  ...realGateway,
  mode: 'test',
  keyId: 'rzp_test_dummy',
  createOrder: async ({ amount }) => ({ id: `order_test${++orderSeq}`, amount, currency: 'INR' }),
  fetchPaymentDetails: async () => ({ method: 'upi', vpa: 'success@razorpay' }),
};

const sign = (orderId, paymentId) => crypto.createHmac('sha256', SECRET).update(`${orderId}|${paymentId}`).digest('hex');

/** Boots an isolated app (fresh in-memory DB) and returns a tiny HTTP client for it. */
const boot = async (overrides = {}) => {
  const config = { ...baseConfig, ...overrides.config };
  const { app, store } = await createApp({ config, gateway: overrides.gateway ?? stubGateway, logRequests: false });
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const call = async (method, path, body, token) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };

  const customer = async (phone) => {
    const { body } = await call('POST', '/api/auth/customer/login', { phone });
    const session = await call('POST', '/api/sessions', undefined, body.token);
    return { token: body.token, sid: session.body.sessionId };
  };

  const cashier = async () => (await call('POST', '/api/auth/cashier/login', { email: CASHIER.email, password: CASHIER.password })).body.token;

  return { call, customer, cashier, store, close: () => server.close() };
};

let t;
before(async () => {
  t = await boot();
});
after(() => t.close());

describe('pricing', () => {
  it('splits GST per slab into CGST/SGST and rounds the payable amount', () => {
    const product = (price, gstRate) => ({ id: `p${price}`, price, gstRate, showroomId: 'food-court', showroom: 'Food Court' });
    const bill = buildBill([
      { itemId: 'a', product: product(150, 5), quantity: 1 },
      { itemId: 'b', product: product(500, 18), quantity: 2 },
    ]);
    assert.equal(bill.summary.subtotal, 1150);
    assert.equal(bill.summary.totalTax, 187.5);
    assert.equal(bill.summary.roundOff, 0.5);
    assert.equal(bill.summary.grandTotal, 1338);
    assert.deepEqual(
      bill.taxBreakdown.map((s) => [s.rate, s.taxableValue, s.cgst, s.sgst]),
      [
        [5, 150, 3.75, 3.75],
        [18, 1000, 90, 90],
      ],
    );
  });
});

describe('database', () => {
  it('seeds products with barcode, cost, gst and type', () => {
    const rows = t.store.db.prepare('SELECT barcode, cost, gst, type FROM products ORDER BY id').all();
    assert.equal(rows.length, 15);
    assert.deepEqual({ ...rows[0] }, { barcode: '8901001000018', cost: 500, gst: 18, type: 'clothing' });
  });

  it('stores customers by phone and the seeded cashier by email', async () => {
    await t.call('POST', '/api/auth/customer/login', { phone: '98450 12345' });
    const customer = t.store.db.prepare('SELECT phone FROM customers WHERE phone = ?').get('+919845012345');
    assert.equal(customer.phone, '+919845012345');
    const cashier = t.store.db.prepare('SELECT email, password_hash FROM cashiers').get();
    assert.equal(cashier.email, CASHIER.email);
    assert.match(cashier.password_hash, /^scrypt\$/);
  });
});

describe('auth', () => {
  it('signs customers in with just a phone number', async () => {
    const bad = await t.call('POST', '/api/auth/customer/login', { phone: '12345' });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error.code, 'INVALID_PHONE');

    const first = await t.call('POST', '/api/auth/customer/login', { phone: '+91 91234 56789' });
    assert.equal(first.status, 200);
    assert.equal(first.body.customer.phone, '+919123456789');
    assert.equal(first.body.customer.isNew, true);

    const again = await t.call('POST', '/api/auth/customer/login', { phone: '09123456789' });
    assert.equal(again.body.customer.isNew, false);
    assert.equal(again.body.customer.id, first.body.customer.id);
  });

  it('signs cashiers in with email + password', async () => {
    const wrong = await t.call('POST', '/api/auth/cashier/login', { email: CASHIER.email, password: 'nope-nope' });
    assert.equal(wrong.status, 401);
    const unknown = await t.call('POST', '/api/auth/cashier/login', { email: 'ghost@test.in', password: 'whatever1' });
    assert.equal(unknown.status, 401);
    const ok = await t.call('POST', '/api/auth/cashier/login', { email: 'DESK@test.in', password: CASHIER.password });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.cashier.name, CASHIER.name);
  });

  it('keeps each role in its own area', async () => {
    const { token: customerToken, sid } = await t.customer('9000000001');
    const cashierToken = await t.cashier();

    assert.equal((await t.call('GET', `/api/cart/${sid}`)).status, 401);
    assert.equal((await t.call('GET', `/api/cart/${sid}`, undefined, 'forged.token')).body.error.code, 'LOGIN_EXPIRED');
    assert.equal((await t.call('GET', '/api/pos/pending', undefined, customerToken)).status, 403);
    assert.equal((await t.call('POST', '/api/sessions', undefined, cashierToken)).status, 403);

    // Another customer can't see this bag.
    const other = await t.customer('9000000002');
    assert.equal((await t.call('GET', `/api/cart/${sid}`, undefined, other.token)).status, 404);
  });

  it('gives a returning customer the same open bag', async () => {
    const a = await t.customer('9000000003');
    const { body } = await t.call('POST', '/api/auth/customer/login', { phone: '9000000003' });
    const again = await t.call('POST', '/api/sessions', undefined, body.token);
    assert.equal(again.status, 200);
    assert.equal(again.body.sessionId, a.sid);
  });
});

describe('catalog & cart', () => {
  it('lists products publicly and looks them up by barcode or SKU', async () => {
    const all = await t.call('GET', '/api/products');
    assert.equal(all.body.products.length, 15);
    const food = await t.call('GET', '/api/products?category=food');
    assert.deepEqual(food.body.products.map((p) => p.gstRate), [5, 5, 5]);
    const shirt = await t.call('GET', '/api/products/FZ-SHIRT');
    assert.equal((await t.call('GET', `/api/products/${shirt.body.barcode}`)).body.name, 'Blue Casual Shirt');
    assert.equal((await t.call('GET', '/api/products/0000000000000')).status, 404);
  });

  it('adds, increments, groups by showroom and computes multi-tier GST', async () => {
    const { token, sid } = await t.customer('9000000010');
    await t.call('POST', `/api/cart/${sid}/add`, { barcode: 'FZ-SHIRT' }, token);
    await t.call('POST', `/api/cart/${sid}/add`, { barcode: 'fz-shirt' }, token);
    const { status, body } = await t.call('POST', `/api/cart/${sid}/add`, { barcode: 'TS-CABLE' }, token);
    assert.equal(status, 201);
    assert.equal(body.item.name, 'USB-C Cable');

    const cart = (await t.call('GET', `/api/cart/${sid}`, undefined, token)).body;
    assert.equal(cart.items.find((i) => i.sku === 'FZ-SHIRT').quantity, 2);
    assert.deepEqual(cart.groups.map((g) => g.showroom), ['Fashion Zone', 'Tech Store']);
    assert.equal(cart.summary.grandTotal, 1348);

    const item = cart.items[0];
    assert.equal((await t.call('PUT', `/api/cart/${sid}/items/${item.itemId}`, { quantity: 3 }, token)).body.items[0].quantity, 3);
    assert.equal((await t.call('DELETE', `/api/cart/${sid}/items/${item.itemId}`, undefined, token)).body.items.length, 1);
  });

  it('prices real retail tags at their MRP (GST included) using the printed barcode', async () => {
    const { token, sid } = await t.customer('9000000012');
    const polo = await t.call('POST', `/api/cart/${sid}/add`, { barcode: '4070034130499' }, token);
    assert.equal(polo.body.item.name, 'Puma × RCB Striper Polo II');
    assert.equal(polo.body.item.unitMrp, 2999);
    await t.call('POST', `/api/cart/${sid}/add`, { barcode: '8905310522667' }, token);

    const cart = (await t.call('GET', `/api/cart/${sid}`, undefined, token)).body;
    assert.equal(cart.summary.grandTotal, 2999 + 2399);
    assert.equal(cart.summary.subtotal, 4574.58); // taxable value backed out of the MRPs
    assert.equal(cart.summary.totalTax, 823.42);
    assert.equal(cart.summary.roundOff, 0);

    const perfume = await t.call('GET', '/api/products/8435415076944');
    assert.equal(perfume.body.category, 'beauty');
    assert.equal(perfume.body.mrp, 12500);
  });

  it('enforces stock and validates input', async () => {
    const { token, sid } = await t.customer('9000000011');
    await t.call('POST', `/api/cart/${sid}/add`, { barcode: 'JS-NECKLACE', quantity: 2 }, token);
    const res = await t.call('POST', `/api/cart/${sid}/add`, { barcode: 'JS-NECKLACE' }, token);
    assert.equal(res.status, 409);
    assert.match(res.body.error.message, /Only 2/);
    assert.equal((await t.call('POST', `/api/cart/${sid}/add`, { barcode: '' }, token)).body.error.code, 'INVALID_BARCODE');
    assert.equal((await t.call('POST', `/api/cart/${sid}/add`, { barcode: 'FZ-SHIRT', quantity: 0 }, token)).body.error.code, 'INVALID_QUANTITY');
  });
});

describe('razorpay checkout', () => {
  it('verifies the HMAC signature, persists the invoice and decrements stock', async () => {
    const { token, sid } = await t.customer('9000000020');
    await t.call('POST', `/api/cart/${sid}/add`, { barcode: 'TS-EARBUDS' }, token);
    await t.call('POST', `/api/cart/${sid}/add`, { barcode: 'FD-BURGER' }, token);
    const stockBefore = t.store.findProductByCode('TS-EARBUDS').stock;

    const order = await t.call('POST', '/api/razorpay/orders', { sessionId: sid }, token);
    assert.equal(order.body.amount, 239800); // 2240 + 157.50 = 2397.50 → ₹2398
    assert.equal((await t.call('POST', '/api/razorpay/orders', { sessionId: sid }, token)).body.orderId, order.body.orderId);

    const forged = await t.call(
      'POST',
      '/api/razorpay/verify',
      { sessionId: sid, razorpay_order_id: order.body.orderId, razorpay_payment_id: 'pay_1', razorpay_signature: 'f'.repeat(64) },
      token,
    );
    assert.equal(forged.body.error.code, 'INVALID_SIGNATURE');

    const payload = { sessionId: sid, razorpay_order_id: order.body.orderId, razorpay_payment_id: 'pay_1', razorpay_signature: sign(order.body.orderId, 'pay_1') };
    const verified = await t.call('POST', '/api/razorpay/verify', payload, token);
    assert.equal(verified.status, 200);
    assert.equal(verified.body.status, 'paid');
    assert.equal(verified.body.customer.phone, '+919000000020');
    assert.equal((await t.call('POST', '/api/razorpay/verify', payload, token)).body.transactionId, verified.body.transactionId);

    assert.equal(t.store.findProductByCode('TS-EARBUDS').stock, stockBefore - 1);
    const row = t.store.db.prepare('SELECT payment_status, grand_total FROM transactions WHERE id = ?').get(verified.body.transactionId);
    assert.deepEqual({ ...row }, { payment_status: 'paid', grand_total: 2398 });

    const receipts = await t.call('GET', '/api/me/receipts', undefined, token);
    assert.equal(receipts.body.receipts[0].transactionId, verified.body.transactionId);

    // Receipts are private to the customer (and cashiers).
    const stranger = await t.customer('9000000021');
    assert.equal((await t.call('GET', `/api/receipt/${verified.body.transactionId}`, undefined, stranger.token)).status, 404);
    assert.equal((await t.call('GET', `/api/receipt/${verified.body.transactionId}`, undefined, await t.cashier())).status, 200);
  });

  it('refuses to create an order for an empty bag', async () => {
    const { token, sid } = await t.customer('9000000022');
    assert.equal((await t.call('POST', '/api/razorpay/orders', { sessionId: sid }, token)).body.error.code, 'CART_EMPTY');
  });
});

describe('cash desk', () => {
  it('takes cash, returns the right change and tracks the drawer through end of day', async () => {
    const { token, sid } = await t.customer('9000000030');
    await t.call('POST', `/api/cart/${sid}/add`, { barcode: 'FZ-TSHIRT', quantity: 2 }, token);
    await t.call('POST', `/api/cart/${sid}/add`, { barcode: 'FD-PIZZA' }, token);

    const bill = await t.call('POST', '/api/checkout/payment', { sessionId: sid, method: 'cash' }, token);
    assert.equal(bill.status, 201);
    assert.equal(bill.body.status, 'awaiting_payment');
    assert.equal(bill.body.summary.grandTotal, 971); // 600×1.18 + 250×1.05 = 970.50 → ₹971

    const desk = await t.cashier();
    const id = bill.body.transactionId;

    // Must open the day first.
    const early = await t.call('POST', `/api/pos/bills/${id}/collect`, { cashReceived: 1000 }, desk);
    assert.equal(early.body.error.code, 'SHIFT_NOT_OPEN');
    const opened = await t.call('POST', '/api/pos/shift/open', { openingCash: 2000 }, desk);
    assert.equal(opened.status, 201);
    assert.equal(opened.body.shift.cashInDrawer, 2000);

    // Find the bill by QR, ID or phone.
    assert.equal(bill.body.billCode, id);
    assert.equal((await t.call('POST', '/api/pos/lookup', { code: bill.body.billCode }, desk)).body.bill.transactionId, id);
    const byPhone = await t.call('POST', '/api/pos/lookup', { code: '90000 00030' }, desk);
    assert.equal(byPhone.body.bill.transactionId, id);
    assert.equal(byPhone.body.bill.customerPhone, '+91 ••••••0030');
    assert.ok((await t.call('GET', '/api/pos/pending', undefined, desk)).body.bills.some((b) => b.transactionId === id));

    const short = await t.call('POST', `/api/pos/bills/${id}/collect`, { cashReceived: 500 }, desk);
    assert.equal(short.body.error.code, 'INSUFFICIENT_CASH');

    const paid = await t.call('POST', `/api/pos/bills/${id}/collect`, { cashReceived: 1000 }, desk);
    assert.equal(paid.status, 200);
    assert.equal(paid.body.change, 29);
    assert.equal(paid.body.drawer.cashSales, 971);
    assert.equal(paid.body.drawer.cashInDrawer, 2971);

    assert.equal((await t.call('POST', `/api/pos/bills/${id}/collect`, { cashReceived: 1000 }, desk)).body.error.code, 'ALREADY_PAID');
    const receipt = await t.call('GET', `/api/receipt/${id}`, undefined, token);
    assert.equal(receipt.body.status, 'paid');
    assert.equal(receipt.body.payment.collection.change, 29);

    const closed = await t.call('POST', '/api/pos/shift/close', { countedCash: 2960 }, desk);
    assert.equal(closed.body.report.cashInDrawer, 2971);
    assert.equal(closed.body.report.difference, -11);
    assert.equal(closed.body.report.billsCollected, 1);

    const afterClose = await t.call('GET', '/api/pos/shift', undefined, desk);
    assert.equal(afterClose.body.shift, null);
    assert.equal(afterClose.body.lastClosed.countedCash, 2960);
  });

  it('reports unknown codes and phones with no pending bill', async () => {
    const desk = await t.cashier();
    assert.equal((await t.call('POST', '/api/pos/lookup', { code: 'TX-NOPE0000' }, desk)).body.error.code, 'BILL_NOT_FOUND');
    assert.equal((await t.call('POST', '/api/pos/lookup', { code: '9876543210' }, desk)).body.error.code, 'NO_PENDING_BILL');
  });
});

describe('simulated gateway (no Razorpay keys)', () => {
  let m;
  before(async () => {
    const config = { ...baseConfig, razorpay: { mode: 'mock', keyId: 'rzp_mock_flashcart', keySecret: 'ephemeral' } };
    m = await boot({ config, gateway: createGateway(config) });
  });
  after(() => m.close());

  it('signs a simulated payment that passes the real HMAC verification', async () => {
    const { token, sid } = await m.customer('9000000040');
    await m.call('POST', `/api/cart/${sid}/add`, { barcode: 'TS-CHARGER' }, token);
    const order = await m.call('POST', '/api/razorpay/orders', { sessionId: sid }, token);
    assert.equal(order.body.mode, 'mock');

    const declined = await m.call('POST', '/api/razorpay/mock/pay', { orderId: order.body.orderId, method: 'card', outcome: 'failure' }, token);
    assert.ok(declined.body.error.description);

    const signed = await m.call('POST', '/api/razorpay/mock/pay', { orderId: order.body.orderId, method: 'upi', outcome: 'success' }, token);
    const verified = await m.call('POST', '/api/razorpay/verify', { sessionId: sid, ...signed.body }, token);
    assert.equal(verified.body.status, 'paid');
    assert.equal(verified.body.payment.details.vpa, 'success@razorpay');
  });

  it('is disabled when real keys are configured', async () => {
    const { token } = await t.customer('9000000041');
    const res = await t.call('POST', '/api/razorpay/mock/pay', { orderId: 'order_x' }, token);
    assert.equal(res.body.error.code, 'MOCK_DISABLED');
  });
});
