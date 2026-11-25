const crypto = require("crypto");
const { z } = require("zod");
const { Order } = require("../models");
const { AppError } = require("../utils/errors");
const { ok, wrap, pageParams } = require("../utils/helpers");
const { checkout } = require("../services/checkoutService");
const { releaseOrder, transition, canTransition } = require("../services/orderService");
const { settleOrderBySession } = require("../services/paymentService");

exports.checkoutSchema = z.object({
  couponCode: z.string().max(30).optional(),
  shippingInfo: z.object({ fullName: z.string().min(2).max(80), address: z.string().min(5).max(200), phone: z.string().min(7).max(20) }),
});
exports.statusSchema = z.object({ status: z.enum(["processing", "shipped", "delivered"]) });

exports.checkout = wrap(async (req, res) => {
  const key = String(req.headers["idempotency-key"] || "");
  if (!key || !/^[A-Za-z0-9_-]{1,100}$/.test(key)) {
    throw new AppError(422, "IDEMPOTENCY_KEY_REQUIRED", "A valid Idempotency-Key header is required");
  }
  const fingerprint = crypto.createHash("sha256").update(JSON.stringify(req.body)).digest("hex");
  ok(res, await checkout(req.user.id, { ...req.body, idempotencyKey: key, fingerprint }), null, 201);
});
exports.mine = wrap(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query);
  const f = { user: req.user.id };
  ok(res, await Order.find(f).sort({ createdAt: -1 }).skip(skip).limit(limit), { total: await Order.countDocuments(f), page, limit });
});
exports.getMine = wrap(async (req, res) => {
  const o = await Order.findOne({ _id: req.params.id, user: req.user.id });
  if (!o) throw new AppError(404, "NOT_FOUND", "Order not found");
  ok(res, o);
});
exports.cancel = wrap(async (req, res) => {
  const o = await Order.findOne({ _id: req.params.id, user: req.user.id });
  if (!o) throw new AppError(404, "NOT_FOUND", "Order not found");
  if (o.status !== "pending_payment") throw new AppError(409, "CANNOT_CANCEL", "Only unpaid orders can be cancelled");
  ok(res, await releaseOrder(o._id, "cancelled", req.user.id));
});

// admin — req.query is whitelisted by validators/common.js before this handler
exports.adminList = wrap(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query);
  const f = {};
  if (req.query.status) f.status = req.query.status;
  if (req.query.from || req.query.to) {
    f.createdAt = { ...(req.query.from && { $gte: new Date(req.query.from) }), ...(req.query.to && { $lte: new Date(req.query.to) }) };
  }
  ok(res, await Order.find(f).sort({ createdAt: -1 }).skip(skip).limit(limit), { total: await Order.countDocuments(f), page, limit });
});
exports.adminStatus = wrap(async (req, res) => {
  const o = await Order.findById(req.params.id);
  if (!o) throw new AppError(404, "NOT_FOUND", "Order not found");
  if (!canTransition(o.status, req.body.status)) throw new AppError(409, "ILLEGAL_TRANSITION", o.status + " -> " + req.body.status);
  ok(res, await transition(o._id, o.status, req.body.status, req.user.id));
});
exports.reconcile = wrap(async (req, res) => {
  const o = await Order.findById(req.params.id);
  if (!o) throw new AppError(404, "NOT_FOUND", "Order not found");
  const refs = [o.gatewayRef, ...(o.previousRefs || [])].filter(Boolean);
  if (!refs.length) throw new AppError(404, "NOT_FOUND", "Order has no payment session");
  let result = { ignored: true };
  for (const ref of refs) { // a retry may have left an older session paid
    result = await settleOrderBySession(ref);
    if (!result.ignored) break;
  }
  ok(res, { result, order: await Order.findById(o._id) });
});
exports.dashboard = wrap(async (req, res) => {
  const { Product } = require("../models");
  const paid = await Order.aggregate([{ $match: { status: { $in: ["paid", "processing", "shipped", "delivered"] } } }, { $group: { _id: null, count: { $sum: 1 }, gross: { $sum: "$total" } } }]);
  ok(res, {
    paidOrders: paid[0]?.count || 0, grossSales: paid[0]?.gross || 0,
    pendingOrders: await Order.countDocuments({ status: "pending_payment" }),
    flaggedOrders: await Order.countDocuments({ flag: { $exists: true } }),
    lowStock: await Product.find({ stock: { $lte: 0 } }).select("name stock").limit(20),
  });
});
