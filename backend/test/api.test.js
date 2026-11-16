import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createApp } from '../src/app.js';
import { createGateway } from '../src/services/gateway.js';
import { buildBill, buildCreditNote } from '../src/services/pricing.js';

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
  loyalty: { earnPerRupees: 50, maxRedeemPercent: 50 },
  returnWindowDays: 30,
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

  // Cashier sign-in is rate-limited (8 per 10 min), so the suite signs in once and reuses the token.
  let cashierToken = null;
  const cashier = async () => {
    cashierToken ??= (await call('POST', '/api/auth/cashier/login', { email: CASHIER.email, password: CASHIER.password })).body.token;
    return cashierToken;
  };

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

describe('credit notes (pricing)', () => {
  it('refunds each returned unit its exact pro-rata share of taxable value and GST', () => {
    const product = (price, gstRate) => ({ id: `p${price}`, price, gstRate, category: 'clothing', showroomId: 'fashion-zone', showroom: 'Fashion Zone' });
    const bill = buildBill([{ itemId: 'a', product: product(500, 18), quantity: 3 }]); // 1500 + 270 = 1770
    const note = buildCreditNote(bill.items, [{ itemId: 'a', quantity: 1 }]);
    assert.equal(note.summary.subtotal, 500);
    assert.equal(note.summary.totalTax, 90);
    assert.equal(note.summary.grandTotal, 590);
    assert.equal(note.items[0].originalQuantity, 3);
    const full = buildCreditNote(bill.items, [{ itemId: 'a', quantity: 3 }]);
    assert.equal(full.summary.grandTotal, bill.summary.grandTotal);
  });

  it('treats redeemed points like a voucher: GST unchanged, amount due reduced', () => {
    const product = { id: 'x', price: 1000, gstRate: 18, category: 'clothing', showroomId: 'fashion-zone', showroom: 'Fashion Zone' };
    const bill = buildBill([{ itemId: 'a', product, quantity: 1 }], { pointsRedeemed: 200 });
    assert.equal(bill.summary.grandTotal, 1180);
    assert.equal(bill.summary.totalTax, 180);
    assert.equal(bill.summary.pointsValue, 200);
    assert.equal(bill.summary.amountDue, 980);
    assert.equal(bill.amountPaise, 98000);
  });
});

