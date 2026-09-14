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
- **Razorpay Integration**: Live payment processing with UPI, Card, and digital payment support.
- **Multi-Method Checkout**: Support for UPI (QR code), Credit/Debit Card, and Cash.
- **Cashier POS Terminal**: Session ID lookup, merchandise audit, and exit clearance authorization.
- **Modern Minimal UI**: Polished SaaS aesthetics with Inter typography and light mode design.

## Getting Started

### 1. Backend Setup
```bash
cd backend
npm install
node server.js
```
Runs by default on port `5005`.

#### Razorpay Configuration
1. Sign up at [Razorpay Dashboard](https://dashboard.razorpay.com)
2. Get your **API Key ID** and **API Key Secret** from Settings → API Keys
3. Create a `.env` file in the `backend/` directory:
```env
RAZORPAY_KEY_ID=your_key_id_here
RAZORPAY_KEY_SECRET=your_key_secret_here
```

**Test Mode**: By default, the app uses Razorpay test credentials. No .env file is required for demo purposes.

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Runs by default on `http://localhost:5173`. Automatically accessible on local Wi-Fi / network.

## Payment Integration (Razorpay)

### How It Works
1. **Frontend**: Customer selects payment method (UPI, Card, or Cash)
2. **Order Creation**: Frontend sends cart details to backend to create a Razorpay order
3. **Razorpay Checkout**: Razorpay hosted checkout form opens with payment options
4. **Payment Processing**: Customer completes payment in Razorpay modal
5. **Signature Verification**: Backend verifies payment signature for security
6. **Receipt Generation**: Transaction saved and receipt displayed to customer

### Payment Methods Supported
- **UPI**: Google Pay, PhonePe, Paytm, BHIM
- **Card**: Visa, Mastercard, RuPay, American Express
- **Cash**: Payment at central cashier desk (manual verification)

### Testing with Razorpay
Use these test credentials in Razorpay's test mode:
- **Card Number**: 4111 1111 1111 1111
- **Expiry**: Any future date (e.g., 12/25)
- **CVV**: Any 3 digits (e.g., 123)

## API Endpoints

### Sessions
- `POST /api/sessions` - Create new shopping session
- `GET /api/sessions/:sessionId` - Get session details

### Products
- `GET /api/products` - Get all products
- `GET /api/products/:barcode` - Get product by barcode

### Cart
- `POST /api/cart/:sessionId/add` - Add item to cart
- `GET /api/cart/:sessionId` - Get cart
- `PUT /api/cart/:sessionId/items/:itemId` - Update item quantity
- `DELETE /api/cart/:sessionId/items/:itemId` - Remove item

### Payment (Razorpay)
- `POST /api/razorpay/orders` - Create Razorpay order
- `POST /api/razorpay/verify` - Verify payment signature

### Receipts
- `GET /api/receipt/:transactionId` - Get receipt details
