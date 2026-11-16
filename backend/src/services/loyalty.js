import { badRequest } from '../lib/errors.js';
import { toPaise } from '../lib/money.js';

/**
 * FlashCart points. Customers earn 1 point for every `earnPerRupees` they actually
 * pay (after points), and 1 point is worth ₹1 off a future bill, up to
 * `maxRedeemPercent` of that bill. Every movement is written to a ledger so the
 * balance can always be explained.
 */
export const createLoyaltyService = ({ store, config }) => {
  const rules = {
    earnPerRupees: config.loyalty?.earnPerRupees ?? 50,
    maxRedeemPercent: config.loyalty?.maxRedeemPercent ?? 50,
    pointValue: 1,
  };

  /** Points earned for paying `amountDue` rupees. */
  const pointsFor = (amountDue) => Math.floor(toPaise(amountDue) / toPaise(rules.earnPerRupees));

  /** Most points this customer may put towards a bill of `grandTotal` rupees. */
  const maxRedeemable = (customerId, grandTotal) => {
    const balance = store.getPoints(customerId);
    const cap = Math.floor((grandTotal * rules.maxRedeemPercent) / 100);
    return Math.max(0, Math.min(balance, cap));
  };

  const parsePoints = (value) => {
    const points = value === undefined || value === null || value === '' ? 0 : Number(value);
    if (!Number.isInteger(points) || points < 0 || points > 1_000_000) {
      throw badRequest('INVALID_POINTS', 'Points must be a whole number.');
    }
    return points;
  };

  /** Everything the cart screen needs to offer redemption. */
  const describe = (customerId, grandTotal, redeeming, amountDue) => ({
    balance: store.getPoints(customerId),
    redeeming,
    maxRedeemable: maxRedeemable(customerId, grandTotal),
    willEarn: pointsFor(amountDue),
    ...rules,
  });

  // ---------- Movements (call inside store.atomic) ----------
  const redeem = (customerId, points, reference) =>
    points > 0 ? store.addPoints(customerId, -points, { kind: 'redeem', reference, note: `Redeemed on bill ${reference}` }) : store.getPoints(customerId);

  const earn = (customerId, points, reference) =>
    points > 0 ? store.addPoints(customerId, points, { kind: 'earn', reference, note: `Earned on bill ${reference}` }) : store.getPoints(customerId);

  const creditBack = (customerId, points, reference) =>
    points > 0 ? store.addPoints(customerId, points, { kind: 'credit', reference, note: `Points credited back on ${reference}` }) : store.getPoints(customerId);

  const reverse = (customerId, points, reference) => {
    const take = Math.min(points, store.getPoints(customerId));
    return take > 0 ? store.addPoints(customerId, -take, { kind: 'reverse', reference, note: `Earned points reversed on ${reference}` }) : store.getPoints(customerId);
  };

  const account = (customerId) => {
    const totals = store.ledgerTotals(customerId);
    return {
      balance: store.getPoints(customerId),
      earnedTotal: totals.earned,
      spentTotal: totals.spent,
      history: store.listLedger(customerId, 15),
      ...rules,
    };
  };

  return { rules, pointsFor, maxRedeemable, parsePoints, describe, redeem, earn, creditBack, reverse, account };
};
