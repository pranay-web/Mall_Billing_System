import { SHOWROOMS } from '../data/catalog.js';
import { toPaise, toRupees } from '../lib/money.js';

const showroomOrder = new Map(SHOWROOMS.map((s, i) => [s.id, i]));

/**
 * Prices a list of cart lines into a full GST bill.
 *
 * Two pricing styles are supported per product:
 *  - GST-exclusive `price`: tax = subtotal × rate (rounded to the paisa).
 *  - Tag `mrp` that already includes GST (real retail items): the line total is
 *    exactly MRP × qty, and the taxable value is backed out of it.
 * Tax is aggregated per slab and split equally into CGST + SGST (intra-state supply).
 * The payable amount is rounded to the nearest rupee with an explicit round-off line,
 * as is customary on Indian retail invoices.
 *
 * @param {Array<{ itemId: string, product: object, quantity: number, addedAt?: string }>} lines
 */
export const buildBill = (lines) => {
  const priced = lines.map(({ itemId, product, quantity, addedAt }) => {
    const rate = product.gstRate;
    let unitPrice, unitMrp, subtotal, tax;
    if (product.mrp != null) {
      unitMrp = toPaise(product.mrp);
      const total = unitMrp * quantity;
      subtotal = Math.round((total * 100) / (100 + rate));
      tax = total - subtotal;
      unitPrice = Math.round((unitMrp * 100) / (100 + rate));
    } else {
      unitPrice = toPaise(product.price);
      unitMrp = Math.round((unitPrice * (100 + rate)) / 100);
      subtotal = unitPrice * quantity;
      tax = Math.round((subtotal * rate) / 100);
    }
    return {
      itemId,
      productId: product.id,
      barcode: product.barcode,
      sku: product.sku,
      name: product.name,
      description: product.description,
      hsn: product.hsn,
      category: product.category,
      showroomId: product.showroomId,
      showroom: product.showroom,
      gstRate: product.gstRate,
      quantity,
      unitPrice,
      unitMrp,
      subtotal,
      tax,
      total: subtotal + tax,
      addedAt,
    };
  });

  // Group by showroom, in the mall's canonical showroom order.
  const groupMap = new Map();
  for (const item of priced) {
    if (!groupMap.has(item.showroomId)) {
      groupMap.set(item.showroomId, {
        showroomId: item.showroomId,
        showroom: item.showroom,
        category: item.category,
        items: [],
      });
    }
    groupMap.get(item.showroomId).items.push(item);
  }
  const groups = [...groupMap.values()]
    .sort((a, b) => (showroomOrder.get(a.showroomId) ?? 99) - (showroomOrder.get(b.showroomId) ?? 99))
    .map((group) => ({
      ...group,
      units: sum(group.items, 'quantity'),
      subtotal: sum(group.items, 'subtotal'),
      tax: sum(group.items, 'tax'),
      total: sum(group.items, 'total'),
    }));

  // GST slab breakdown.
  const slabMap = new Map();
  for (const item of priced) {
    const slab = slabMap.get(item.gstRate) ?? { rate: item.gstRate, taxableValue: 0, tax: 0 };
    slab.taxableValue += item.subtotal;
    slab.tax += item.tax;
    slabMap.set(item.gstRate, slab);
  }
  const taxBreakdown = [...slabMap.values()]
    .sort((a, b) => a.rate - b.rate)
    .map(({ rate, taxableValue, tax }) => {
      const cgst = Math.round(tax / 2);
      return { rate, taxableValue, cgst, sgst: tax - cgst, totalTax: tax };
    });

  const subtotal = sum(priced, 'subtotal');
  const totalTax = sum(priced, 'tax');
  const exact = subtotal + totalTax;
  const grandTotal = Math.round(exact / 100) * 100;

  const summary = {
    lineCount: priced.length,
    units: sum(priced, 'quantity'),
    subtotal,
    cgst: sum(taxBreakdown, 'cgst'),
    sgst: sum(taxBreakdown, 'sgst'),
    totalTax,
    roundOff: grandTotal - exact,
    grandTotal,
  };

  return {
    amountPaise: grandTotal,
    items: priced.map(itemToRupees),
    groups: groups.map((g) => ({
      ...g,
      items: g.items.map(itemToRupees),
      subtotal: toRupees(g.subtotal),
      tax: toRupees(g.tax),
      total: toRupees(g.total),
    })),
    taxBreakdown: taxBreakdown.map((slab) => ({
      rate: slab.rate,
      taxableValue: toRupees(slab.taxableValue),
      cgst: toRupees(slab.cgst),
      sgst: toRupees(slab.sgst),
      totalTax: toRupees(slab.totalTax),
    })),
    summary: {
      ...summary,
      subtotal: toRupees(summary.subtotal),
      cgst: toRupees(summary.cgst),
      sgst: toRupees(summary.sgst),
      totalTax: toRupees(summary.totalTax),
      roundOff: toRupees(summary.roundOff),
      grandTotal: toRupees(summary.grandTotal),
    },
  };
};

const sum = (list, key) => list.reduce((acc, entry) => acc + entry[key], 0);

const itemToRupees = (item) => ({
  ...item,
  unitPrice: toRupees(item.unitPrice),
  unitMrp: toRupees(item.unitMrp),
  subtotal: toRupees(item.subtotal),
  tax: toRupees(item.tax),
  total: toRupees(item.total),
});
