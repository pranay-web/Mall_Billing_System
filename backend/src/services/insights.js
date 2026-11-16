import { toPaise, toRupees } from '../lib/money.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** A shopper's own numbers: what they've spent, where, what they buy again, and their points. */
export const createInsightsService = ({ store, loyalty }) => {
  const summaryFor = (customerId) => {
    const all = store.listCustomerTransactions(customerId, 500);
    const paid = all.filter((t) => t.payment.status === 'paid');
    const refunds = store.listCustomerRefunds(customerId, 200);

    const spentPaise = paid.reduce((acc, t) => acc + toPaise(t.bill.summary.grandTotal), 0);
    const refundedPaise = refunds.reduce((acc, r) => acc + toPaise(r.summary.grandTotal), 0);

    // Last six calendar months, oldest first, so the chart always has the same shape.
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { key: monthKey(d), label: MONTHS[d.getMonth()], spent: 0, bills: 0 };
    });
    const byKey = new Map(months.map((m) => [m.key, m]));
    for (const t of paid) {
      const m = byKey.get(monthKey(new Date(t.createdAt)));
      if (m) {
        m.spent += toPaise(t.bill.summary.grandTotal);
        m.bills += 1;
      }
    }

    const showrooms = new Map();
    const items = new Map();
    for (const t of paid) {
      for (const g of t.bill.groups) {
        const s = showrooms.get(g.showroomId) ?? { showroomId: g.showroomId, showroom: g.showroom, spent: 0, visits: 0, units: 0 };
        s.spent += toPaise(g.total);
        s.visits += 1;
        s.units += g.units;
        showrooms.set(g.showroomId, s);
      }
      for (const i of t.bill.items) {
        const it = items.get(i.productId) ?? { productId: i.productId, barcode: i.barcode, sku: i.sku, name: i.name, category: i.category, showroomId: i.showroomId, showroom: i.showroom, unitMrp: i.unitMrp, units: 0, lastBoughtAt: t.createdAt };
        it.units += i.quantity;
        if (t.createdAt > it.lastBoughtAt) it.lastBoughtAt = t.createdAt;
        items.set(i.productId, it);
      }
    }
    const showroomList = [...showrooms.values()].sort((a, b) => b.spent - a.spent).map((s) => ({ ...s, spent: toRupees(s.spent) }));

    // "Order again": food the customer has bought before and that's still on the menu.
    const reorder = [...items.values()]
      .filter((i) => i.category === 'food')
      .sort((a, b) => (a.lastBoughtAt < b.lastBoughtAt ? 1 : -1))
      .slice(0, 4)
      .map((i) => {
        const product = store.getProduct(i.productId);
        return { ...i, inStock: Boolean(product && product.stock > 0) };
      });

    const thisMonth = months[months.length - 1];

    return {
      bills: paid.length,
      pendingBills: all.length - paid.length,
      totalSpent: toRupees(spentPaise),
      totalRefunded: toRupees(refundedPaise),
      thisMonth: { spent: toRupees(thisMonth.spent), bills: thisMonth.bills },
      byMonth: months.map((m) => ({ ...m, spent: toRupees(m.spent) })),
      favouriteShowroom: showroomList[0] ?? null,
      byShowroom: showroomList,
      topItems: [...items.values()]
        .sort((a, b) => b.units - a.units)
        .slice(0, 5)
        .map(({ productId, name, showroom, units }) => ({ productId, name, showroom, units })),
      reorder,
      refunds: refunds.slice(0, 10).map((r) => ({
        creditNoteId: r.id,
        creditNoteNumber: r.creditNoteNumber,
        invoiceNumber: r.invoiceNumber,
        amount: r.summary.refundAmount,
        pointsReturned: r.summary.pointsReturned,
        method: r.method,
        units: r.summary.units,
        createdAt: r.createdAt,
      })),
      loyalty: loyalty.account(customerId),
    };
  };

  return { summaryFor };
};
