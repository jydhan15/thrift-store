const { Order, Product, Coupon } = require("../models");
const { AppError } = require("../utils/errors");

// Documented state machine. Anything not listed here returns 409.
const TRANSITIONS = {
  pending_payment: ["paid", "cancelled", "expired", "payment_failed"],
  paid: ["processing"], processing: ["shipped"], shipped: ["delivered"],
  delivered: [], cancelled: [],
  expired: ["pending_payment"],        // customer retry (stock is re-reserved first)
  payment_failed: ["pending_payment"], // customer retry (stock is re-reserved first)
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

// Gateway flags and retries are recorded too, so every non-trivial order
// change is visible in history rather than only in a final field.
async function recordOrderEvent(orderId, flag, actor, extra = {}) {
  return Order.findByIdAndUpdate(orderId, {
    $set: { flag },
    $push: { history: { from: extra.from || "gateway", to: extra.to || flag, actor: String(actor) } },
  }, { new: true });
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
module.exports = { TRANSITIONS, canTransition, transition, recordOrderEvent, releaseOrder, expireStale };
