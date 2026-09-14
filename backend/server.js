// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Razorpay with credentials from .env
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.error('❌ Missing Razorpay credentials in .env file!');
  process.exit(1);
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ==================== MOCK DATA ====================
const products = [
  // Clothing (18% GST)
  { id: 1, barcode: 'SHIRT001', name: 'Blue Casual Shirt', price: 500, gst: 18, category: 'clothing', stock: 50, showroom: 'Fashion Zone' },
  { id: 2, barcode: 'JEANS001', name: 'Dark Blue Jeans', price: 1200, gst: 18, category: 'clothing', stock: 30, showroom: 'Fashion Zone' },
  { id: 3, barcode: 'TSHIRT001', name: 'Cotton T-Shirt', price: 300, gst: 18, category: 'clothing', stock: 100, showroom: 'Fashion Zone' },

  // Electronics (12% GST)
  { id: 4, barcode: 'EARBUDS001', name: 'Wireless Earbuds', price: 2000, gst: 12, category: 'electronics', stock: 25, showroom: 'Tech Store' },
  { id: 5, barcode: 'CHARGER001', name: 'Fast Charger 65W', price: 800, gst: 12, category: 'electronics', stock: 40, showroom: 'Tech Store' },
  { id: 6, barcode: 'CABLE001', name: 'USB-C Cable', price: 150, gst: 12, category: 'electronics', stock: 200, showroom: 'Tech Store' },

  // Food (5% GST)
  { id: 7, barcode: 'PIZZA001', name: 'Veggie Pizza', price: 250, gst: 5, category: 'food', stock: 15, showroom: 'Food Court' },
  { id: 8, barcode: 'BURGER001', name: 'Cheese Burger', price: 150, gst: 5, category: 'food', stock: 20, showroom: 'Food Court' },
  { id: 9, barcode: 'COFFEE001', name: 'Cappuccino', price: 80, gst: 5, category: 'food', stock: 100, showroom: 'Food Court' },

  // Jewelry (18% GST)
  { id: 10, barcode: 'RING001', name: 'Gold Ring', price: 5000, gst: 18, category: 'jewelry', stock: 10, showroom: 'Jewelry Store' },
  { id: 11, barcode: 'BRACELET001', name: 'Silver Bracelet', price: 1500, gst: 18, category: 'jewelry', stock: 20, showroom: 'Jewelry Store' },
  { id: 12, barcode: 'NECKLACE001', name: 'Pearl Necklace', price: 3000, gst: 18, category: 'jewelry', stock: 15, showroom: 'Jewelry Store' },
];

// In-memory sessions and transactions storage
const sessions = new Map();
const transactions = new Map();

// ==================== ROUTES ====================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server running!', time: new Date().toISOString() });
});

// Get product by barcode
app.get('/api/products/:barcode', (req, res) => {
  const { barcode } = req.params;
  const product = products.find(p => p.barcode.toLowerCase() === barcode.toLowerCase());

  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  res.json(product);
});

// Get all products (for search)
app.get('/api/products', (req, res) => {
  res.json(products);
});

// Create session
app.post('/api/sessions', (req, res) => {
  const sessionId = uuidv4().slice(0, 8).toUpperCase();
  const session = {
    sessionId,
    createdAt: new Date(),
    items: [],
    status: 'active',
    expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
  };

  sessions.set(sessionId, session);

  res.json(session);
});

// Get session
app.get('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json(session);
});

// Get cart
app.get('/api/cart/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // Calculate totals
  const cartItems = session.items;
  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalGST = cartItems.reduce((sum, item) => sum + (item.price * item.quantity * item.gst / 100), 0);
  const finalTotal = subtotal + totalGST;

  res.json({
    sessionId,
    items: cartItems,
    subtotal: parseFloat(subtotal.toFixed(2)),
    totalGST: parseFloat(totalGST.toFixed(2)),
    finalTotal: parseFloat(finalTotal.toFixed(2)),
    itemCount: cartItems.length
  });
});

// Add item to cart
app.post('/api/cart/:sessionId/add', (req, res) => {
  const { sessionId } = req.params;
  const { barcode, quantity = 1 } = req.body;

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const product = products.find(p => p.barcode.toLowerCase() === barcode.toLowerCase());
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  // Check if product already in cart
  const existingItem = session.items.find(item => item.id === product.id);

  if (existingItem) {
    // Duplicate scan - increment quantity
    existingItem.quantity += quantity;
  } else {
    // New product - add to cart
    session.items.push({
      id: product.id,
      barcode: product.barcode,
      name: product.name,
      price: product.price,
      gst: product.gst,
      quantity,
      category: product.category,
      showroom: product.showroom
    });
  }

  res.json({ success: true, item: existingItem || session.items[session.items.length - 1] });
});

// Update quantity
app.put('/api/cart/:sessionId/items/:itemId', (req, res) => {
  const { sessionId, itemId } = req.params;
  const { quantity } = req.body;

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const item = session.items.find(i => i.id === parseInt(itemId));
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  if (quantity <= 0) {
    session.items = session.items.filter(i => i.id !== parseInt(itemId));
  } else {
    item.quantity = quantity;
  }

  res.json({ success: true });
});