describe('FlashCart points', () => {
  it('earns points on paid bills, caps redemption at half the bill and reduces the gateway order', async () => {
    const { token, sid } = await t.customer('9000000050');
    const cart0 = (await t.call('GET', `/api/cart/${sid}`, undefined, token)).body;
    assert.deepEqual({ balance: cart0.loyalty.balance, max: cart0.loyalty.maxRedeemable }, { balance: 0, max: 0 });

    // Earn: ₹4,500-ish of clothing → 1 point per ₹50 paid.
    await t.call('POST', `/api/cart/${sid}/add`, { barcode: 'FZ-JEANS', quantity: 3 }, token); // 3 × 1416 = 4248
    const order = await t.call('POST', '/api/razorpay/orders', { sessionId: sid }, token);
    const pay = { sessionId: sid, razorpay_order_id: order.body.orderId, razorpay_payment_id: 'pay_pts1', razorpay_signature: sign(order.body.orderId, 'pay_pts1') };
    const receipt = await t.call('POST', '/api/razorpay/verify', pay, token);
    assert.equal(receipt.body.summary.amountDue, 4248);
    assert.equal(receipt.body.loyalty.pointsEarned, 84);
    assert.equal(receipt.body.loyalty.balanceAfter, 84);

    // Redeem on the next bag: ₹354 t-shirt → at most 50% = 177 points, limited by the 84 balance.
    const { body: login } = await t.call('POST', '/api/auth/customer/login', { phone: '9000000050' });
    const sid2 = (await t.call('POST', '/api/sessions', undefined, login.token)).body.sessionId;
    await t.call('POST', `/api/cart/${sid2}/add`, { barcode: 'FZ-TSHIRT' }, login.token);
    const cart = (await t.call('GET', `/api/cart/${sid2}`, undefined, login.token)).body;
    assert.equal(cart.loyalty.balance, 84);
    assert.equal(cart.loyalty.maxRedeemable, 84);

    const tooMany = await t.call('PUT', `/api/cart/${sid2}/points`, { points: 85 }, login.token);
    assert.equal(tooMany.body.error.code, 'POINTS_LIMIT');
    const bad = await t.call('PUT', `/api/cart/${sid2}/points`, { points: 2.5 }, login.token);
    assert.equal(bad.body.error.code, 'INVALID_POINTS');

    const redeemed = await t.call('PUT', `/api/cart/${sid2}/points`, { points: 80 }, login.token);
    assert.equal(redeemed.body.summary.grandTotal, 354);
    assert.equal(redeemed.body.summary.pointsValue, 80);
    assert.equal(redeemed.body.summary.amountDue, 274);
    assert.equal(redeemed.body.loyalty.willEarn, 5);

    const order2 = await t.call('POST', '/api/razorpay/orders', { sessionId: sid2 }, login.token);
    assert.equal(order2.body.amount, 27400);
    const pay2 = { sessionId: sid2, razorpay_order_id: order2.body.orderId, razorpay_payment_id: 'pay_pts2', razorpay_signature: sign(order2.body.orderId, 'pay_pts2') };
    const receipt2 = await t.call('POST', '/api/razorpay/verify', pay2, login.token);
    assert.equal(receipt2.body.payment.amount, 274);
    assert.deepEqual(
      { redeemed: receipt2.body.loyalty.pointsRedeemed, earned: receipt2.body.loyalty.pointsEarned, balance: receipt2.body.loyalty.balanceAfter },
      { redeemed: 80, earned: 5, balance: 9 },
    );

    const summary = await t.call('GET', '/api/me/summary', undefined, login.token);
    assert.equal(summary.body.loyalty.balance, 9);
    assert.equal(summary.body.bills, 2);
    assert.equal(summary.body.totalSpent, 4248 + 354);
    assert.equal(summary.body.favouriteShowroom.showroomId, 'fashion-zone');
    assert.equal(summary.body.byMonth.length, 6);
    assert.deepEqual(summary.body.loyalty.history.map((h) => h.kind), ['earn', 'redeem', 'earn']);
  });

  it('spends points when a cash bill is issued and earns them only when the cash is collected', async () => {
    const { token, sid } = await t.customer('9000000051');
    await t.call('POST', `/api/cart/${sid}/add`, { barcode: 'TS-EARBUDS' }, token); // 2240
    const bill = await t.call('POST', '/api/checkout/payment', { sessionId: sid, method: 'cash' }, token);
    assert.equal(bill.body.loyalty.pointsEarned, 0);

    const desk = await t.cashier();
    if (!(await t.call('GET', '/api/pos/shift', undefined, desk)).body.shift) await t.call('POST', '/api/pos/shift/open', { openingCash: 1000 }, desk);
    await t.call('POST', `/api/pos/bills/${bill.body.transactionId}/collect`, { cashReceived: 2500 }, desk);
    const receipt = await t.call('GET', `/api/receipt/${bill.body.transactionId}`, undefined, token);
    assert.equal(receipt.body.loyalty.pointsEarned, 44);
  });
});

