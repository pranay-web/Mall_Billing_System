import {
  Cable,
  CircleDashed,
  Coffee,
  Gem,
  Headphones,
  Package,
  Pizza,
  PlugZap,
  Sandwich,
  Shirt,
  Sparkles,
  SprayCan,
  UtensilsCrossed,
} from 'lucide-react';

/** Visual identity for each showroom (icon + tinted tile). */
export const SHOWROOM_META = {
  'fashion-zone': { icon: Shirt, tile: 'bg-rose-50 text-rose-600 ring-rose-100', dot: 'bg-rose-500' },
  'tech-store': { icon: Headphones, tile: 'bg-sky-50 text-sky-600 ring-sky-100', dot: 'bg-sky-500' },
  'food-court': { icon: UtensilsCrossed, tile: 'bg-amber-50 text-amber-600 ring-amber-100', dot: 'bg-amber-500' },
  'jewelry-store': { icon: Gem, tile: 'bg-violet-50 text-violet-600 ring-violet-100', dot: 'bg-violet-500' },
  'beauty-lounge': { icon: SprayCan, tile: 'bg-fuchsia-50 text-fuchsia-600 ring-fuchsia-100', dot: 'bg-fuchsia-500' },
};

const FALLBACK = { icon: Package, tile: 'bg-zinc-100 text-zinc-600 ring-zinc-200', dot: 'bg-zinc-400' };
export const showroomMeta = (id) => SHOWROOM_META[id] ?? FALLBACK;

const PRODUCT_ICONS = {
  'FZ-SHIRT': Shirt,
  'FZ-JEANS': Shirt,
  'FZ-TSHIRT': Shirt,
  'TS-EARBUDS': Headphones,
  'TS-CHARGER': PlugZap,
  'TS-CABLE': Cable,
  'FD-PIZZA': Pizza,
  'FD-BURGER': Sandwich,
  'FD-COFFEE': Coffee,
  'JS-RING': Gem,
  'JS-BRACELET': CircleDashed,
  'JS-NECKLACE': Sparkles,
  'FZ-PUMA-POLO': Shirt,
  'FZ-MUFTI-SHIRT': Shirt,
  'BL-JPG-PARFUM': SprayCan,
};
export const productIcon = (item) => PRODUCT_ICONS[item?.sku] ?? showroomMeta(item?.showroomId).icon;

/** GST slab tag colours. */
export const GST_TONES = {
  5: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  12: 'bg-sky-50 text-sky-700 ring-sky-600/15',
  18: 'bg-violet-50 text-violet-700 ring-violet-600/15',
  28: 'bg-rose-50 text-rose-700 ring-rose-600/15',
};
