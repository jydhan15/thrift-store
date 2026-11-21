const { Cart, Order, Coupon, Offer } = require("../models");
const { AppError } = require("../utils/errors");
const getPaymentProvider = require("./payment");
const { validateAndPrice } = require("./couponService");
const { releaseOrder } = require("./orderService");
const { reserve, release } = require("./inventoryService");

const SHIPPING_FEE = 5000;        // centavos
const RESERVE_MINUTES = 15;       // THRIFT FEATURE 1: reservation countdown

async function checkout(userId, { couponCode, shippingInfo, idempotencyKey }) {
  const existing = await Order.findOne({ user: userId, idempotencyKey });
  if (existing) return existing;

  const cart = await Cart.findOne({ user: userId });
  if (!cart || !cart.items.length) throw new AppError(422, "CART_EMPTY", "Cart is empty");

  const reserved = [], lines = [], usedOffers = [];
  try {
    for (const it of cart.items) {
      const p = await reserve(it); // atomic conditional decrement (inventoryService)
      reserved.push(it);
      // accepted offer overrides price for THIS buyer only (price is still server-decided)
      const offer = await Offer.findOneAndUpdate({ product: p._id, buyer: userId, status: "accepted" }, { status: "used" });
      if (offer) usedOffers.push(offer._id);
      lines.push({ product: p._id, name: p.name, unitPrice: offer ? offer.amount : p.price, qty: it.qty });
    }
    const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
    let discount = 0;
    if (couponCode) {
      const r = await validateAndPrice(couponCode, userId, subtotal);
      const claimed = await Coupon.findOneAndUpdate(
        { _id: r.coupon._id, $or: [{ usageLimit: 0 }, { $expr: { $lt: ["$usedCount", "$usageLimit"] } }] },
        { $inc: { usedCount: 1 } });
      if (!claimed) throw new AppError(422, "COUPON_EXHAUSTED", "Coupon fully used");
      discount = r.discount;
    }
    const total = subtotal - discount + SHIPPING_FEE;
    if (total < 2000) throw new AppError(422, "TOTAL_TOO_LOW", "PayMongo minimum is PHP 20");

    const order = await Order.create({
      user: userId, items: lines, subtotal, discount, shipping: SHIPPING_FEE, total,
      couponCode: couponCode ? couponCode.toUpperCase() : undefined, shippingInfo, idempotencyKey,
      expiresAt: new Date(Date.now() + RESERVE_MINUTES * 60000),
      history: [{ from: "", to: "pending_payment", actor: String(userId) }],
    });
    try {
      const s = await getPaymentProvider().createCheckout(order);
      order.gatewayRef = s.id; order.checkoutUrl = s.url; await order.save();
    } catch (e) { await releaseOrder(order._id, "payment_failed", "system"); throw e; }
    await Cart.deleteOne({ user: userId });
    return order;
  } catch (e) {
    // roll back stock taken so far if the order was never created
    const made = await Order.exists({ user: userId, idempotencyKey });
    if (!made) {
      await release(reserved);
      for (const id of usedOffers) await Offer.updateOne({ _id: id }, { status: "accepted" });
    }
    throw e;
  }
}
module.exports = { checkout, SHIPPING_FEE };