describe('returns & refunds', () => {
  const setup = async (phone, lines) => {
    const { token, sid } = await t.customer(phone);
    for (const [barcode, quantity] of lines) await t.call('POST', `/api/cart/${sid}/add`, { barcode, quantity }, token);
    const order = await t.call('POST', '/api/razorpay/orders', { sessionId: sid }, token);
    const pid = `pay_ret_${phone}`;
    const receipt = await t.call('POST', '/api/razorpay/verify', { sessionId: sid, razorpay_order_id: order.body.orderId, razorpay_payment_id: pid, razorpay_signature: sign(order.body.orderId, pid) }, token);
    return { token, receipt: receipt.body };
  };

  it('quotes and processes a partial return: credit note, restock, points reversal and drawer', async () => {
    const { token, receipt } = await setup('9000000060', [['FZ-SHIRT', 2], ['FD-COFFEE', 1]]); // 1180 + 84 = 1264 → 25 pts
    const desk = await t.cashier();
    if (!(await t.call('GET', '/api/pos/shift', undefined, desk)).body.shift) await t.call('POST', '/api/pos/shift/open', { openingCash: 5000 }, desk);
    const before = (await t.call('GET', '/api/pos/shift', undefined, desk)).body.shift;
    const stockBefore = t.store.findProductByCode('FZ-SHIRT').stock;

    const found = await t.call('POST', '/api/pos/lookup', { code: receipt.transactionId }, desk);
    assert.equal(found.body.bill.returnable, true);
    const shirt = found.body.bill.items.find((i) => i.name === 'Blue Casual Shirt');
    const coffee = found.body.bill.items.find((i) => i.name === 'Cappuccino');
    assert.equal(shirt.returnableQuantity, 2);
    assert.equal(coffee.nonReturnable, true);

    const food = await t.call('POST', `/api/pos/bills/${receipt.transactionId}/returns/quote`, { items: [{ itemId: coffee.itemId, quantity: 1 }] }, desk);
    assert.equal(food.body.error.code, 'NOT_RETURNABLE');
    const tooMany = await t.call('POST', `/api/pos/bills/${receipt.transactionId}/returns/quote`, { items: [{ itemId: shirt.itemId, quantity: 3 }] }, desk);
    assert.equal(tooMany.body.error.code, 'RETURN_EXCEEDS');
    const wrongMethod = await t.call('POST', `/api/pos/bills/${receipt.transactionId}/returns/quote`, { items: [{ itemId: shirt.itemId, quantity: 1 }], method: 'upi' }, desk);
    assert.equal(wrongMethod.body.error.code, 'INVALID_METHOD');

    const quote = await t.call('POST', `/api/pos/bills/${receipt.transactionId}/returns/quote`, { items: [{ itemId: shirt.itemId, quantity: 1 }], method: 'cash', reason: 'Wrong size / fit' }, desk);
    assert.equal(quote.status, 200);
    assert.equal(quote.body.quote.summary.grandTotal, 590);
    assert.equal(quote.body.quote.summary.refundAmount, 590);
    assert.equal(quote.body.quote.summary.pointsReversed, 12); // 25 earned × 590/1264
    assert.equal(quote.body.quote.refundStatusAfter, 'partial');
    assert.equal(t.store.findProductByCode('FZ-SHIRT').stock, stockBefore); // quote changes nothing

    const done = await t.call('POST', `/api/pos/bills/${receipt.transactionId}/returns`, { items: [{ itemId: shirt.itemId, quantity: 1 }], method: 'cash', reason: 'Wrong size / fit' }, desk);
    assert.equal(done.status, 201);
    assert.match(done.body.creditNote.creditNoteNumber, /^FC\/CN\/\d{4}\/\d{6}$/);
    assert.equal(done.body.creditNote.summary.refundAmount, 590);
    assert.equal(done.body.creditNote.taxBreakdown[0].cgst, 45);
    assert.equal(done.body.creditNote.loyalty.balanceAfter, 25 - 12);
    assert.equal(done.body.bill.refundStatus, 'partial');
    assert.equal(done.body.bill.items.find((i) => i.itemId === shirt.itemId).returnableQuantity, 1);
    assert.equal(t.store.findProductByCode('FZ-SHIRT').stock, stockBefore + 1);
    assert.equal(done.body.drawer.cashRefunded, 590);
    assert.equal(done.body.drawer.cashInDrawer, Math.round((before.cashInDrawer - 590) * 100) / 100);
    assert.equal(done.body.drawer.refundsIssued, before.refundsIssued + 1);

    // Customer sees it on the receipt and can open the credit note; a stranger can't.
    const after = await t.call('GET', `/api/receipt/${receipt.transactionId}`, undefined, token);
    assert.equal(after.body.refundStatus, 'partial');
    assert.equal(after.body.refunds[0].amount, 590);
    assert.equal(after.body.items.find((i) => i.itemId === shirt.itemId).returnedQuantity, 1);
    const note = await t.call('GET', `/api/credit-notes/${done.body.creditNote.id}`, undefined, token);
    assert.equal(note.body.invoiceNumber, receipt.invoiceNumber);
    const stranger = await t.customer('9000000061');
    assert.equal((await t.call('GET', `/api/credit-notes/${done.body.creditNote.id}`, undefined, stranger.token)).status, 404);

    // Returning the last shirt completes the return.
    const rest = await t.call('POST', `/api/pos/bills/${receipt.transactionId}/returns`, { items: [{ itemId: shirt.itemId, quantity: 1 }], method: 'original' }, desk);
    assert.equal(rest.body.bill.refundStatus, 'full');
    assert.equal(rest.body.creditNote.gateway.status, 'processed');
    assert.equal((await t.call('POST', `/api/pos/bills/${receipt.transactionId}/returns`, { items: [{ itemId: shirt.itemId, quantity: 1 }] }, desk)).body.error.code, 'RETURN_EXCEEDS');
  });

  it('credits redeemed points back instead of cash, and refuses unpaid bills', async () => {
    // Earn first.
    const first = await setup('9000000062', [['FZ-JEANS', 2]]); // 2832 → 56 pts
    assert.equal(first.receipt.loyalty.pointsEarned, 56);
    const { body: login } = await t.call('POST', '/api/auth/customer/login', { phone: '9000000062' });
    const sid = (await t.call('POST', '/api/sessions', undefined, login.token)).body.sessionId;
    await t.call('POST', `/api/cart/${sid}/add`, { barcode: 'FZ-TSHIRT', quantity: 2 }, login.token); // 708
    await t.call('PUT', `/api/cart/${sid}/points`, { points: 50 }, login.token);
    const order = await t.call('POST', '/api/razorpay/orders', { sessionId: sid }, login.token);
    assert.equal(order.body.amount, 65800);
    const paid = await t.call('POST', '/api/razorpay/verify', { sessionId: sid, razorpay_order_id: order.body.orderId, razorpay_payment_id: 'pay_cb', razorpay_signature: sign(order.body.orderId, 'pay_cb') }, login.token);

    const desk = await t.cashier();
    if (!(await t.call('GET', '/api/pos/shift', undefined, desk)).body.shift) await t.call('POST', '/api/pos/shift/open', { openingCash: 5000 }, desk);
    const item = paid.body.items[0];
    const quote = await t.call('POST', `/api/pos/bills/${paid.body.transactionId}/returns/quote`, { items: [{ itemId: item.itemId, quantity: 1 }], method: 'cash' }, desk);
    assert.equal(quote.status, 200, JSON.stringify(quote.body));
    assert.equal(quote.body.quote.summary.grandTotal, 354);
    assert.equal(quote.body.quote.summary.pointsReturned, 25); // half the 50 redeemed
    assert.equal(quote.body.quote.summary.refundAmount, 329);

    // A cash refund can't exceed what's in the drawer.
    const { hashPassword } = await import('../src/lib/auth.js');
    t.store.saveCashier({ email: 'ravi@test.in', name: 'Ravi', passwordHash: await hashPassword('small-float-pass') });
    const ravi = (await t.call('POST', '/api/auth/cashier/login', { email: 'ravi@test.in', password: 'small-float-pass' })).body.token;
    await t.call('POST', '/api/pos/shift/open', { openingCash: 100 }, ravi);
    const short = await t.call('POST', `/api/pos/bills/${paid.body.transactionId}/returns`, { items: [{ itemId: item.itemId, quantity: 1 }], method: 'cash' }, ravi);
    assert.equal(short.body.error.code, 'INSUFFICIENT_DRAWER');
    assert.equal(short.body.error.details.cashInDrawer, 100);
    await t.call('POST', '/api/pos/shift/close', {}, ravi);

    // Unpaid cash bills can't be refunded.
    const { token, sid: sid3 } = await t.customer('9000000063');
    await t.call('POST', `/api/cart/${sid3}/add`, { barcode: 'TS-CABLE' }, token);
    const bill = await t.call('POST', '/api/checkout/payment', { sessionId: sid3, method: 'cash' }, token);
    const res = await t.call('POST', `/api/pos/bills/${bill.body.transactionId}/returns/quote`, { items: [{ itemId: bill.body.items[0].itemId, quantity: 1 }] }, desk);
    assert.equal(res.body.error.code, 'NOT_PAID');
  });
});

