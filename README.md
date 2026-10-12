# ⚡ FlashCart — Smart Mall Billing & Unified Checkout

Shoppers sign in with their **phone number**, scan product **barcodes** across every showroom in the mall (Fashion Zone, Tech Store, Food Court, Jewelry Store, Beauty Lounge) into **one bag**, and pay **once**: online through Razorpay (UPI / Card), or in **cash at the cash desk**. Every bill is a single GST tax invoice on their phone.

Cashiers sign in with **email + password**. The cash desk does only cash work: find the customer's bill, enter the cash handed over, see exactly **how much change to return**, and at the **end of the day see how much cash is left in the drawer**.

| Surface | URL (dev) | Who |
| --- | --- | --- |
| Landing | `http://localhost:5173/#/` | Everyone |
| Customer sign in | `http://localhost:5173/#/login` | Shoppers (phone number) |
| Shop home (after sign-in) | `http://localhost:5173/#/shop` | Signed-in shoppers |
| Barcode scanner | `http://localhost:5173/#/shop/scan` | Signed-in shoppers |
| Receipt | `http://localhost:5173/#/receipt/<TX-ID>` | The shopper who owns it |
| Cash desk | `http://localhost:5173/#/pos` | Cashiers (email + password) |
| Demo shelf labels | `http://localhost:5173/#/labels` | Laptop screen or print-out to scan |

---

## Quick start

**Requires Node.js 22.13+.** SQLite uses Node's built-in `node:sqlite`, so there is no database server to install.

```bash
cd flashcart
cp backend/.env.example backend/.env   # then edit SEED_CASHIER_PASSWORD and AUTH_SECRET
npm run setup                          # installs root, backend and frontend dependencies
npm run dev                            # API on :5005 + web app on :5173 (proxied /api)
```

On first start the API creates `backend/data/flashcart.db`, seeds the 15 products, and creates the cashier account from `SEED_CASHIER_EMAIL` / `SEED_CASHIER_PASSWORD`. New catalog products are added to an existing database on startup; existing rows and stock are never overwritten.

- **Shop:** open <http://localhost:5173/#/login> and enter any valid Indian mobile number (10 digits, starting with 6–9).
- **Cash desk:** open <http://localhost:5173/#/pos> and sign in with the seeded cashier email and password from `backend/.env`.

With no Razorpay keys, online payments use a **simulated gateway**, so the whole flow works offline.

### Scripts

| Command (run in `flashcart/`) | What it does |
| --- | --- |
| `npm run dev` | API (watch mode) + Vite dev server |
| `npm run dev:https` | Same, but Vite serves HTTPS so phones on your Wi-Fi can use the camera |
| `npm test` | Backend API tests (`node --test`, in-memory SQLite) |
| `npm run lint` | Lints the frontend with oxlint |
| `npm run build` | Production build of the frontend into `frontend/dist` |
| `npm start` | Production API; also serves `frontend/dist` on the same port (5005) |
| `npm run cashier:add -- --email asha@mall.in --name "Asha Rao"` | Adds a cashier (or resets their password). Prompts for the password |

---

## Database (SQLite)

File: `backend/data/flashcart.db` (git-ignored; change it with `DATABASE_PATH`). Schema: `backend/src/db/database.js`.

| Table | Key columns | Notes |
| --- | --- | --- |
| `customers` | `phone` (unique, E.164 `+919876543210`), `created_at`, `last_login_at` | Created automatically the first time a number signs in |
| `cashiers` | `email` (unique, case-insensitive), `name`, `password_hash`, `active` | Passwords are hashed with scrypt (salted) |
| `products` | `barcode` (EAN-13, unique), `sku`, `name`, `cost` (₹, excl. GST), `mrp` (₹, tag price incl. GST, optional), `gst` (%), `type` (clothing / electronics / food / jewelry / beauty), `hsn`, `showroom_id`, `stock` | 12 demo products + 3 real retail products; stock goes down on every sale |
| `transactions` | `id`, `invoice_number`, `customer_id`, `grand_total`, `payment_method`, `payment_status`, `shift_id`, `cash_received`, `change_returned`, `data` (full invoice JSON) | Every bill, online or cash |
| `cash_shifts` | `cashier_id`, `opened_at`, `opening_cash`, `closed_at`, `counted_cash` | One per cashier per day: the drawer |
| `counters` | `name`, `value` | Sequential invoice numbers per financial year |

To look inside: `sqlite3 backend/data/flashcart.db '.tables'` (or any SQLite GUI such as DB Browser for SQLite).

