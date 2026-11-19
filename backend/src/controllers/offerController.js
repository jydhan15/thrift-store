const { z } = require("zod");
const { Offer, Product } = require("../models");
const { AppError } = require("../utils/errors");
const { ok, wrap } = require("../utils/helpers");
exports.offerSchema = z.object({ amount: z.number().int().min(1) });
exports.decideSchema = z.object({ decision: z.enum(["accepted", "rejected"]) });

exports.make = wrap(async (req, res) => {
  const p = await Product.findOne({ _id: req.params.id, status: "active", stock: { $gt: 0 } });
  if (!p) throw new AppError(404, "NOT_FOUND", "Item not available");
  if (req.body.amount >= p.price) throw new AppError(422, "OFFER_NOT_BELOW_PRICE", "Offer must be below the listed price");
  if (req.body.amount < p.price * 0.5) throw new AppError(422, "OFFER_TOO_LOW", "Offers below 50% of price are not accepted");
  if (await Offer.exists({ product: p._id, buyer: req.user.id, status: { $in: ["pending", "accepted"] } })) throw new AppError(409, "OFFER_EXISTS", "You already have an open offer");
  ok(res, await Offer.create({ product: p._id, buyer: req.user.id, amount: req.body.amount }), null, 201);
});
exports.mine = wrap(async (req, res) => ok(res, await Offer.find({ buyer: req.user.id }).sort({ createdAt: -1 })));
exports.adminList = wrap(async (req, res) => ok(res, await Offer.find({ status: "pending" }).populate("product", "name price")));
exports.decide = wrap(async (req, res) => {
  const o = await Offer.findOneAndUpdate({ _id: req.params.id, status: "pending" }, { status: req.body.decision }, { new: true });
  if (!o) throw new AppError(409, "OFFER_NOT_PENDING", "Offer not pending");
  ok(res, o);
});