describe('sharing & multi-desk', () => {
  it('opens a receipt from its share link without signing in, but not with a forged token', async () => {
    const { token, sid } = await t.customer('9000000070');
    await t.call('POST', `/api/cart/${sid}/add`, { barcode: 'TS-CHARGER' }, token);
    const bill = await t.call('POST', '/api/checkout/payment', { sessionId: sid, method: 'cash' }, token);
    const path = bill.body.sharePath;
    assert.match(path, /^\/receipt\/TX-[A-Z0-9]{8}\?s=[A-Za-z0-9_-]{22}$/);
    const shareToken = path.split('?s=')[1];

    assert.equal((await t.call('GET', `/api/receipt/${bill.body.transactionId}`)).status, 401);
    const shared = await t.call('GET', `/api/receipt/${bill.body.transactionId}?s=${shareToken}`);
    assert.equal(shared.status, 200);
    assert.equal(shared.body.invoiceNumber, bill.body.invoiceNumber);
    assert.equal((await t.call('GET', `/api/receipt/${bill.body.transactionId}?s=${'A'.repeat(22)}`)).status, 404);
  });

  it('shows every cashier’s drawer and offers the last closed one for handover', async () => {
    const { hashPassword } = await import('../src/lib/auth.js');
    t.store.saveCashier({ email: 'asha@test.in', name: 'Asha Rao', passwordHash: await hashPassword('second-desk-pass') });
    const asha = (await t.call('POST', '/api/auth/cashier/login', { email: 'asha@test.in', password: 'second-desk-pass' })).body.token;
    const desk = await t.cashier();
    if (!(await t.call('GET', '/api/pos/shift', undefined, desk)).body.shift) await t.call('POST', '/api/pos/shift/open', { openingCash: 5000 }, desk);
    const deskDrawer = (await t.call('GET', '/api/pos/shift', undefined, desk)).body.shift.cashInDrawer;

    await t.call('POST', '/api/pos/shift/open', { openingCash: 1500 }, asha);
    const drawers = await t.call('GET', '/api/pos/drawers', undefined, asha);
    assert.equal(drawers.body.openDesks, 2);
    const mine = drawers.body.drawers.find((d) => d.isMine);
    assert.equal(mine.cashierName, 'Asha Rao');
    assert.equal(mine.cashInDrawer, 1500);
    assert.equal(drawers.body.cashOnFloor, Math.round((1500 + deskDrawer) * 100) / 100);

    await t.call('POST', '/api/pos/shift/close', { countedCash: 1500 }, asha);
    const closed = await t.call('GET', '/api/pos/shift', undefined, desk);
    assert.equal(closed.body.shift.cashierName, CASHIER.name);
    // The first cashier still has an open drawer, so no handover is offered to them yet.
    assert.equal(closed.body.handover, null);
    await t.call('POST', '/api/pos/shift/close', {}, desk);
    const next = await t.call('GET', '/api/pos/shift', undefined, asha);
    assert.equal(next.body.handover.cashierName, CASHIER.name);
    assert.equal((await t.call('GET', '/api/pos/drawers', undefined, desk)).body.openDesks, 0);
  });
});

