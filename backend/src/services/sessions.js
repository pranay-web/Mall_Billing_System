import { v4 as uuidv4 } from 'uuid';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { newSessionId } from '../lib/ids.js';
import { buildBill } from './pricing.js';

/** Customer sessions and the cart that lives inside each one. */
export const createSessionService = ({ store, config }) => {
  const ttlMs = config.sessionTtlMinutes * 60_000;
  const maxQty = config.maxLineQuantity;

  const touch = (session) => {
    const now = new Date();
    session.updatedAt = now.toISOString();
    if (session.status === 'active') session.expiresAt = new Date(now.getTime() + ttlMs).toISOString();
  };

  const isLive = (session) => session.status === 'active' && Date.parse(session.expiresAt) >= Date.now();

  /** Returns the customer's open bag, or starts a new one. `created` tells the caller which. */
  const openForCustomer = (customerId) => {
    for (const session of store.sessions.values()) {
      if (session.customerId === customerId && isLive(session)) return { session, created: false };
    }
    let id = newSessionId();
    while (store.sessions.has(id)) id = newSessionId();
    const now = new Date();
    const session = {
      id,
      customerId,
      status: 'active',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      lines: [],
      transactionId: null,
    };
    store.sessions.set(id, session);
    return { session, created: true };
  };

  /** Looks up a bag. With `customerId`, someone else's bag is reported as not found. */
  const get = (sessionId, { customerId } = {}) => {
    const session = store.sessions.get(String(sessionId).trim().toUpperCase());
    if (!session || (customerId !== undefined && session.customerId !== customerId)) {
      throw notFound('SESSION_NOT_FOUND', 'This shopping session no longer exists. Start a new session to continue.');
    }
    if (session.status === 'active' && Date.parse(session.expiresAt) < Date.now()) {
      store.sessions.delete(session.id);
      throw notFound('SESSION_EXPIRED', 'This shopping session expired due to inactivity. Start a new session to continue.');
    }
    return session;
  };

  /** Returns a session whose cart may still be modified or checked out. */
  const getActive = (sessionId, ctx) => {
    const session = get(sessionId, ctx);
    if (session.status !== 'active') {
      throw conflict('SESSION_CHECKED_OUT', 'This bag has already been checked out.', {
        transactionId: session.transactionId,
      });
    }
    return session;
  };

  const describe = (session) => ({
    sessionId: session.id,
    status: session.status,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    transactionId: session.transactionId,
    units: session.lines.reduce((acc, line) => acc + line.quantity, 0),
  });

  /** Live product data joined onto cart lines. */
  const resolveLines = (session) =>
    session.lines.map((line) => ({ ...line, product: store.getProduct(line.productId) }));

  const cartView = (session) => {
    const bill = buildBill(resolveLines(session));
    const withLimits = (item) => {
      const product = store.getProduct(item.productId);
      return { ...item, available: product.stock, maxQuantity: Math.min(product.stock, maxQty) };
    };
    return {
      sessionId: session.id,
      status: session.status,
      transactionId: session.transactionId,
      expiresAt: session.expiresAt,
      updatedAt: session.updatedAt,
      currency: 'INR',
      items: bill.items.map(withLimits),
      groups: bill.groups.map((g) => ({ ...g, items: g.items.map(withLimits) })),
      taxBreakdown: bill.taxBreakdown,
      summary: bill.summary,
    };
  };

  const parseQuantity = (value, { min }) => {
    const qty = value === undefined ? 1 : Number(value);
    if (!Number.isInteger(qty) || qty < min || qty > maxQty) {
      throw badRequest('INVALID_QUANTITY', `Quantity must be a whole number between ${min} and ${maxQty}.`);
    }
    return qty;
  };

  const assertStock = (product, requested, inBag = 0) => {
    if (product.stock <= 0) {
      throw conflict('OUT_OF_STOCK', `${product.name} is out of stock at ${product.showroom}.`, {
        productId: product.id,
        available: 0,
      });
    }
    if (requested > product.stock) {
      const extra = inBag > 0 ? ` You already have ${inBag} in your bag.` : '';
      throw conflict('OUT_OF_STOCK', `Only ${product.stock} × ${product.name} left in stock.${extra}`, {
        productId: product.id,
        available: product.stock,
        inBag,
      });
    }
    if (requested > maxQty) {
      throw conflict('QUANTITY_LIMIT', `You can add up to ${maxQty} of a single item per checkout.`, {
        productId: product.id,
        limit: maxQty,
      });
    }
  };

  const findLine = (session, itemId) => {
    const line = session.lines.find((l) => l.itemId === itemId);
    if (!line) throw notFound('ITEM_NOT_FOUND', 'That item is no longer in your bag.');
    return line;
  };

  const addItem = (sessionId, { barcode, quantity } = {}, ctx) => {
    const session = getActive(sessionId, ctx);
    const code = typeof barcode === 'string' ? barcode.trim() : '';
    if (!code || code.length > 64) {
      throw badRequest('INVALID_BARCODE', 'Scan or enter a valid barcode.');
    }
    const qty = parseQuantity(quantity, { min: 1 });
    const product = store.findProductByCode(code);
    if (!product) {
      throw notFound('PRODUCT_NOT_FOUND', `No product matches barcode “${code}”. Check the code or browse the catalog.`);
    }

    const existing = session.lines.find((l) => l.productId === product.id);
    const inBag = existing?.quantity ?? 0;
    assertStock(product, inBag + qty, inBag);

    let line = existing;
    if (line) {
      line.quantity += qty;
    } else {
      line = { itemId: uuidv4(), productId: product.id, quantity: qty, addedAt: new Date().toISOString() };
      session.lines.push(line);
    }
    touch(session);

    const cart = cartView(session);
    return { cart, item: cart.items.find((i) => i.itemId === line.itemId), added: qty };
  };

  const updateQuantity = (sessionId, itemId, { quantity } = {}, ctx) => {
    const session = getActive(sessionId, ctx);
    const line = findLine(session, itemId);
    const qty = parseQuantity(quantity, { min: 0 });
    if (qty === 0) {
      session.lines = session.lines.filter((l) => l.itemId !== itemId);
    } else {
      assertStock(store.getProduct(line.productId), qty);
      line.quantity = qty;
    }
    touch(session);
    return cartView(session);
  };

  const removeItem = (sessionId, itemId, ctx) => {
    const session = getActive(sessionId, ctx);
    findLine(session, itemId);
    session.lines = session.lines.filter((l) => l.itemId !== itemId);
    touch(session);
    return cartView(session);
  };

  return { openForCustomer, get, getActive, describe, resolveLines, cartView, addItem, updateQuantity, removeItem, touch };
};
