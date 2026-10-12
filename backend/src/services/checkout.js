import { v4 as uuidv4 } from 'uuid';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { newTransactionId } from '../lib/ids.js';
import { buildBill } from './pricing.js';

const ORDER_REUSE_WINDOW_MS = 15 * 60_000;

/** Older receipts encoded the bill as `FLASHCART:BILL:<id>`; the desk still accepts that form. */
export const LEGACY_BILL_PREFIX = 'FLASHCART:BILL:';

/** Turns a cart into a settled transaction — online via Razorpay, or as a cash bill paid at the desk. */
export const createCheckoutService = ({ store, config, sessions, gateway }) => {
  // ---------- Views ----------
  const statusOf = (txn) => (txn.payment.status === 'paid' ? 'paid' : 'awaiting_payment');

  const receipt = (txn) => ({
    transactionId: txn.id,
    reference: txn.uuid,
    invoiceNumber: txn.invoiceNumber,
    sessionId: txn.sessionId,
    customer: { phone: txn.customerPhone ?? null },
    issuedAt: txn.createdAt,
    status: statusOf(txn),
    currency: 'INR',
    mall: config.mall,
    items: txn.bill.items,
    groups: txn.bill.groups,
    taxBreakdown: txn.bill.taxBreakdown,
    summary: txn.bill.summary,
    payment: txn.payment,
    // Printed as a Code 128 barcode on cash bills; the desk scanner reads it straight into lookup.
    billCode: txn.id,
  });

  const summaryRow = (txn) => ({
    transactionId: txn.id,
    invoiceNumber: txn.invoiceNumber,
    issuedAt: txn.createdAt,
    status: statusOf(txn),
    units: txn.bill.summary.units,
    stores: txn.bill.groups.length,
    grandTotal: txn.bill.summary.grandTotal,
    paymentMethod: txn.payment.method,
  });

  // ---------- Settlement ----------
  const fingerprint = (session) =>
    session.lines
      .map((l) => `${l.productId}x${l.quantity}`)
      .sort()
      .join(',');

  /** Validates a cart is payable right now and freezes it into a bill. */
  const prepareBill = (session) => {
    if (session.lines.length === 0) {
      throw badRequest('CART_EMPTY', 'Your bag is empty. Scan an item to get started.');
    }
    for (const line of session.lines) {
      const product = store.getProduct(line.productId);
      if (!product || line.quantity > product.stock) {
        const available = product?.stock ?? 0;
        throw conflict(
          'OUT_OF_STOCK',
          available === 0
            ? `${product?.name ?? 'An item'} just sold out. Remove it from your bag to continue.`
            : `Only ${available} × ${product.name} left. Update your bag to continue.`,
          { productId: line.productId, itemId: line.itemId, available },
        );
      }
    }
    return buildBill(sessions.resolveLines(session));
  };

  const settle = ({ session, customerId, bill, payment }) => {
    const customer = store.getCustomer(customerId);
    let id = newTransactionId();
    while (store.hasTransaction(id)) id = newTransactionId();
    const now = new Date();

    const txn = store.atomic(() => {
      for (const item of bill.items) {
        const product = store.getProduct(item.productId);
        if (product && product.stock < item.quantity) {
          // Only reachable if stock sold out while the customer was inside Razorpay Checkout.
          console.warn(`[stock] ${product.name}: paid for ${item.quantity}, only ${product.stock} on hand.`);
        }
        store.adjustStock(item.productId, -item.quantity);
      }
      return store.saveTransaction({
        id,
        uuid: uuidv4(),
        invoiceNumber: store.nextInvoiceNumber(now),
        sessionId: session?.id ?? 'n/a',
        customerId,
        customerPhone: customer?.phone ?? null,
        createdAt: now.toISOString(),
        bill,
        payment,
      });
    });

    if (session) {
      session.status = 'checked_out';
      session.transactionId = id;
      sessions.touch(session);
    }
    return txn;
  };

  // ---------- Razorpay ----------
  const orderView = (order) => ({
    orderId: order.id,
    amount: order.amountPaise,
    currency: 'INR',
    keyId: gateway.keyId,
    mode: gateway.mode,
    sessionId: order.sessionId,
    merchant: config.mall.name,
    summary: order.bill.summary,
  });

  const createOrder = async ({ sessionId } = {}, ctx) => {
    if (!sessionId) throw badRequest('SESSION_REQUIRED', 'A sessionId is required.');
    const session = sessions.getActive(sessionId, ctx);
    const bill = prepareBill(session);
    const fp = fingerprint(session);

    // Re-use the open order if the bag is unchanged (retries after a failed attempt, double taps).
    const open = session.pendingOrderId && store.orders.get(session.pendingOrderId);
    if (
      open &&
      open.status === 'created' &&
      open.fingerprint === fp &&
      open.amountPaise === bill.amountPaise &&
      Date.now() - Date.parse(open.createdAt) < ORDER_REUSE_WINDOW_MS
    ) {
      return orderView(open);
    }

    const created = await gateway.createOrder({
      amount: bill.amountPaise,
      receipt: `${session.id}-${Date.now().toString(36)}`.slice(0, 40),
      notes: { sessionId: session.id, units: String(bill.summary.units), mall: config.mall.name },
    });

    const order = {
      id: created.id,
      sessionId: session.id,
      customerId: session.customerId,
      amountPaise: bill.amountPaise,
      fingerprint: fp,
      bill,
      status: 'created',
      createdAt: new Date().toISOString(),
      transactionId: null,
    };
    store.orders.set(order.id, order);
    session.pendingOrderId = order.id;
    return orderView(order);
  };

  const getOwnOrder = (orderId, ctx) => {
    const order = store.orders.get(String(orderId ?? ''));
    if (!order || order.customerId !== ctx.customerId) {
      throw notFound('ORDER_NOT_FOUND', 'Payment order not found. Please restart checkout.');
    }
    return order;
  };

  const verifyPayment = async (body = {}, ctx) => {
    const orderId = body.razorpay_order_id ?? body.orderId;
    const paymentId = body.razorpay_payment_id ?? body.paymentId;
    const signature = body.razorpay_signature ?? body.signature;
    if (!orderId || !paymentId || !signature) {
      throw badRequest('INVALID_PAYMENT_PAYLOAD', 'razorpay_order_id, razorpay_payment_id and razorpay_signature are required.');
    }

    const order = getOwnOrder(orderId, ctx);

    if (!gateway.verifySignature({ orderId, paymentId, signature })) {
      console.warn(`[razorpay] signature mismatch for ${orderId} / ${paymentId}`);
      throw badRequest(
        'INVALID_SIGNATURE',
        `Payment could not be verified, so no invoice was issued. If money was debited, quote payment ID ${paymentId} at the help desk.`,
      );
    }

    // Idempotent: replays of the same successful callback return the same receipt.
    if (order.status === 'paid') {
      const txn = store.getTransaction(order.transactionId);
      if (txn?.payment.razorpayPaymentId === paymentId) return receipt(txn);
      throw conflict('ORDER_ALREADY_PAID', 'This order was already settled with a different payment.');
    }
    if (order.status === 'settling') {
      throw conflict('PAYMENT_IN_PROGRESS', 'This payment is already being processed. Please wait a moment.');
    }

    const session = store.sessions.get(order.sessionId) ?? null;
    if (session && session.status !== 'active') {
      throw conflict(
        'ALREADY_SETTLED',
        `This bag was already settled as ${session.transactionId}. Quote payment ID ${paymentId} at the help desk for a refund.`,
      );
    }

    order.status = 'settling';
    try {
      const details = await gateway.fetchPaymentDetails(paymentId);
      const txn = settle({
        session,
        customerId: order.customerId,
        bill: order.bill,
        payment: {
          channel: 'razorpay',
          method: details?.method ?? 'online',
          status: 'paid',
          amount: order.bill.summary.grandTotal,
          paidAt: new Date().toISOString(),
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          details,
          gatewayMode: gateway.mode,
        },
      });
      order.status = 'paid';
      order.transactionId = txn.id;
      return receipt(txn);
    } catch (err) {
      order.status = 'created';
      throw err;
    }
  };

  const simulatePayment = ({ orderId, method, outcome } = {}, ctx) => {
    if (gateway.mode !== 'mock') {
      throw forbidden('MOCK_DISABLED', 'The simulated gateway is only available when Razorpay keys are not configured.');
    }
    const order = getOwnOrder(orderId, ctx);
    return gateway.simulatePayment({ orderId: order.id, method, outcome });
  };

  // ---------- Cash at the desk ----------
  const createCashBill = ({ sessionId, method = 'cash' } = {}, ctx) => {
    if (method !== 'cash') throw badRequest('INVALID_METHOD', 'Only cash can be paid at the desk.');
    if (!sessionId) throw badRequest('SESSION_REQUIRED', 'A sessionId is required.');
    const session = sessions.getActive(sessionId, ctx);
    const bill = prepareBill(session);
    const txn = settle({
      session,
      customerId: session.customerId,
      bill,
      payment: {
        channel: 'desk',
        method: 'cash',
        status: 'pending',
        amount: bill.summary.grandTotal,
        paidAt: null,
        collection: null,
      },
    });
    return receipt(txn);
  };

  // ---------- Reads ----------
  const getTransaction = (transactionId) => {
    const txn = store.getTransaction(String(transactionId).trim().toUpperCase());
    if (!txn) throw notFound('RECEIPT_NOT_FOUND', 'No bill exists for this ID.');
    return txn;
  };

  /** Customers can only open their own receipts; cashiers can open any. */
  const getReceiptFor = (transactionId, account) => {
    const txn = getTransaction(transactionId);
    if (account.role === 'customer' && txn.customerId !== account.id) {
      throw notFound('RECEIPT_NOT_FOUND', 'No bill exists for this ID.');
    }
    return receipt(txn);
  };

  const listForCustomer = (customerId) => store.listCustomerTransactions(customerId, 20).map(summaryRow);

  return {
    createOrder,
    verifyPayment,
    simulatePayment,
    createCashBill,
    getTransaction,
    getReceiptFor,
    listForCustomer,
    receipt,
    summaryRow,
  };
};