Shopping bags and in-flight Razorpay orders are short-lived and stay in memory.

---

## Barcode scanning & real products

The scanner reads **linear barcodes only**: EAN-13, EAN-8, UPC-A/E, Code 128, Code 39 and ITF. It ignores QR codes, so a QR on the same tag can't be picked up by mistake.

- **Engine.** Chrome on Android / macOS uses the browser's native `BarcodeDetector`. Safari and Firefox use ZXing-C++ compiled to WebAssembly (`barcode-detector` + `zxing-wasm`). The `.wasm` file is bundled and served by the app, so scanning works offline and needs no CDN.
- **How it reads.** About 10 times a second it decodes the wide band in the middle of the viewfinder. Every 4th pass it checks the whole frame, for tags held off-centre. It also handles torch control, continuous focus, and a mirrored preview on laptop cameras.
- **Bills.** Cash bills print a **Code 128** barcode of the bill ID, so the cash desk scanner pulls the bill up directly.

Real products from photographed tags. The barcode is the one printed on the tag, and the bill total equals the MRP on the tag:

| Product | Barcode | MRP (incl. GST) | Showroom |
| --- | --- | --- | --- |
| Puma × RCB Striper Polo II (S, Black) | `4070034130499` | ₹2,999 | Fashion Zone |
| Mufti Checked Shirt F/S (XL, Lilac) | `8905310522667` | ₹2,399 | Fashion Zone |
| Jean Paul Gaultier Parfum 125 ml | `8435415076944` | ₹12,500 *(placeholder: no price on the tin)* | Beauty Lounge |

For MRP-priced items, the taxable value is backed out of the MRP (`cost = MRP ÷ 1.18`), so the invoice still shows a correct CGST/SGST split. To add another real product, add a row to `seed` in `backend/src/data/catalog.js` with its `barcode` and `mrp` and restart the API. Or insert it straight into the `products` table.

---

## Sign-in

| | Customer | Cashier |
| --- | --- | --- |
| Signs in with | Mobile number only | Email + password |
| Account created | Automatically on first sign-in | By the seed settings or `npm run cashier:add` |
| Token lifetime | 30 days (`CUSTOMER_TOKEN_TTL_HOURS`) | 12 hours (`CASHIER_TOKEN_TTL_HOURS`) |
| Can access | Their own bag, checkout, and receipts | The cash desk (`/api/pos/*`) and any receipt |

Tokens are HMAC-SHA256 signed with `AUTH_SECRET` and sent as `Authorization: Bearer …`. Both login endpoints are rate-limited. A customer can never open someone else's bag or receipt (the API answers 404).

> ⚠️ Phone sign-in has no OTP, as requested. Anyone who types a number can see that number's receipts. Add an SMS OTP step before going live.

---

## Cash desk

