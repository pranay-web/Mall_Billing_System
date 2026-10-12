/**
 * Seed catalog. Demo products carry generated GS1-India style EAN-13 barcodes
 * (prefix 890) and GST-exclusive prices. Real retail products use the barcode
 * printed on their tag and an MRP that already includes GST — their bill total
 * matches the tag exactly.
 */

/** Computes the EAN-13 check digit for a 12-digit body. */
const ean13 = (body) => {
  const sum = [...body].reduce((acc, digit, i) => acc + Number(digit) * (i % 2 === 0 ? 1 : 3), 0);
  return body + ((10 - (sum % 10)) % 10);
};

export const CATEGORIES = Object.freeze([
  { id: 'clothing', label: 'Clothing', gstRate: 18 },
  { id: 'electronics', label: 'Electronics', gstRate: 12 },
  { id: 'food', label: 'Food & Beverage', gstRate: 5 },
  { id: 'jewelry', label: 'Jewelry', gstRate: 18 },
  { id: 'beauty', label: 'Beauty', gstRate: 18 },
]);

export const SHOWROOMS = Object.freeze([
  { id: 'fashion-zone', name: 'Fashion Zone', category: 'clothing', unit: 'L1-04', floor: 'Level 1' },
  { id: 'tech-store', name: 'Tech Store', category: 'electronics', unit: 'L2-11', floor: 'Level 2' },
  { id: 'food-court', name: 'Food Court', category: 'food', unit: 'L3-FC', floor: 'Level 3' },
  { id: 'jewelry-store', name: 'Jewelry Store', category: 'jewelry', unit: 'G-02', floor: 'Ground' },
  { id: 'beauty-lounge', name: 'Beauty Lounge', category: 'beauty', unit: 'L1-09', floor: 'Level 1' },
]);

const seed = [
  // Fashion Zone — Clothing (18% GST)
  { id: 'prd_001', sku: 'FZ-SHIRT', body: '890100100001', name: 'Blue Casual Shirt', description: 'Slim-fit oxford cotton, indigo', price: 500, hsn: '6205', showroomId: 'fashion-zone', stock: 48 },
  { id: 'prd_002', sku: 'FZ-JEANS', body: '890100100002', name: 'Dark Blue Jeans', description: 'Tapered stretch denim, 32" inseam', price: 1200, hsn: '6203', showroomId: 'fashion-zone', stock: 30 },
  { id: 'prd_003', sku: 'FZ-TSHIRT', body: '890100100003', name: 'Cotton T-Shirt', description: 'Crew neck, 180 GSM combed cotton', price: 300, hsn: '6109', showroomId: 'fashion-zone', stock: 120 },

  // Tech Store — Electronics (12% GST)
  { id: 'prd_004', sku: 'TS-EARBUDS', body: '890200200001', name: 'Wireless Earbuds', description: 'ANC, 30h battery, USB-C case', price: 2000, hsn: '8518', showroomId: 'tech-store', stock: 25 },
  { id: 'prd_005', sku: 'TS-CHARGER', body: '890200200002', name: 'Fast Charger 65W', description: 'GaN dual-port PD charger', price: 800, hsn: '8504', showroomId: 'tech-store', stock: 40 },
  { id: 'prd_006', sku: 'TS-CABLE', body: '890200200003', name: 'USB-C Cable', description: 'Braided 1m, 60W fast charge', price: 150, hsn: '8544', showroomId: 'tech-store', stock: 200 },

  // Food Court — Food (5% GST)
  { id: 'prd_007', sku: 'FD-PIZZA', body: '890300300001', name: 'Veggie Pizza', description: '10" wood-fired, garden vegetables', price: 250, hsn: '996331', showroomId: 'food-court', stock: 18 },
  { id: 'prd_008', sku: 'FD-BURGER', body: '890300300002', name: 'Cheese Burger', description: 'Grilled patty, cheddar, brioche', price: 150, hsn: '996331', showroomId: 'food-court', stock: 24 },
  { id: 'prd_009', sku: 'FD-COFFEE', body: '890300300003', name: 'Cappuccino', description: 'Double shot, 240 ml', price: 80, hsn: '996331', showroomId: 'food-court', stock: 100 },

  // Jewelry Store — Jewelry (18% GST). Low stock on purpose to demo stock limits.
  { id: 'prd_010', sku: 'JS-RING', body: '890400400001', name: 'Gold Ring', description: '22K hallmarked, 2.1 g', price: 5000, hsn: '7113', showroomId: 'jewelry-store', stock: 4 },
  { id: 'prd_011', sku: 'JS-BRACELET', body: '890400400002', name: 'Silver Bracelet', description: '925 sterling, box chain', price: 1500, hsn: '7113', showroomId: 'jewelry-store', stock: 12 },
  { id: 'prd_012', sku: 'JS-NECKLACE', body: '890400400003', name: 'Pearl Necklace', description: 'Freshwater pearls, 18"', price: 3000, hsn: '7116', showroomId: 'jewelry-store', stock: 2 },

  // Real retail products — barcode and MRP (incl. all taxes) copied from the physical tags.
  { id: 'prd_013', sku: 'FZ-PUMA-POLO', barcode: '4070034130499', name: 'Puma × RCB Striper Polo II', description: 'Size S · PUMA Black · Art. 608683 01', mrp: 2999, hsn: '6105', showroomId: 'fashion-zone', stock: 10 },
  { id: 'prd_014', sku: 'FZ-MUFTI-SHIRT', barcode: '8905310522667', name: 'Mufti Checked Shirt F/S', description: 'Size XL · 26-Lilac · MFS-15711-U', mrp: 2399, hsn: '6205', showroomId: 'fashion-zone', stock: 10 },
  { id: 'prd_015', sku: 'BL-JPG-PARFUM', barcode: '8435415076944', name: 'Jean Paul Gaultier Parfum 125 ml', description: 'Natural spray · Made in France', mrp: 12500, hsn: '3303', showroomId: 'beauty-lounge', stock: 5 },
];

const showroomById = new Map(SHOWROOMS.map((s) => [s.id, s]));
const categoryById = new Map(CATEGORIES.map((c) => [c.id, c]));

/** The seed catalog in its database shape (one row per product). */
export const createCatalog = () =>
  seed.map(({ body, barcode, mrp, price, ...p }) => {
    const showroom = showroomById.get(p.showroomId);
    const category = categoryById.get(showroom.category);
    return {
      id: p.id,
      barcode: barcode ?? ean13(body),
      sku: p.sku,
      name: p.name,
      description: p.description,
      // GST-exclusive unit cost; for MRP-priced items it's the taxable value inside the MRP.
      price: mrp ? Math.round((mrp * 100 * 100) / (100 + category.gstRate)) / 100 : price,
      mrp: mrp ?? null,
      gstRate: category.gstRate,
      hsn: p.hsn,
      category: category.id,
      showroomId: showroom.id,
      showroom: showroom.name,
      stock: p.stock,
    };
  });
