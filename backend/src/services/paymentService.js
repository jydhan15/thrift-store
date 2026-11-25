const { Order, WebhookEvent, Coupon } = require("../models");
const getPaymentProvider = require("./payment");
const { transition, releaseOrder, recordOrderEvent } = require("./orderService");
const { reserveAll, release } = require("./inventoryService");
const { AppError } = require("../utils/errors");

// An order can have several sessions after retries: the current one and older ones.
const byRef = (ref) => Order.findOne({ $or: [{ gatewayRef: ref }, { previousRefs: ref }] });

async function claimCoupon(code) {
  return Coupon.findOneAndUpdate(
    { code, $or: [{ usageLimit: 0 }, { $expr: { $lt: ["$usedCount", "$usageLimit"] } }] },
    { $inc: { usedCount: 1 } });
}

// Recover an order whose webhook was missed: a gateway-confirmed payment is
// honoured even after expiry released the stock, by re-reserving it first.
async function recoverPaidOrder(order, pay) {
  let claimed = false;
  try {
    await reserveAll(order.items);
    if (order.couponCode) {
      if (!(await claimCoupon(order.couponCode))) throw new AppError(422, "COUPON_EXHAUSTED", "Coupon no longer available");
      claimed = true;
    }
    if (order.status !== "pending_payment") await transition(order._id, order.status, "pending_payment", "gateway");
    await transition(order._id, "pending_payment", "paid", "gateway", {
      paidAt: new Date(), paymentId: pay.paymentId,
    });
    return { paid: true, recovered: true };
  } catch (e) {
    await release(order.items);
    if (claimed && order.couponCode) await Coupon.updateOne({ code: order.couponCode }, { $inc: { usedCount: -1 } });
    await recordOrderEvent(order._id, "PAID_AFTER_" + order.status.toUpperCase(), "gateway");
    return { flagged: true, reason: "PAID_AFTER_" + order.status.toUpperCase() };
  }
}

// Facade: controllers call one method; gateway details stay inside.
async function settleOrderBySession(sessionId) {
  const order = await byRef(sessionId);
  if (!order) return { ignored: true };
  const pay = await getPaymentProvider().retrieve(sessionId); // never trust the webhook alone
  if (!pay.paid) return { ignored: true };
  if (pay.amount !== order.total || pay.currency !== "PHP") {
    console.warn("AMOUNT_MISMATCH", { orderId: String(order._id), expected: order.total, got: pay.amount, currency: pay.currency });
    await recordOrderEvent(order._id, "AMOUNT_MISMATCH", "gateway");
    return { flagged: true, reason: "AMOUNT_MISMATCH" };
  }
  if (order.status === "paid") return { already: true };
  if (order.status === "expired" || order.status === "payment_failed") return recoverPaidOrder(order, pay);
  if (order.status !== "pending_payment") {
    await recordOrderEvent(order._id, "PAID_AFTER_" + order.status.toUpperCase(), "gateway");
    return { flagged: true, reason: "PAID_AFTER_" + order.status.toUpperCase() };
  }
  try {
    await transition(order._id, "pending_payment", "paid", "gateway", {
      paidAt: new Date(), paymentId: pay.paymentId,
    });
  } catch {
    return { already: true };
  }
  return { paid: true };
}

// Failed or expired payment: releases stock and coupon, records the event,
// leaves the order retryable. Only the CURRENT session can fail an order.
async function failOrderBySession(sessionId) {
  const order = await byRef(sessionId);
  if (!order || order.status !== "pending_payment" || order.gatewayRef !== sessionId) return { ignored: true };
  const pay = await getPaymentProvider().retrieve(sessionId);
  if (pay.paid) return { ignored: true }; // a paid order is never reversed
  try { await releaseOrder(order._id, "payment_failed", "gateway"); } catch { return { already: true }; }
  return { failed: true };
}

async function handleWebhook(rawBody, headers) {
  const p = getPaymentProvider();
  if (!p.verifyWebhook(rawBody, headers)) throw new AppError(401, "INVALID_SIGNATURE", "Bad signature");

  let ev;
  try { ev = p.parseEvent(rawBody); }
  catch { throw new AppError(422, "INVALID_PAYLOAD", "Malformed webhook payload"); }
  if (!ev || !ev.eventId || !ev.type) throw new AppError(422, "INVALID_PAYLOAD", "Unrecognised webhook payload");

  // Check first, then process, then store. Storing BEFORE processing meant a
  // gateway outage burned the event ID and a retry was treated as a duplicate.
  if (await WebhookEvent.exists({ eventId: ev.eventId })) return { duplicate: true };

  let result = { ignored: true };
  if (ev.type === "checkout_session.payment.paid") result = await settleOrderBySession(ev.sessionId);
  else if (ev.type === "checkout_session.payment.failed" || ev.type.startsWith("maya.")) {
    result = await failOrderBySession(ev.sessionId);
  }

  try { await WebhookEvent.create({ eventId: ev.eventId, type: ev.type }); }
  catch (e) { if (e.code === 11000) return { duplicate: true }; throw e; }
  return result;
}

module.exports = { handleWebhook, settleOrderBySession, failOrderBySession, claimCoupon };
