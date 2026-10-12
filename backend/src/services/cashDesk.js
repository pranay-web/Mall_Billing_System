import { badRequest, conflict, notFound } from '../lib/errors.js';
import { maskPhone, normalizeIndianMobile } from '../lib/auth.js';
import { toPaise, toRupees } from '../lib/money.js';
import { LEGACY_BILL_PREFIX } from './checkout.js';

/**
 * The cash desk: find a customer's unpaid cash bill, take their cash, tell the
 * cashier how much change to return, and keep a running drawer total for the day.
 */
export const createCashDeskService = ({ store, checkout }) => {
  const asAmount = (value, { field, allowZero = true }) => {
    const n = Number(value);
    if (value === '' || value === null || value === undefined || !Number.isFinite(n) || n < 0 || (!allowZero && n === 0)) {
      throw badRequest('INVALID_AMOUNT', `Enter a valid ${field}.`);
    }
    if (n > 10_000_000) throw badRequest('INVALID_AMOUNT', `${field[0].toUpperCase()}${field.slice(1)} looks too large.`);
    return toRupees(toPaise(n));
  };

  /** What the cashier sees for a bill: just enough to take the right amount of cash. */
  const deskBill = (txn) => ({
    transactionId: txn.id,
    invoiceNumber: txn.invoiceNumber,
    issuedAt: txn.createdAt,
    customerPhone: maskPhone(txn.customerPhone),
    units: txn.bill.summary.units,
    stores: txn.bill.groups.map((g) => g.showroom),
    amountDue: txn.bill.summary.grandTotal,
    status: txn.payment.status === 'paid' ? 'paid' : 'awaiting_payment',
    paymentMethod: txn.payment.method,
    collection: txn.payment.collection ?? null,
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

  const shiftSummary = (shift) => {
    const collections = store.listShiftCollections(shift.id);
    const sum = (pick) => toRupees(collections.reduce((acc, t) => acc + toPaise(pick(t)), 0));
    const cashSales = sum((t) => t.bill.summary.grandTotal);
    const cashReceived = sum((t) => t.payment.collection.received);
    const changeReturned = sum((t) => t.payment.collection.change);
    const cashInDrawer = toRupees(toPaise(shift.openingCash) + toPaise(cashSales));

    const stillPending = store.listPending(500);
    const counted = shift.countedCash;

    return {
      shiftId: shift.id,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt,
      openingCash: shift.openingCash,
      billsCollected: collections.length,
      cashSales,
      cashReceived,
      changeReturned,
      cashInDrawer,
      countedCash: counted,
      difference: counted === null || counted === undefined ? null : toRupees(toPaise(counted) - toPaise(cashInDrawer)),
      pendingBills: stillPending.length,
      pendingAmount: toRupees(stillPending.reduce((acc, t) => acc + toPaise(t.bill.summary.grandTotal), 0)),
      collections: collections.map((t) => ({
        transactionId: t.id,
        invoiceNumber: t.invoiceNumber,
        amount: t.bill.summary.grandTotal,
        received: t.payment.collection.received,
        change: t.payment.collection.change,
        collectedAt: t.payment.collection.collectedAt,
      })),
    };
  };

  const getShift = (cashier) => {
    const open = store.getOpenShift(cashier.id);
    const lastClosed = open ? null : store.getLastClosedShift(cashier.id);
    return {
      shift: open ? shiftSummary(open) : null,
      lastClosed: lastClosed ? shiftSummary(lastClosed) : null,
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
    const due = toPaise(txn.bill.summary.grandTotal);
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
    store.saveTransaction(txn);

    return { bill: deskBill(txn), change, drawer: shiftSummary(shift) };
  };

  return { pending, lookup, getShift, openShift, closeShift, collectCash };
};
