import { v4 as uuidv4 } from 'uuid';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { maskPhone, normalizeIndianMobile } from '../lib/auth.js';
import { newCreditNoteId } from '../lib/ids.js';
import { toPaise, toRupees } from '../lib/money.js';
import { LEGACY_BILL_PREFIX } from './checkout.js';
import { buildCreditNote } from './pricing.js';
import { CATEGORIES, SHOWROOMS } from '../data/catalog.js';
import { randomBytes } from 'node:crypto';

const GST_RATES = [0, 3, 5, 12, 18, 28];
const BARCODE = /^[0-9A-Za-z-]{6,64}$/;

const NON_RETURNABLE = new Set(['food']);
const RETURN_REASONS = ['Wrong size / fit', 'Damaged or defective', 'Not as described', 'Changed my mind', 'Duplicate purchase', 'Other'];

/**
 * The cash desk: find a customer's bill, take their cash, tell the cashier how much
 * change to return, process returns with a GST credit note, and keep a running drawer
 * total for the day — one drawer per cashier, all visible side by side.
 */
export const createCashDeskService = ({ store, config, checkout, loyalty }) => {
  const asAmount = (value, { field, allowZero = true }) => {
    const n = Number(value);
    if (value === '' || value === null || value === undefined || !Number.isFinite(n) || n < 0 || (!allowZero && n === 0)) {
      throw badRequest('INVALID_AMOUNT', `Enter a valid ${field}.`);
    }
    if (n > 10_000_000) throw badRequest('INVALID_AMOUNT', `${field[0].toUpperCase()}${field.slice(1)} looks too large.`);
    return toRupees(toPaise(n));
  };

  const amountDueOf = (txn) => txn.payment.amount ?? txn.bill.summary.amountDue ?? txn.bill.summary.grandTotal;
  const returnedQty = (txn, itemId) => txn.returnedQuantities?.[itemId] ?? 0;

  const returnWindowClosesAt = (txn) => new Date(Date.parse(txn.createdAt) + (config.returnWindowDays ?? 30) * 86_400_000).toISOString();

  /** What the cashier sees for a bill: enough to take cash, or to process a return. */
  const deskBill = (txn) => ({
    transactionId: txn.id,
    invoiceNumber: txn.invoiceNumber,
    issuedAt: txn.createdAt,
    customerPhone: maskPhone(txn.customerPhone),
    units: txn.bill.summary.units,
    stores: txn.bill.groups.map((g) => g.showroom),
    grandTotal: txn.bill.summary.grandTotal,
    pointsValue: txn.bill.summary.pointsValue ?? 0,
    amountDue: amountDueOf(txn),
    status: txn.payment.status === 'paid' ? 'paid' : 'awaiting_payment',
    paymentMethod: txn.payment.method,
    paymentChannel: txn.payment.channel,
    paidAt: txn.payment.paidAt ?? null,
    collection: txn.payment.collection ?? null,
    refundStatus: txn.refundStatus ?? 'none',
    refunds: txn.refunds ?? [],
    returnWindowClosesAt: returnWindowClosesAt(txn),
    returnable: txn.payment.status === 'paid' && Date.parse(returnWindowClosesAt(txn)) > Date.now(),
    items: txn.bill.items.map((i) => ({
      itemId: i.itemId,
      name: i.name,
      showroom: i.showroom,
      showroomId: i.showroomId,
      category: i.category,
      quantity: i.quantity,
      returnedQuantity: returnedQty(txn, i.itemId),
      returnableQuantity: NON_RETURNABLE.has(i.category) ? 0 : i.quantity - returnedQty(txn, i.itemId),
      nonReturnable: NON_RETURNABLE.has(i.category),
      unitMrp: i.unitMrp,
      total: i.total,
      gstRate: i.gstRate,
    })),
  });

  const pending = () => store.listPending(50).map(deskBill);

  /** Accepts a scanned bill barcode / transaction ID, or the customer's phone number. */
  const lookup = (rawCode) => {
    const code = String(rawCode ?? '').trim();
    if (!code) throw badRequest('CODE_REQUIRED', 'Scan the bill barcode, or enter the bill ID or customer’s phone number.');

    const transactionId = code.toUpperCase().startsWith(LEGACY_BILL_PREFIX) ? code.slice(LEGACY_BILL_PREFIX.length) : code;
    const txn = store.getTransaction(transactionId.toUpperCase());
    if (txn) return { bill: deskBill(txn) };

    const phone = normalizeIndianMobile(code);
    if (phone) {
      const [latest] = store.listPendingByPhone(phone);
      if (latest) return { bill: deskBill(latest) };
      throw notFound('NO_PENDING_BILL', `No unpaid cash bill for ${maskPhone(phone)}.`);
    }

    throw notFound('BILL_NOT_FOUND', `No bill matches “${code}”.`);
  };

  // ---------- Shift / drawer ----------
  const requireOpenShift = (cashierId) => {
    const shift = store.getOpenShift(cashierId);
    if (!shift) throw conflict('SHIFT_NOT_OPEN', 'Start your day (enter opening cash) before taking payments.');
    return shift;
  };

  const sumPaise = (list, pick) => list.reduce((acc, entry) => acc + toPaise(pick(entry)), 0);

  const shiftSummary = (shift, { detailed = true } = {}) => {
    const collections = store.listShiftCollections(shift.id);
    const refunds = store.listShiftRefunds(shift.id);
    const cashRefunds = refunds.filter((r) => r.method === 'cash');

    const cashSales = toRupees(sumPaise(collections, amountDueOf));
    const cashReceived = toRupees(sumPaise(collections, (t) => t.payment.collection.received));
    const changeReturned = toRupees(sumPaise(collections, (t) => t.payment.collection.change));
    const cashRefunded = toRupees(sumPaise(cashRefunds, (r) => r.summary.refundAmount));
    const cashInDrawer = toRupees(toPaise(shift.openingCash) + toPaise(cashSales) - toPaise(cashRefunded));

    const counted = shift.countedCash;
    const cashier = shift.cashierName ?? store.getCashier(shift.cashierId)?.name ?? null;

    const summary = {
      shiftId: shift.id,
      cashierId: shift.cashierId,
      cashierName: cashier,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt,
      openingCash: shift.openingCash,
      billsCollected: collections.length,
      cashSales,
      cashReceived,
      changeReturned,
      refundsIssued: refunds.length,
      cashRefunded,
      cashInDrawer,
      countedCash: counted,
      difference: counted === null || counted === undefined ? null : toRupees(toPaise(counted) - toPaise(cashInDrawer)),
    };
    if (!detailed) return summary;

    const stillPending = store.listPending(500);
    return {
      ...summary,
      pendingBills: stillPending.length,
      pendingAmount: toRupees(sumPaise(stillPending, amountDueOf)),
      collections: collections.map((t) => ({
        transactionId: t.id,
        invoiceNumber: t.invoiceNumber,
        amount: amountDueOf(t),
        received: t.payment.collection.received,
        change: t.payment.collection.change,
        collectedAt: t.payment.collection.collectedAt,
      })),
      refunds: refunds.map((r) => ({
        creditNoteId: r.id,
        creditNoteNumber: r.creditNoteNumber,
        invoiceNumber: r.invoiceNumber,
        amount: r.summary.refundAmount,
        method: r.method,
        units: r.summary.units,
        createdAt: r.createdAt,
      })),
    };
  };

  const startOfToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  };

  /** Every cashier's drawer today — open ones live, closed ones with their count. */
  const drawers = (cashier) => {
    const list = store.listShiftsSince(startOfToday()).map((s) => ({ ...shiftSummary(s, { detailed: false }), isMine: s.cashierId === cashier.id }));
    const open = list.filter((d) => !d.closedAt);
    return {
      drawers: list,
      openDesks: open.length,
      cashOnFloor: toRupees(sumPaise(open, (d) => d.cashInDrawer)),
      cashSalesToday: toRupees(sumPaise(list, (d) => d.cashSales)),
      cashRefundedToday: toRupees(sumPaise(list, (d) => d.cashRefunded)),
    };
  };

  const getShift = (cashier) => {
    const open = store.getOpenShift(cashier.id);
    const lastClosed = open ? null : store.getLastClosedShift(cashier.id);
    const lastClosedAny = open ? null : store.getLastClosedShiftAny();
    return {
      shift: open ? shiftSummary(open) : null,
      lastClosed: lastClosed ? shiftSummary(lastClosed) : null,
      // The most recently closed drawer in the mall, for taking over a colleague's float.
      handover: lastClosedAny && lastClosedAny.cashierId !== cashier.id ? shiftSummary(lastClosedAny, { detailed: false }) : null,
    };
  };

  const openShift = (cashier, { openingCash } = {}) => {
    if (store.getOpenShift(cashier.id)) throw conflict('SHIFT_ALREADY_OPEN', 'Your day is already open.');
    const amount = asAmount(openingCash ?? 0, { field: 'opening cash amount' });
    return { shift: shiftSummary(store.openShift(cashier.id, amount)) };
  };

  const closeShift = (cashier, { countedCash } = {}) => {
    const shift = requireOpenShift(cashier.id);
    const counted = countedCash === undefined || countedCash === null || countedCash === '' ? null : asAmount(countedCash, { field: 'counted cash amount' });
    return { report: shiftSummary(store.closeShift(shift.id, counted)) };
  };

  // ---------- Taking cash ----------
  const collectCash = (cashier, transactionId, { cashReceived } = {}) => {
    const shift = requireOpenShift(cashier.id);
    const txn = checkout.getTransaction(transactionId);
    if (txn.payment.status === 'paid') {
      throw conflict('ALREADY_PAID', `Bill ${txn.invoiceNumber} is already paid.`);
    }

    const received = asAmount(cashReceived, { field: 'cash received amount', allowZero: false });
    const due = toPaise(amountDueOf(txn));
    if (toPaise(received) < due) {
      throw badRequest('INSUFFICIENT_CASH', `Cash received is short by ₹${toRupees(due - toPaise(received)).toFixed(2)}.`);
    }
    const change = toRupees(toPaise(received) - due);

    const now = new Date().toISOString();
    txn.payment = {
      ...txn.payment,
      status: 'paid',
      paidAt: now,
      collection: { received, change, collectedAt: now, cashierId: cashier.id, cashierName: cashier.name, shiftId: shift.id },
    };
    store.atomic(() => {
      checkout.earnOn(txn);
      store.saveTransaction(txn);
    });

    return { bill: deskBill(txn), change, drawer: shiftSummary(shift) };
  };

  // ---------- Returns & refunds ----------
  const parseReturn = (txn, body = {}) => {
    if (txn.payment.status !== 'paid') {
      throw conflict('NOT_PAID', `Bill ${txn.invoiceNumber} hasn't been paid, so there is nothing to refund.`);
    }
    if (Date.parse(returnWindowClosesAt(txn)) <= Date.now()) {
      throw conflict('RETURN_WINDOW_CLOSED', `Returns on this bill closed after ${(config.returnWindowDays ?? 30)} days.`);
    }
    const requested = Array.isArray(body.items) ? body.items : [];
    if (requested.length === 0) throw badRequest('NO_ITEMS', 'Choose at least one item to return.');

    const seen = new Set();
    const items = requested.map(({ itemId, quantity }) => {
      const item = txn.bill.items.find((i) => i.itemId === itemId);
      if (!item || seen.has(itemId)) throw badRequest('ITEM_NOT_ON_BILL', 'That item is not on this bill.');
      seen.add(itemId);
      if (NON_RETURNABLE.has(item.category)) {
        throw conflict('NOT_RETURNABLE', `${item.name} is a food item and can't be returned.`, { itemId });
      }
      const qty = Number(quantity);
      const left = item.quantity - returnedQty(txn, itemId);
      if (!Number.isInteger(qty) || qty < 1) throw badRequest('INVALID_QUANTITY', `Enter how many ${item.name} are being returned.`);
      if (qty > left) {
        throw conflict('RETURN_EXCEEDS', left === 0 ? `${item.name} has already been returned in full.` : `Only ${left} × ${item.name} can still be returned.`, { itemId, left });
      }
      return { itemId, quantity: qty };
    });

    const method = body.method ?? (txn.payment.channel === 'razorpay' ? 'original' : 'cash');
    if (!['cash', 'original'].includes(method)) throw badRequest('INVALID_METHOD', 'Refund method must be cash or original.');
    if (method === 'original' && txn.payment.channel !== 'razorpay') {
      throw badRequest('INVALID_METHOD', 'This bill was paid in cash, so it can only be refunded in cash.');
    }

    const reason = String(body.reason ?? '').trim().slice(0, 200);
    return { items, method, reason };
  };

  /** Prices a return and works out the points side of it, without changing anything. */
  const quoteReturn = (txn, { items, method, reason }) => {
    const note = buildCreditNote(txn.bill.items, items);
    const invoiceTotal = toPaise(txn.bill.summary.grandTotal);
    const refundValue = toPaise(note.summary.grandTotal);
    const share = invoiceTotal > 0 ? refundValue / invoiceTotal : 0;

    // Points the customer redeemed on the returned portion come back as points, not cash.
    const redeemedLeft = (txn.loyalty?.pointsRedeemed ?? 0) - (txn.loyalty?.pointsReturned ?? 0);
    const pointsReturned = Math.max(0, Math.min(redeemedLeft, Math.round((txn.loyalty?.pointsRedeemed ?? 0) * share)));
    // Points earned on the returned portion are taken back.
    const earnedLeft = (txn.loyalty?.pointsEarned ?? 0) - (txn.loyalty?.pointsReversed ?? 0);
    const pointsReversed = Math.max(0, Math.min(earnedLeft, Math.round((txn.loyalty?.pointsEarned ?? 0) * share)));

    const refundAmount = toRupees(refundValue - pointsReturned * 100);
    const allReturned = txn.bill.items.every((i) => {
      const req = items.find((r) => r.itemId === i.itemId)?.quantity ?? 0;
      return NON_RETURNABLE.has(i.category) || returnedQty(txn, i.itemId) + req >= i.quantity;
    });

    return {
      transactionId: txn.id,
      invoiceNumber: txn.invoiceNumber,
      customerId: txn.customerId,
      customerPhone: txn.customerPhone ?? null,
      method,
      reason,
      items: note.items,
      groups: note.groups,
      taxBreakdown: note.taxBreakdown,
      summary: { ...note.summary, refundAmount, pointsReturned, pointsReversed },
      refundStatusAfter: allReturned ? 'full' : 'partial',
      returnWindowClosesAt: returnWindowClosesAt(txn),
    };
  };

  const previewReturn = (cashier, transactionId, body) => {
    const txn = checkout.getTransaction(transactionId);
    return { quote: quoteReturn(txn, parseReturn(txn, body)) };
  };

  const processReturn = (cashier, transactionId, body) => {
    const shift = requireOpenShift(cashier.id);
    const txn = checkout.getTransaction(transactionId);
    const request = parseReturn(txn, body);
    const quote = quoteReturn(txn, request);

    // A cash refund can only come out of this drawer.
    if (request.method === 'cash') {
      const { cashInDrawer } = shiftSummary(shift, { detailed: false });
      if (toPaise(quote.summary.refundAmount) > toPaise(cashInDrawer)) {
        throw conflict(
          'INSUFFICIENT_DRAWER',
          `Your drawer holds ₹${cashInDrawer.toFixed(2)}, less than the ₹${quote.summary.refundAmount.toFixed(2)} refund. Refund to the customer’s card / UPI, or top up the drawer first.`,
          { cashInDrawer, refundAmount: quote.summary.refundAmount },
        );
      }
    }

    let id = newCreditNoteId();
    while (store.hasRefund(id)) id = newCreditNoteId();
    const now = new Date();

    const creditNote = store.atomic(() => {
      // Items go back on the shelf.
      for (const line of request.items) {
        const item = txn.bill.items.find((i) => i.itemId === line.itemId);
        store.adjustStock(item.productId, line.quantity);
      }

      let balanceAfter = txn.customerId ? store.getPoints(txn.customerId) : 0;
      if (txn.customerId) {
        balanceAfter = loyalty.creditBack(txn.customerId, quote.summary.pointsReturned, id);
        balanceAfter = loyalty.reverse(txn.customerId, quote.summary.pointsReversed, id);
      }

      const note = store.saveRefund({
        ...quote,
        id,
        uuid: uuidv4(),
        creditNoteNumber: store.nextCreditNoteNumber(now),
        createdAt: now.toISOString(),
        cashierId: cashier.id,
        cashierName: cashier.name,
        shiftId: shift.id,
        // Online refunds go back to the card / UPI handle through the gateway; the desk records the reference.
        gateway: request.method === 'original' ? { mode: txn.payment.gatewayMode ?? 'mock', paymentId: txn.payment.razorpayPaymentId ?? null, refundId: `rfnd_${id.slice(3).toLowerCase()}`, status: 'processed' } : null,
        loyalty: { pointsReturned: quote.summary.pointsReturned, pointsReversed: quote.summary.pointsReversed, balanceAfter },
      });

      txn.returnedQuantities ??= {};
      for (const line of request.items) txn.returnedQuantities[line.itemId] = returnedQty(txn, line.itemId) + line.quantity;
      txn.refunds = [
        ...(txn.refunds ?? []),
        { creditNoteId: id, creditNoteNumber: note.creditNoteNumber, amount: quote.summary.refundAmount, pointsReturned: quote.summary.pointsReturned, method: request.method, units: quote.summary.units, createdAt: note.createdAt },
      ];
      txn.refundStatus = quote.refundStatusAfter;
      txn.loyalty = {
        ...(txn.loyalty ?? {}),
        pointsReturned: (txn.loyalty?.pointsReturned ?? 0) + quote.summary.pointsReturned,
        pointsReversed: (txn.loyalty?.pointsReversed ?? 0) + quote.summary.pointsReversed,
      };
      store.saveTransaction(txn);
      return note;
    });

    return { creditNote, bill: deskBill(txn), drawer: shiftSummary(shift) };
  };

  // ---------- Adding a product (cashiers only) ----------
  const addProduct = (cashier, body = {}) => {
    const barcode = String(body.barcode ?? '').trim();
    if (!BARCODE.test(barcode)) {
      throw badRequest('INVALID_BARCODE', 'Scan or type a barcode of 6 to 64 letters or digits.');
    }
    if (store.findProductByCode(barcode)) {
      throw conflict('PRODUCT_EXISTS', 'A product with this barcode is already in the catalog.');
    }
    const name = String(body.name ?? '').trim();
    if (name.length < 2 || name.length > 80) {
      throw badRequest('INVALID_NAME', 'Enter a product name of 2 to 80 characters.');
    }
    const description = String(body.description ?? '').trim().slice(0, 200);
    const mrp = Number(body.mrp);
    if (!Number.isFinite(mrp) || mrp <= 0 || mrp > 10_000_000) {
      throw badRequest('INVALID_MRP', 'Enter the MRP printed on the tag, including GST.');
    }
    const gstRate = Number(body.gstRate);
    if (!GST_RATES.includes(gstRate)) {
      throw badRequest('INVALID_GST', 'GST rate must be one of 0, 3, 5, 12, 18 or 28.');
    }
    const category = CATEGORIES.find((c) => c.id === body.category);
    if (!category) throw badRequest('INVALID_CATEGORY', 'Choose a product category.');
    const showroom = SHOWROOMS.find((r) => r.id === body.showroomId);
    if (!showroom || showroom.category !== category.id) {
      throw badRequest('INVALID_SHOWROOM', 'Choose a showroom that matches the category.');
    }
    const stock = body.stock === undefined || body.stock === '' ? 0 : Number(body.stock);
    if (!Number.isInteger(stock) || stock < 0 || stock > 100_000) {
      throw badRequest('INVALID_STOCK', 'Stock must be a whole number from 0 to 100,000.');
    }
    const hsn = String(body.hsn ?? '').replace(/\D/g, '').slice(0, 8);

    const product = store.insertProduct({
      id: `prd_${randomBytes(4).toString('hex')}`,
      barcode,
      sku: `P-${barcode}`.slice(0, 48),
      name,
      description,
      category: category.id,
      price: toRupees(toPaise(mrp / (1 + gstRate / 100))),
      mrp: toRupees(toPaise(mrp)),
      gstRate,
      hsn,
      showroomId: showroom.id,
      stock,
    });
    return { product, addedBy: cashier.name };
  };

  return { pending, lookup, getShift, openShift, closeShift, drawers, collectCash, previewReturn, processReturn, addProduct, returnReasons: RETURN_REASONS };
};