1. **Start the day.** Enter the opening cash in the drawer (pre-filled with yesterday's counted amount).
2. **Find the bill.** Scan the barcode on the customer's receipt, type their phone number, or pick them from **Waiting to pay cash** (refreshes live).
3. **Take cash.** Enter what the customer handed over (or tap Exact / ₹500 / ₹1,000 …). The desk shows the **change to return** in big type with a note/coin split (e.g. ₹500 × 2, ₹100 × 1, ₹5 × 1, ₹1 × 1). Short payments are blocked.
4. **Drawer panel.** Always shows *cash in drawer now* = opening cash + cash sales. It also shows cash received, change returned, recent payments, and bills still to collect.
5. **End of day.** Count the drawer, see over / short against the expected amount, close the day, and get a printable end-of-day cash report.

The customer's receipt switches from "pay at the cash desk" to "Payment successful" (with cash given and change returned) as soon as the cashier records the payment.

---

## Configuration — `backend/.env`

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `5005` | API port |
| `CORS_ORIGIN` | *(all)* | Comma-separated allow-list for production |
| `DATABASE_PATH` | `data/flashcart.db` | Relative to `backend/`. `:memory:` gives a throwaway database |
| `AUTH_SECRET` | random per boot | Signs login tokens. **Set it**, or everyone is signed out on restart |
| `CUSTOMER_TOKEN_TTL_HOURS` / `CASHIER_TOKEN_TTL_HOURS` | `720` / `12` | Sign-in lifetimes |
| `SEED_CASHIER_EMAIL` / `SEED_CASHIER_PASSWORD` / `SEED_CASHIER_NAME` | — | First cashier, created only while the cashiers table is empty |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | *(empty)* | Empty ⇒ simulated gateway. `rzp_test_…` ⇒ test mode. `rzp_live_…` ⇒ live mode |
| `MALL_NAME`, `MALL_LEGAL_NAME`, `MALL_GSTIN`, `MALL_ADDRESS` | demo values | Printed on invoices |
| `SESSION_TTL_MINUTES` | `240` | Idle bags expire after this |
| `MAX_LINE_QUANTITY` | `25` | Per-item quantity cap |

### Razorpay test mode

1. In the Dashboard, switch to **Test Mode**, then go to *Settings → API Keys* and generate a key pair.
2. Put both values in `backend/.env` and restart. The API banner prints `Payments → Razorpay TEST mode`.
3. At checkout, use UPI ID **`success@razorpay`** (approve) or **`failure@razorpay`** (decline). For cards, see Razorpay's [test card list](https://razorpay.com/docs/payments/payments/test-card-details/).

The server prices the cart itself and never takes an amount from the client. It verifies `HMAC_SHA256(order_id|payment_id, key_secret)` with a constant-time comparison before issuing any invoice, and a replayed callback returns the same receipt.

---

## Demo walkthrough

1. **Labels.** Open `/#/labels` on a laptop. Every product has a printable EAN-13 barcode, or use the real Puma / Mufti / JPG tags.
2. **Sign in and shop.** On your phone (`npm run dev:https`, then open the `https://<LAN-IP>:5173` URL that Vite prints), sign in with a mobile number. You land on the shop home. Tap **Open scanner** and scan tags from different showrooms. No camera? Use **Type barcode** (e.g. `8905310522667`, `FZ-SHIRT`), **Browse catalog**, or **Simulate a scan**.
3. **Edge cases.** Add `JS-NECKLACE` three times (only 2 in stock) to see the out-of-stock message, or enter `8909999999999` for the invalid-barcode alert.
4. **Pay with cash.** At checkout choose **Cash at the cash desk**. The receipt shows a bill barcode and "pay at the cash desk".
5. **Cash desk.** In another tab, open `/#/pos`, sign in as the cashier, and start the day with an opening amount. Find the bill by the customer's phone number, enter ₹5,000, and read off the change. The customer's receipt flips to paid.
6. **End of day.** Press **End of day**, enter what you counted, and close. You get the report showing cash left in the drawer and any over / short.

---

## Architecture

```text
flashcart/
├── package.json                  # root scripts (setup / dev / build / test)
├── backend/                      # Node.js + Express 5 (ESM)
│   ├── data/flashcart.db         # SQLite database (created on first run, git-ignored)
│   ├── scripts/add-cashier.js    # create / reset cashier accounts
│   ├── src/
│   │   ├── server.js             # boot, sweeper, graceful shutdown
│   │   ├── app.js                # composition root + static frontend in prod
│   │   ├── config/env.js         # typed env config
│   │   ├── db/database.js        # schema + seeding (products, first cashier)
│   │   ├── store/sqliteStore.js  # all SQL lives here
│   │   ├── data/catalog.js       # seed showrooms + products
│   │   ├── services/
│   │   │   ├── auth.js           # phone sign-in, email/password sign-in, token → account
│   │   │   ├── pricing.js        # paise-exact GST engine: MRP or cost+GST, slabs, CGST/SGST, round-off
│   │   │   ├── sessions.js       # one open bag per customer, stock checks
│   │   │   ├── checkout.js       # Razorpay orders/verify, cash bills, invoices
│   │   │   ├── cashDesk.js       # bill lookup, cash + change, drawer shifts, end of day
│   │   │   └── gateway.js        # Razorpay SDK wrapper + simulated gateway
│   │   ├── routes/index.js       # REST endpoints + role guards
│   │   ├── middleware/http.js    # logging, token auth, JSON errors
│   │   └── lib/                  # auth (tokens, scrypt, phone), rate limit, ids, money
│   └── test/api.test.js          # end-to-end API tests
└── frontend/                     # React 19 + Vite 8 + Tailwind CSS 4 + Lucide
    └── src/
        ├── App.jsx               # hash router, sign-in guard, lazy routes
        ├── context/ShopContext.jsx
        ├── components/           # AuthLayout, BarcodeScanner, Barcode (SVG), ui/*
        └── features/
            ├── auth/             # customer phone sign-in
            ├── customer/         # Home, Scan, Catalog, Bag, Checkout, Receipts list
            ├── receipt/          # perforated ticket invoice (+ cash-desk bill barcode)
            ├── pos/              # cashier sign-in, start day, collect cash, drawer, day report
            ├── landing/
            └── labels/
```

### Money & tax model

- Product `cost` is GST-exclusive. When a product has an `mrp` (tag price incl. GST), the line total is exactly MRP × qty and the taxable value is backed out of it. All arithmetic runs in **integer paise**.
- Tax is aggregated per slab and split 50/50 into **CGST + SGST**.
- The payable amount is rounded to the nearest rupee with an explicit **round-off** line.
- Invoice numbers are sequential per Indian financial year: `FC/2627/000001`.

---

## API reference

Base URL `/api`. Errors look like `{ "error": { "code", "message", "details?" } }`. 🔓 = public, 👤 = customer token, 🧾 = cashier token.

| | Method & path | Body | Returns |
| --- | --- | --- | --- |
| 🔓 | `POST /auth/customer/login` | `{ phone }` | `{ token, customer }` |
| 🔓 | `POST /auth/cashier/login` | `{ email, password }` | `{ token, cashier }` |
| 👤🧾 | `GET /auth/me` | – | the signed-in account |
| 🔓 | `GET /products?category=&showroom=&q=` | – | `{ products, categories, showrooms }` |
| 🔓 | `GET /products/:barcode` | – | product (EAN-13 or SKU), including `mrp` (shelf price incl. GST) |
| 👤 | `POST /sessions` | – | the customer's open bag (`201` if new) |
| 👤 | `GET /cart/:sessionId` | – | `{ items, groups, taxBreakdown, summary }` |
| 👤 | `POST /cart/:sessionId/add` | `{ barcode, quantity? }` | `{ cart, item, added }` |
| 👤 | `PUT /cart/:sessionId/items/:itemId` | `{ quantity }` (0 removes) | cart |
| 👤 | `DELETE /cart/:sessionId/items/:itemId` | – | cart |
| 👤 | `POST /razorpay/orders` | `{ sessionId }` | `{ orderId, amount, keyId, mode }` |
| 👤 | `POST /razorpay/verify` | `{ sessionId, razorpay_order_id, razorpay_payment_id, razorpay_signature }` | receipt |
| 👤 | `POST /razorpay/mock/pay` | `{ orderId, method, outcome }` | signed payload (simulated mode only) |
| 👤 | `POST /checkout/payment` | `{ sessionId, method: "cash" }` | receipt with `billCode` (printed as a Code 128 barcode), payment due at the cash desk |
| 👤🧾 | `GET /receipt/:transactionId` | – | full tax invoice |
| 👤 | `GET /me/receipts` | – | the customer's bills |
| 🧾 | `GET /pos/pending` | – | unpaid cash bills |
| 🧾 | `POST /pos/lookup` | `{ code }` (bill barcode / `TX-…`, or phone) | `{ bill }` |
| 🧾 | `POST /pos/bills/:id/collect` | `{ cashReceived }` | `{ bill, change, drawer }` |
| 🧾 | `GET /pos/shift` | – | `{ shift, lastClosed }` |
| 🧾 | `POST /pos/shift/open` | `{ openingCash }` | `{ shift }` |
| 🧾 | `POST /pos/shift/close` | `{ countedCash? }` | `{ report }` (end-of-day summary) |

Common error codes: `INVALID_PHONE`, `INVALID_CREDENTIALS`, `AUTH_REQUIRED`, `LOGIN_EXPIRED`, `FORBIDDEN`, `TOO_MANY_ATTEMPTS`, `PRODUCT_NOT_FOUND`, `OUT_OF_STOCK`, `QUANTITY_LIMIT`, `SESSION_NOT_FOUND`, `CART_EMPTY`, `GATEWAY_ERROR`, `INVALID_SIGNATURE`, `SHIFT_NOT_OPEN`, `INSUFFICIENT_CASH`, `ALREADY_PAID`, `NO_PENDING_BILL`, `BILL_NOT_FOUND`.

---

## Production notes

- **Single-port deploy:** `npm run build && npm start` serves the SPA and the API from `:5005`.
- **Secrets:** set `AUTH_SECRET` and a strong `SEED_CASHIER_PASSWORD`, or create cashiers with `npm run cashier:add` and leave the seed values empty.
- **Backups:** the whole database is a single file. Copy `backend/data/flashcart.db` (with the API stopped, or use `sqlite3 … ".backup"`).
- **Webhooks:** for live payments, also subscribe to Razorpay's `payment.captured` webhook so an order settles even if the customer closes the tab right after paying.
- **Camera access:** browsers only allow the camera on `https://` or `localhost`.
