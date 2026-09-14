# FlashCart - Smart Mall Billing & Unified Checkout System

A web-based and hardware-ready smart mall shopping and billing platform. Shop across multiple stores with one cart, one checkout, and one receipt.

## Architecture

```text
mall-billing-system/
├── frontend/             # React 19 + Vite + Tailwind CSS + Lucide Icons
│   ├── src/
│   │   ├── components/   # Scanner, Cart, Checkout, etc.
│   │   ├── pages/        # Home, CustomerApp, CashierDashboard
│   │   ├── config.js     # Dynamic API host config for local & LAN access
│   │   └── index.css     # Inter typography & clean SaaS theme
│   ├── public/
│   └── package.json
├── backend/              # Node.js + Express.js APIs and business logic
│   ├── server.js         # REST endpoints for products, sessions, carts, checkouts
│   └── package.json
└── README.md
```

## Features

- **Unified Shopping**: Scan items from fashion, electronics, food, and grocery stores under one session.
- **Real-time Bag & Cart Sync**: Dynamic cart badge counter, live subtotal, multi-tier GST, and discounts.
- **Camera Barcode Scanner**: Built-in camera scanner with HTML5-QRCode + manual barcode entry fallback.
- **Multi-Method Checkout**: Support for UPI (QR code), Credit/Debit Card, and Cash.
- **Cashier POS Terminal**: Session ID lookup, merchandise audit, and exit clearance authorization.
- **Modern Minimal UI**: Polished SaaS aesthetics with Inter typography and light mode design.

## Getting Started

### 1. Backend
```bash
cd backend
npm install
node server.js
```
Runs by default on port `5005`.

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```
Runs by default on `http://localhost:5173`. Automatically accessible on local Wi-Fi / network.
