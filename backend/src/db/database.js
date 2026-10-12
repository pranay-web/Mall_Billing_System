import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createCatalog } from '../data/catalog.js';
import { hashPassword, normalizeEmail } from '../lib/auth.js';

/**
 * SQLite schema. Customers log in by phone, cashiers by email + password,
 * products carry barcode / cost / gst / type. Invoices and cash-drawer shifts are
 * persisted so the end-of-day cash total survives restarts. Carts stay in memory.
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS customers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  phone         TEXT    NOT NULL UNIQUE,              -- E.164, e.g. +919876543210
  created_at    TEXT    NOT NULL,
  last_login_at TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS cashiers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT    NOT NULL,
  password_hash TEXT    NOT NULL,                     -- scrypt$N$r$p$salt$hash
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS products (
  id          TEXT    PRIMARY KEY,
  barcode     TEXT    NOT NULL UNIQUE,                -- EAN-13
  sku         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  name        TEXT    NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  type        TEXT    NOT NULL,                       -- clothing | electronics | food | jewelry | beauty
  cost        REAL    NOT NULL CHECK (cost >= 0),     -- unit price in ₹, GST-exclusive
  mrp         REAL,                                   -- tag price incl. GST (real retail items); NULL = cost + GST
  gst         INTEGER NOT NULL CHECK (gst IN (0, 3, 5, 12, 18, 28)),
  hsn         TEXT    NOT NULL DEFAULT '',
  showroom_id TEXT    NOT NULL,
  stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0)
);

CREATE TABLE IF NOT EXISTS cash_shifts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  cashier_id   INTEGER NOT NULL REFERENCES cashiers(id),
  opened_at    TEXT    NOT NULL,
  opening_cash REAL    NOT NULL DEFAULT 0,
  closed_at    TEXT,
  counted_cash REAL
);
CREATE INDEX IF NOT EXISTS idx_shift_cashier ON cash_shifts(cashier_id, closed_at);

CREATE TABLE IF NOT EXISTS transactions (
  id              TEXT    PRIMARY KEY,                -- TX-XXXXXXXX
  invoice_number  TEXT    NOT NULL UNIQUE,            -- FC/2627/000001
  customer_id     INTEGER REFERENCES customers(id),
  session_id      TEXT    NOT NULL,
  created_at      TEXT    NOT NULL,
  grand_total     REAL    NOT NULL,
  payment_method  TEXT    NOT NULL,                   -- upi | card | cash | …
  payment_status  TEXT    NOT NULL,                   -- paid | pending
  paid_at         TEXT,
  shift_id        INTEGER REFERENCES cash_shifts(id), -- set when cash is collected at the desk
  cash_received   REAL,
  change_returned REAL,
  data            TEXT    NOT NULL                    -- full invoice snapshot (JSON)
);
CREATE INDEX IF NOT EXISTS idx_txn_status   ON transactions(payment_status, created_at);
CREATE INDEX IF NOT EXISTS idx_txn_customer ON transactions(customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_txn_shift    ON transactions(shift_id);

CREATE TABLE IF NOT EXISTS counters (
  name  TEXT    PRIMARY KEY,
  value INTEGER NOT NULL
);
`;

export const openDatabase = (filePath) => {
  if (filePath !== ':memory:') fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const db = new DatabaseSync(filePath);
  db.exec('PRAGMA foreign_keys = ON;');
  if (filePath !== ':memory:') db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 3000;');
  db.exec(SCHEMA);
  migrate(db);
  return db;
};

/** Small additive migrations for databases created by earlier versions. */
const migrate = (db) => {
  const productColumns = db.prepare('PRAGMA table_info(products)').all().map((c) => c.name);
  if (!productColumns.includes('mrp')) db.exec('ALTER TABLE products ADD COLUMN mrp REAL');
};

/** Seeds the product catalog and the first cashier account on an empty database. */
export const seedDatabase = async (db, { seedCashier } = {}) => {
  // Adds catalog products that aren't in the database yet; existing rows (and their stock) are left alone.
  const insert = db.prepare(`
    INSERT OR IGNORE INTO products (id, barcode, sku, name, description, type, cost, mrp, gst, hsn, showroom_id, stock)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  let added = 0;
  db.exec('BEGIN');
  for (const p of createCatalog()) {
    const { changes } = insert.run(p.id, p.barcode, p.sku, p.name, p.description, p.category, p.price, p.mrp, p.gstRate, p.hsn, p.showroomId, p.stock);
    added += Number(changes);
  }
  db.exec('COMMIT');
  if (added) console.log(`[db] added ${added} product(s) to the catalog`);

  const { count: cashierCount } = db.prepare('SELECT COUNT(*) AS count FROM cashiers').get();
  const email = normalizeEmail(seedCashier?.email);
  if (cashierCount === 0 && email && seedCashier.password) {
    db.prepare('INSERT INTO cashiers (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)').run(
      email,
      seedCashier.name || 'Desk Cashier',
      await hashPassword(seedCashier.password),
      new Date().toISOString(),
    );
    console.log(`[db] created cashier account ${email}`);
  } else if (cashierCount === 0) {
    console.warn('[db] no cashier accounts — set SEED_CASHIER_EMAIL / SEED_CASHIER_PASSWORD or run `npm run cashier:add`.');
  }
};
