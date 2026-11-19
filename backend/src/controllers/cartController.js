const { z } = require("zod");
const { Cart, Product } = require("../models");
const { AppError } = require("../utils/errors");
const { ok, wrap } = require("../utils/helpers");
exports.addSchema = z.object({ productId: z.string(), qty: z.number().int().min(1).max(10).default(1) });

async function view(userId) {
  const cart = await Cart.findOne({ user: userId }).populate("items.product");
  const items = (cart ? cart.items : []).filter((i) => i.product).map((i) => ({ productId: i.product._id, name: i.product.name, unitPrice: i.product.price, qty: i.qty, lineTotal: i.product.price * i.qty }));
  return { items, subtotal: items.reduce((s, i) => s + i.lineTotal, 0) }; // always server-computed
}
exports.get = wrap(async (req, res) => ok(res, await view(req.user.id)));
exports.add = wrap(async (req, res) => {
  const p = await Product.findOne({ _id: req.body.productId, status: "active" });
  if (!p) throw new AppError(404, "NOT_FOUND", "Product not found");
  const cart = (await Cart.findOne({ user: req.user.id })) || new Cart({ user: req.user.id, items: [] });
  const line = cart.items.find((i) => String(i.product) === String(p._id));
  const newQty = (line ? line.qty : 0) + req.body.qty;
  if (newQty > p.stock) throw new AppError(409, "INSUFFICIENT_STOCK", "Only " + p.stock + " available");
  if (line) line.qty = newQty; else cart.items.push({ product: p._id, qty: newQty });
  await cart.save(); ok(res, await view(req.user.id), null, 201);
});
exports.remove = wrap(async (req, res) => {
  await Cart.updateOne({ user: req.user.id }, { $pull: { items: { product: req.params.productId } } });
  ok(res, await view(req.user.id));
});
