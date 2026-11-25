const { z } = require("zod");
const mongoose = require("mongoose");
const { Product, StockLog, Order, Category } = require("../models");
const { AppError } = require("../utils/errors");
const { ok, wrap, pageParams } = require("../utils/helpers");

const SORTS = { price_asc: { price: 1 }, price_desc: { price: -1 }, newest: { createdAt: -1 } };
exports.productSchema = z.object({
  name: z.string().min(2).max(120), brand: z.string().max(40).optional(), description: z.string().max(2000).optional(),
  price: z.number().int().min(0), stock: z.number().int().min(0).default(1),
  category: z.string().optional(), condition: z.enum(["like_new", "good", "fair", "worn"]).default("good"),
  size: z.string().max(20).optional(), imageUrl: z.string().url().optional(), status: z.enum(["active", "inactive"]).optional(),
});
exports.stockSchema = z.object({ stock: z.number().int().min(0), reason: z.string().min(3).max(200) });

// A product must reference a real category, otherwise the catalog has dangling
// refs and Mongoose CastError masquerades as a 404.
async function checkCategory(id) {
  if (!id) return;
  if (!mongoose.isValidObjectId(id)) throw new AppError(422, "VALIDATION_ERROR", "Invalid category id");
  if (!(await Category.exists({ _id: id }))) throw new AppError(422, "VALIDATION_ERROR", "Category does not exist");
}

// req.query is whitelisted by validators/common.js (no operator injection).
exports.list = wrap(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query);
  const f = { status: "active" };
  if (req.query.q) f.name = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  if (req.query.category) f.category = new mongoose.Types.ObjectId(req.query.category);
  if (req.query.condition) f.condition = req.query.condition;
  if (req.query.brand) f.brand = String(req.query.brand);
  if (req.query.minPrice || req.query.maxPrice) {
    f.price = { ...(req.query.minPrice && { $gte: Number(req.query.minPrice) }), ...(req.query.maxPrice && { $lte: Number(req.query.maxPrice) }) };
  }
  const sort = SORTS[req.query.sort] || SORTS.newest;
  const [items, total] = await Promise.all([Product.find(f).sort(sort).skip(skip).limit(limit), Product.countDocuments(f)]);
  ok(res, items, { total, page, limit });
});
exports.get = wrap(async (req, res) => {
  const p = await Product.findOne({ _id: req.params.id, status: "active" });
  if (!p) throw new AppError(404, "NOT_FOUND", "Product not found");
  ok(res, p);
});
exports.create = wrap(async (req, res) => {
  await checkCategory(req.body.category);
  ok(res, await Product.create(req.body), null, 201);
});
exports.update = wrap(async (req, res) => {
  if ("category" in req.body) await checkCategory(req.body.category);
  const p = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!p) throw new AppError(404, "NOT_FOUND", "Product not found");
  ok(res, p);
});
exports.remove = wrap(async (req, res) => {
  if (await Order.exists({ "items.product": req.params.id })) throw new AppError(409, "PRODUCT_IN_ORDERS", "Has order history; deactivate instead");
  const r = await Product.findByIdAndDelete(req.params.id);
  if (!r) throw new AppError(404, "NOT_FOUND", "Product not found");
  res.status(204).end();
});
exports.adjustStock = wrap(async (req, res) => {
  const before = await Product.findById(req.params.id);
  if (!before) throw new AppError(404, "NOT_FOUND", "Product not found");
  // Compare-and-set: two concurrent admins cannot silently overwrite each other.
  const updated = await Product.findOneAndUpdate(
    { _id: req.params.id, stock: before.stock },
    { $set: { stock: req.body.stock } }, { new: true, runValidators: true });
  if (!updated) throw new AppError(409, "STOCK_CHANGED", "Stock changed concurrently; refresh and retry");
  await StockLog.create({ product: updated._id, previous: before.stock, current: req.body.stock, reason: req.body.reason, actor: req.user.id });
  ok(res, updated);
});

exports.categories = wrap(async (req, res) => {
  const rows = await Product.aggregate([{ $match: { status: "active", stock: { $gt: 0 } } }, { $group: { _id: "$category", count: { $sum: 1 } } }]);
  const cats = await Category.find().lean();
  ok(res, cats.map((c) => ({ _id: c._id, name: c.name, count: (rows.find((r) => String(r._id) === String(c._id)) || {}).count || 0 })).filter((c) => c.count > 0));
});
exports.brands = wrap(async (req, res) => {
  const match = { status: "active", stock: { $gt: 0 }, brand: { $exists: true, $nin: [null, ""] } };
  if (req.query.category) {
    if (!mongoose.isValidObjectId(req.query.category)) throw new AppError(422, "VALIDATION_ERROR", "Invalid category");
    match.category = new mongoose.Types.ObjectId(req.query.category);
  }
  const rows = await Product.aggregate([{ $match: match }, { $group: { _id: "$brand", count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }]);
  ok(res, rows.map((r) => ({ name: r._id, count: r.count })));
});
