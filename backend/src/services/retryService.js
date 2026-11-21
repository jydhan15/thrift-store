const { Order, Coupon } = require("../models");
const { AppError } = require("../utils/errors");
const getPaymentProvider = require("./payment");
const { transition, releaseOrder } = require("./orderService");
const { reserveAll, release } = require("./inventoryService");

const RESERVE_MINUTES = 15;
const MAX_ATTEMPTS = 5;
const REVIVABLE = ["payment_failed", "expired"]; // stock was released, so it must be re-reserved

// Retry payment: always creates a NEW gateway session for the SAME order.
async function retryPayment(userId, orderId) {
  const order = await Order.findOne({ _id: orderId, user: userId });
  if (!order) throw new AppError(404, "NOT_FOUND", "Order not found");
  if (order.status === "cancelled") throw new AppError(409, "CANNOT_RETRY", "A cancelled order cannot be paid. Add the items to your cart again.");
  if (!["pending_payment", ...REVIVABLE].includes(order.status)) throw new AppError(409, "ALREADY_PAID", "This order is already paid");
  if (order.paymentAttempts >= MAX_ATTEMPTS) throw new AppError(409, "TOO_MANY_ATTEMPTS", "Payment attempt limit reached. Please place a new order.");

  const from = order.status, expiresAt = new Date(Date.now() + RESERVE_MINUTES * 60000);
  const revive = REVIVABLE.includes(from);
  let couponClaimed = false;

  if (revive) {
    await reserveAll(order.items); // 1) reserve the items again (atomic, all-or-nothing, can fail)
    try {
      if (order.couponCode) { // 2) claim the coupon again with the same limit check as checkout
        const c = await Coupon.findOneAndUpdate({ code: order.couponCode, $or: [{ usageLimit: 0 }, { $expr: { $lt: ["$usedCount", "$usageLimit"] } }] }, { $inc: { usedCount: 1 } });
        if (!c) throw new AppError(422, "COUPON_EXHAUSTED", "The coupon on this order has been fully used");
        couponClaimed = true;
      }
      await transition(order._id, from, "pending_payment", userId, { expiresAt }); // 3) recorded in history
    } catch (e) {
      await release(order.items);
      if (couponClaimed) await Coupon.updateOne({ code: order.couponCode }, { $inc: { usedCount: -1 } });
      throw e;
    }
  } else {
    // still pending: only extend the hold, and only if it is still pending
    const held = await Order.findOneAndUpdate({ _id: order._id, status: "pending_payment" }, { $set: { expiresAt } });
    if (!held) throw new AppError(409, "ILLEGAL_TRANSITION", "Order is no longer awaiting payment");
  }

  let session;
  try { session = await getPaymentProvider().createCheckout(order); }
  catch (e) {
    if (revive) await releaseOrder(order._id, "payment_failed", "system"); // undo: stock + coupon back
    throw e;
  }
  const update = { $set: { gatewayRef: session.id, checkoutUrl: session.url }, $inc: { paymentAttempts: 1 } };
  if (order.gatewayRef) update.$push = { previousRefs: order.gatewayRef }; // an old session paid later still maps to this order
  return Order.findOneAndUpdate({ _id: order._id }, update, { new: true });
}
module.exports = { retryPayment, MAX_ATTEMPTS };
