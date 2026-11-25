const { z } = require("zod");
const { Coupon } = require("../models");
const { AppError } = require("../utils/errors");
const { ok, wrap } = require("../utils/helpers");
const { handleWebhook } = require("../services/paymentService");
const { aiService } = require("../services/ai");

exports.aiSchema = z.object({ text: z.string().min(3).max(300) });
exports.couponSchema = z.object({
  code: z.string().min(3).max(30),
  type: z.enum(["percent", "fixed"]),
  value: z.number().int().min(1).max(100000000),
  minSpend: z.number().int().min(0).default(0),
  expiresAt: z.string().datetime().optional(),
  usageLimit: z.number().int().min(0).default(0),
  perUserLimit: z.number().int().min(1).default(1),
});

exports.createCoupon = wrap(async (req, res) => {
  const b = req.body;
  if (b.type === "percent" && b.value > 100) {
    throw new AppError(422, "VALIDATION_ERROR", "A percent coupon cannot exceed 100");
  }
  if (b.expiresAt && new Date(b.expiresAt) <= new Date()) {
    throw new AppError(422, "VALIDATION_ERROR", "Coupon expiry must be in the future");
  }
  ok(res, await Coupon.create(b), null, 201);
});
exports.listCoupons = wrap(async (req, res) => ok(res, await Coupon.find()));

// Webhook: handleWebhook verifies the signature/token, returns what happened,
// and stores the event id only after successful processing.
exports.webhook = wrap(async (req, res) => {
  const result = await handleWebhook(req.body, req.headers);
  res.status(200).json({ received: true, ...result });
});
exports.assistant = wrap(async (req, res) => ok(res, await aiService.recommend(req.body.text)));
