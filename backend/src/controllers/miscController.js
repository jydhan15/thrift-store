const { z } = require("zod");
const { Coupon } = require("../models");
const { ok, wrap } = require("../utils/helpers");
const { handleWebhook } = require("../services/paymentService");
const { aiService } = require("../services/ai");
exports.aiSchema = z.object({ text: z.string().min(3).max(300) });
exports.couponSchema = z.object({ code: z.string().min(3).max(30), type: z.enum(["percent", "fixed"]), value: z.number().int().min(1),
  minSpend: z.number().int().min(0).default(0), expiresAt: z.string().datetime().optional(), usageLimit: z.number().int().min(0).default(0), perUserLimit: z.number().int().min(1).default(1) });
exports.createCoupon = wrap(async (req, res) => ok(res, await Coupon.create(req.body), null, 201));
exports.listCoupons = wrap(async (req, res) => ok(res, await Coupon.find()));
exports.webhook = wrap(async (req, res) => { await handleWebhook(req.body, req.headers); res.status(200).json({ received: true }); });
exports.assistant = wrap(async (req, res) => ok(res, await aiService.recommend(req.body.text)));