describe('adding a product at the cash desk', () => {
  it('lets a cashier add a product from a scanned barcode, which customers can then scan', async () => {
    const desk = await t.cashier();
    const body = { barcode: '8906001234567', name: 'Steel Water Bottle', description: '750 ml, insulated', mrp: 899, gstRate: 18, category: 'clothing', showroomId: 'fashion-zone', stock: 12, hsn: '96170010' };
    const added = await t.call('POST', '/api/pos/products', body, desk);
    assert.equal(added.status, 201);
    assert.equal(added.body.product.name, 'Steel Water Bottle');
    assert.equal(added.body.product.mrp, 899);
    assert.equal(added.body.product.price, 761.86); // 899 / 1.18, the GST-exclusive value
    assert.equal(added.body.product.stock, 12);

    const { token, sid } = await t.customer('9000000080');
    const scanned = await t.call('POST', `/api/cart/${sid}/add`, { barcode: '8906001234567' }, token);
    assert.equal(scanned.status, 201);
    assert.equal(scanned.body.item.name, 'Steel Water Bottle');
    assert.equal(scanned.body.item.unitMrp, 899);
  });

  it('refuses a barcode that is already in the catalog, and bad details', async () => {
    const desk = await t.cashier();
    const dup = await t.call('POST', '/api/pos/products', { barcode: 'FZ-SHIRT', name: 'Copy', mrp: 100, gstRate: 18, category: 'clothing', showroomId: 'fashion-zone' }, desk);
    assert.equal(dup.body.error.code, 'PRODUCT_EXISTS');
    const bad = { barcode: '8906009999991', name: 'X', mrp: 100, gstRate: 18, category: 'clothing', showroomId: 'fashion-zone' };
    assert.equal((await t.call('POST', '/api/pos/products', { ...bad, name: 'X' }, desk)).body.error.code, 'INVALID_NAME');
    assert.equal((await t.call('POST', '/api/pos/products', { ...bad, mrp: 0, name: 'Okay name' }, desk)).body.error.code, 'INVALID_MRP');
    assert.equal((await t.call('POST', '/api/pos/products', { ...bad, gstRate: 7, name: 'Okay name' }, desk)).body.error.code, 'INVALID_GST');
    assert.equal((await t.call('POST', '/api/pos/products', { ...bad, showroomId: 'tech-store', name: 'Okay name' }, desk)).body.error.code, 'INVALID_SHOWROOM');
    assert.equal((await t.call('POST', '/api/pos/products', { ...bad, barcode: 'x y', name: 'Okay name' }, desk)).body.error.code, 'INVALID_BARCODE');
  });

  it('is not open to customers', async () => {
    const { token } = await t.customer('9000000081');
    const res = await t.call('POST', '/api/pos/products', { barcode: '8906001111111', name: 'Sneaky', mrp: 10, gstRate: 5, category: 'food', showroomId: 'food-court' }, token);
    assert.equal(res.status, 403);
  });
});
