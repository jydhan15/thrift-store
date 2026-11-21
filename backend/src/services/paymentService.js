const { Order, WebhookEvent } = require("../models");
const getPaymentProvider = require("./payment");
const { transition, releaseOrder } = require("./orderService");
const { AppError } = require("../utils/errors");

// an order can have several sessions after retries: the current one and older ones
const byRef = (ref) => Order.findOne({ $or: [{ gatewayRef: ref }, { previousRefs: ref }] });

// Facade: controllers call one method; gateway details stay inside
async function settleOrderBySession(sessionId) {
  const order = await byRef(sessionId);
  if (!order) return { ignored: true };
  const pay = await getPaymentProvider().retrieve(sessionId); // never trust the webhook alone
  if (!pay.paid) return { ignored: true };
  if (pay.amount !== order.total || pay.currency !== "PHP") {
    console.warn("AMOUNT_MISMATCH", { expected: order.total, got: pay.amount, currency: pay.currency });
    await Order.updateOne({ _id: order._id }, { flag: "AMOUNT_MISMATCH" });
    return { flagged: true };
  }
  if (order.status !== "pending_payment") {
    if (order.status !== "paid") await Order.updateOne({ _id: order._id }, { flag: "PAID_AFTER_" + order.status.toUpperCase() });
    return { already: true };
  }
  try { await transition(order._id, "pending_payment", "paid", "gateway", { paidAt: new Date(), paymentId: pay.paymentId }); }
  catch { return { already: true }; }
  return { paid: true };
}

// Failed or expired payment: releases stock and coupon, records the event, leaves the order retryable.
async function failOrderBySession(sessionId) {
  const order = await byRef(sessionId);
  if (!order || order.status !== "pending_payment" || order.gatewayRef !== sessionId) return { ignored: true }; // only the CURRENT session can fail the order
  const pay = await getPaymentProvider().retrieve(sessionId);
  if (pay.paid) return { ignored: true }; // a paid order is never reversed
  try { await releaseOrder(order._id, "payment_failed", "gateway"); } catch { return { already: true }; }
  return { failed: true };
}

async function handleWebhook(rawBody, headers) {
  const p = getPaymentProvider();
  if (!p.verifyWebhook(rawBody, headers)) throw new AppError(401, "INVALID_SIGNATURE", "Bad signature");
  const ev = p.parseEvent(rawBody);
  try { await WebhookEvent.create({ eventId: ev.eventId, type: ev.type }); }
  catch (e) { if (e.code === 11000) return { duplicate: true }; throw e; }
  if (ev.type === "checkout_session.payment.paid") return settleOrderBySession(ev.sessionId);
  if (ev.type === "checkout_session.payment.failed") return failOrderBySession(ev.sessionId);
  return { ignored: true };
}
module.exports = { handleWebhook, settleOrderBySession, failOrderBySession };