// Remove item from cart
app.delete('/api/cart/:sessionId/items/:itemId', (req, res) => {
  const { sessionId, itemId } = req.params;

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  session.items = session.items.filter(i => i.id !== parseInt(itemId));

  res.json({ success: true });
});

// Verify cart (cashier)
app.post('/api/checkout/verify', (req, res) => {
  const { sessionId } = req.body;

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (session.items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  const cartItems = session.items;
  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalGST = cartItems.reduce((sum, item) => sum + (item.price * item.quantity * item.gst / 100), 0);
  const finalTotal = subtotal + totalGST;

  res.json({
    sessionId,
    items: cartItems,
    subtotal: parseFloat(subtotal.toFixed(2)),
    totalGST: parseFloat(totalGST.toFixed(2)),
    finalTotal: parseFloat(finalTotal.toFixed(2)),
    status: 'verified'
  });
});

// Create Razorpay Order
app.post('/api/razorpay/orders', async (req, res) => {
  try {
    const { sessionId, discount = 0 } = req.body;

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const cartItems = session.items;
    const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalGST = cartItems.reduce((sum, item) => sum + (item.price * item.quantity * item.gst / 100), 0);
    const finalAmount = Math.round((subtotal + totalGST - discount) * 100); // Razorpay expects amount in paise

    const orderOptions = {
      amount: finalAmount,
      currency: 'INR',
      receipt: `order_${sessionId}`,
      payment_capture: 1, // Auto-capture payment
      notes: {
        sessionId,
        subtotal,
        totalGST,
        discount
      }
    };

    const order = await razorpay.orders.create(orderOptions);

    res.json({
      success: true,
      orderId: order.id,
      amount: finalAmount,
      currency: 'INR',
      key: process.env.RAZORPAY_KEY_ID || 'rzp_test_1DP5MMOk78U80Q'
    });
  } catch (error) {
    console.error('Error creating order:', error);
    const errorMessage = error.error?.description || error.message || 'Failed to create Razorpay order. Please configure valid RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.';
    res.status(500).json({ error: errorMessage });
  }
});

// Verify Razorpay Payment
app.post('/api/razorpay/verify', (req, res) => {
  try {
    const { orderId, paymentId, signature, sessionId, discount = 0 } = req.body;

    // Create signature for verification
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'w42D4E12345678901234567890')
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (generatedSignature !== signature) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    // Payment verified successfully
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const cartItems = session.items;
    const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalGST = cartItems.reduce((sum, item) => sum + (item.price * item.quantity * item.gst / 100), 0);
    const finalTotal = subtotal + totalGST - discount;

    const transactionId = uuidv4().slice(0, 8).toUpperCase();
    const transaction = {
      transactionId,
      sessionId,
      items: cartItems,
      subtotal: parseFloat(subtotal.toFixed(2)),
      discount: parseFloat(discount.toFixed(2)),
      totalGST: parseFloat(totalGST.toFixed(2)),
      finalTotal: parseFloat(finalTotal.toFixed(2)),
      paymentMethod: 'razorpay',
      paymentId,
      orderId,
      status: 'completed',
      completedAt: new Date(),
      receiptUrl: `/api/receipt/${transactionId}`
    };

    transactions.set(transactionId, transaction);
    session.status = 'completed';

    res.json({
      success: true,
      transaction
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    const errorMessage = error.error?.description || error.message || 'Payment verification failed.';
    res.status(500).json({ error: errorMessage });
  }
});

// Process payment and create transaction
app.post('/api/checkout/payment', (req, res) => {
  const { sessionId, paymentMethod, discount = 0 } = req.body;

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const cartItems = session.items;
  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalGST = cartItems.reduce((sum, item) => sum + (item.price * item.quantity * item.gst / 100), 0);
  const finalTotal = subtotal + totalGST - discount;

  const transactionId = uuidv4().slice(0, 8).toUpperCase();
  const transaction = {
    transactionId,
    sessionId,
    items: cartItems,
    subtotal: parseFloat(subtotal.toFixed(2)),
    discount: parseFloat(discount.toFixed(2)),
    totalGST: parseFloat(totalGST.toFixed(2)),
    finalTotal: parseFloat(finalTotal.toFixed(2)),
    paymentMethod,
    status: 'completed',
    completedAt: new Date(),
    receiptUrl: `/api/receipt/${transactionId}`
  };

  transactions.set(transactionId, transaction);
  session.status = 'completed';

  res.json(transaction);
});

// Get receipt
app.get('/api/receipt/:transactionId', (req, res) => {
  const { transactionId } = req.params;
  const transaction = transactions.get(transactionId);

  if (!transaction) {
    return res.status(404).json({ error: 'Receipt not found' });
  }

  res.json(transaction);
});

// ==================== SERVER START ====================
const PORT = process.env.PORT || 5005;

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📝 Health check: http://localhost:${PORT}/api/health`);
});
