const { Order, Product, Coupon } = require("../models");
const { AppError } = require("../utils/errors");

const TRANSITIONS = {
  pending_payment: ["paid", "cancelled", "expired", "payment_failed"],
  paid: ["processing"], processing: ["shipped"], shipped: ["delivered"],
  delivered: [], cancelled: [], expired: [], payment_failed: [],
};
const canTransition = (from, to) => (TRANSITIONS[from] || []).includes(to);

// atomic transition: only succeeds if the order is still in `from`
async function transition(orderId, from, to, actor, extra = {}) {
  if (!canTransition(from, to)) throw new AppError(409, "ILLEGAL_TRANSITION", from + " -> " + to + " not allowed");
  const o = await Order.findOneAndUpdate({ _id: orderId, status: from },
    { $set: { status: to, ...extra }, $push: { history: { from, to, actor: String(actor) } } }, { new: true });
  if (!o) throw new AppError(409, "ILLEGAL_TRANSITION", "Order is no longer " + from);
  return o;
}

// release reserved stock + coupon use when an unpaid order dies
async function releaseOrder(orderId, to, actor) {
  const o = await transition(orderId, "pending_payment", to, actor);
  for (const i of o.items) await Product.updateOne({ _id: i.product }, { $inc: { stock: i.qty } });
  if (o.couponCode) await Coupon.updateOne({ code: o.couponCode }, { $inc: { usedCount: -1 } });
  return o;
}

async function expireStale() {
  const stale = await Order.find({ status: "pending_payment", expiresAt: { $lt: new Date() } }).select("_id");
  for (const s of stale) { try { await releaseOrder(s._id, "expired", "system"); } catch {} }
}
module.exports = { TRANSITIONS, canTransition, transition, releaseOrder, expireStale };
