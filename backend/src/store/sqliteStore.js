import { SHOWROOMS } from '../data/catalog.js';
import { financialYear } from '../lib/ids.js';

const showroomName = new Map(SHOWROOMS.map((s) => [s.id, s.name]));

const toProduct = (row) =>
  row && {
    id: row.id,
    barcode: row.barcode,
    sku: row.sku,
    name: row.name,
    description: row.description,
    price: row.cost,
    mrp: row.mrp ?? null,
    gstRate: row.gst,
    hsn: row.hsn,
    category: row.type,
    showroomId: row.showroom_id,
    showroom: showroomName.get(row.showroom_id) ?? row.showroom_id,
    stock: row.stock,
  };

const toCashier = (row) =>
  row && {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    active: row.active === 1,
  };

const toShift = (row) =>
  row && {
    id: row.id,
    cashierId: row.cashier_id,
    openedAt: row.opened_at,
    openingCash: row.opening_cash,
    closedAt: row.closed_at,
    countedCash: row.counted_cash,
  };

/**
 * Persistence for FlashCart. Durable data (customers, cashiers, products,
 * invoices, cash shifts) lives in SQLite; short-lived carts and gateway orders
 * live in memory.
 */
export const createSqliteStore = ({ db }) => {
  const q = {
    allProducts: db.prepare('SELECT * FROM products ORDER BY id'),
    productById: db.prepare('SELECT * FROM products WHERE id = ?'),
    productByCode: db.prepare('SELECT * FROM products WHERE barcode = ? OR sku = ? COLLATE NOCASE'),
    adjustStock: db.prepare('UPDATE products SET stock = MAX(0, stock + ?) WHERE id = ?'),

    customerByPhone: db.prepare('SELECT * FROM customers WHERE phone = ?'),
    customerById: db.prepare('SELECT * FROM customers WHERE id = ?'),
    insertCustomer: db.prepare('INSERT INTO customers (phone, created_at, last_login_at) VALUES (?, ?, ?)'),
    touchCustomer: db.prepare('UPDATE customers SET last_login_at = ? WHERE id = ?'),

    cashierByEmail: db.prepare('SELECT * FROM cashiers WHERE email = ? COLLATE NOCASE'),
    cashierById: db.prepare('SELECT * FROM cashiers WHERE id = ?'),
    insertCashier: db.prepare('INSERT INTO cashiers (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)'),
    updateCashier: db.prepare('UPDATE cashiers SET name = ?, password_hash = ?, active = 1 WHERE id = ?'),
    touchCashier: db.prepare('UPDATE cashiers SET last_login_at = ? WHERE id = ?'),

    upsertTxn: db.prepare(`
      INSERT INTO transactions (id, invoice_number, customer_id, session_id, created_at, grand_total,
        payment_method, payment_status, paid_at, shift_id, cash_received, change_returned, data)
      VALUES (:id, :invoice_number, :customer_id, :session_id, :created_at, :grand_total,
        :payment_method, :payment_status, :paid_at, :shift_id, :cash_received, :change_returned, :data)
      ON CONFLICT(id) DO UPDATE SET
        payment_method = excluded.payment_method, payment_status = excluded.payment_status,
        paid_at = excluded.paid_at, shift_id = excluded.shift_id, cash_received = excluded.cash_received,
        change_returned = excluded.change_returned, data = excluded.data`),
    txnById: db.prepare('SELECT data FROM transactions WHERE id = ?'),
    pendingTxns: db.prepare("SELECT data FROM transactions WHERE payment_status = 'pending' ORDER BY created_at DESC LIMIT ?"),
    pendingByPhone: db.prepare(`
      SELECT t.data FROM transactions t JOIN customers c ON c.id = t.customer_id
      WHERE c.phone = ? AND t.payment_status = 'pending' ORDER BY t.created_at DESC`),
    customerTxns: db.prepare('SELECT data FROM transactions WHERE customer_id = ? ORDER BY created_at DESC LIMIT ?'),
    shiftTxns: db.prepare('SELECT data FROM transactions WHERE shift_id = ? ORDER BY paid_at DESC'),

    nextCounter: db.prepare(`
      INSERT INTO counters (name, value) VALUES (?, 1)
      ON CONFLICT(name) DO UPDATE SET value = value + 1
      RETURNING value`),

    openShiftFor: db.prepare('SELECT * FROM cash_shifts WHERE cashier_id = ? AND closed_at IS NULL ORDER BY id DESC LIMIT 1'),
    lastClosedShiftFor: db.prepare('SELECT * FROM cash_shifts WHERE cashier_id = ? AND closed_at IS NOT NULL ORDER BY id DESC LIMIT 1'),
    shiftById: db.prepare('SELECT * FROM cash_shifts WHERE id = ?'),
    insertShift: db.prepare('INSERT INTO cash_shifts (cashier_id, opened_at, opening_cash) VALUES (?, ?, ?)'),
    closeShift: db.prepare('UPDATE cash_shifts SET closed_at = ?, counted_cash = ? WHERE id = ? AND closed_at IS NULL'),
  };

  const parse = (row) => (row ? JSON.parse(row.data) : null);

  const sessions = new Map();
  const orders = new Map();

  return {
    db,

    /** Runs `fn` inside a SQLite transaction. */
    atomic(fn) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = fn();
        db.exec('COMMIT');
        return result;
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },

    // ---------- Products ----------
    listProducts: () => q.allProducts.all().map(toProduct),
    getProduct: (id) => toProduct(q.productById.get(id)) ?? null,
    findProductByCode: (code) => {
      const c = String(code).trim();
      return toProduct(q.productByCode.get(c, c)) ?? null;
    },
    adjustStock: (productId, delta) => q.adjustStock.run(delta, productId),

    // ---------- Customers ----------
    /** Finds or registers a customer by phone; returns `{ id, phone, isNew }`. */
    loginCustomer(phone) {
      const now = new Date().toISOString();
      const existing = q.customerByPhone.get(phone);
      if (existing) {
        q.touchCustomer.run(now, existing.id);
        return { id: existing.id, phone: existing.phone, isNew: false };
      }
      const { lastInsertRowid } = q.insertCustomer.run(phone, now, now);
      return { id: Number(lastInsertRowid), phone, isNew: true };
    },
    getCustomer: (id) => {
      const row = q.customerById.get(id);
      return row ? { id: row.id, phone: row.phone } : null;
    },

    // ---------- Cashiers ----------
    findCashierByEmail: (email) => toCashier(q.cashierByEmail.get(email)) ?? null,
    getCashier: (id) => toCashier(q.cashierById.get(id)) ?? null,
    touchCashierLogin: (id) => q.touchCashier.run(new Date().toISOString(), id),
    /** Creates a cashier, or resets name/password if the email already exists. */
    saveCashier({ email, name, passwordHash }) {
      const existing = q.cashierByEmail.get(email);
      if (existing) {
        q.updateCashier.run(name, passwordHash, existing.id);
        return { id: existing.id, created: false };
      }
      const { lastInsertRowid } = q.insertCashier.run(email, name, passwordHash, new Date().toISOString());
      return { id: Number(lastInsertRowid), created: true };
    },

    // ---------- Transactions (invoices) ----------
    saveTransaction(txn) {
      const c = txn.payment.collection;
      q.upsertTxn.run({
        id: txn.id,
        invoice_number: txn.invoiceNumber,
        customer_id: txn.customerId ?? null,
        session_id: txn.sessionId,
        created_at: txn.createdAt,
        grand_total: txn.bill.summary.grandTotal,
        payment_method: txn.payment.method,
        payment_status: txn.payment.status,
        paid_at: txn.payment.paidAt ?? null,
        shift_id: c?.shiftId ?? null,
        cash_received: c?.received ?? null,
        change_returned: c?.change ?? null,
        data: JSON.stringify(txn),
      });
      return txn;
    },
    getTransaction: (id) => parse(q.txnById.get(id)),
    hasTransaction: (id) => Boolean(q.txnById.get(id)),
    listPending: (limit = 50) => q.pendingTxns.all(limit).map(parse),
    listPendingByPhone: (phone) => q.pendingByPhone.all(phone).map(parse),
    listCustomerTransactions: (customerId, limit = 20) => q.customerTxns.all(customerId, limit).map(parse),
    listShiftCollections: (shiftId) => q.shiftTxns.all(shiftId).map(parse),

    /** Sequential GST invoice number scoped to the financial year, e.g. `FC/2627/000042`. */
    nextInvoiceNumber(date = new Date()) {
      const fy = financialYear(date);
      const { value } = q.nextCounter.get(`invoice:${fy}`);
      return `FC/${fy}/${String(value).padStart(6, '0')}`;
    },

    // ---------- Cash shifts ----------
    getOpenShift: (cashierId) => toShift(q.openShiftFor.get(cashierId)) ?? null,
    getLastClosedShift: (cashierId) => toShift(q.lastClosedShiftFor.get(cashierId)) ?? null,
    getShift: (id) => toShift(q.shiftById.get(id)) ?? null,
    openShift(cashierId, openingCash) {
      const { lastInsertRowid } = q.insertShift.run(cashierId, new Date().toISOString(), openingCash);
      return toShift(q.shiftById.get(Number(lastInsertRowid)));
    },
    closeShift(id, countedCash) {
      q.closeShift.run(new Date().toISOString(), countedCash ?? null, id);
      return toShift(q.shiftById.get(id));
    },

    // ---------- Ephemeral (carts & gateway orders) ----------
    sessions,
    orders,

    /** Drops abandoned carts and stale gateway orders. */
    sweep(now = Date.now()) {
      let removed = 0;
      for (const [id, session] of sessions) {
        const expired = session.status === 'active' && Date.parse(session.expiresAt) < now;
        const stale = session.status !== 'active' && now - Date.parse(session.updatedAt) > 24 * 3600_000;
        if (expired || stale) {
          sessions.delete(id);
          removed += 1;
        }
      }
      for (const [id, order] of orders) {
        if (now - Date.parse(order.createdAt) > 24 * 3600_000) orders.delete(id);
      }
      return removed;
    },

    close: () => db.close(),
  };
};
