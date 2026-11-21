const { Product } = require("../models");
const { AppError } = require("../utils/errors");

// Shared stock reservation, used by checkoutService and retryService.

// Atomic conditional decrement: two buyers can never both take the last unit.
// Returns the updated product, or throws 409 ITEM_UNAVAILABLE.
async function reserve(item) {
  const p = await Product.findOneAndUpdate(
    { _id: item.product, status: "active", stock: { $gte: item.qty } },
    { $inc: { stock: -item.qty } }, { new: true });
  if (!p) throw new AppError(409, "ITEM_UNAVAILABLE", "An item was just taken or is unavailable");
  return p;
}

// Give stock back (rollback or released order).
async function release(items) {
  for (const it of items) await Product.updateOne({ _id: it.product }, { $inc: { stock: it.qty } });
}

// All-or-nothing: either every item is reserved, or none is.
async function reserveAll(items) {
  const taken = [];
  try {
    for (const it of items) { await reserve(it); taken.push(it); }
  } catch (e) { await release(taken); throw e; }
}

module.exports = { reserve, release, reserveAll };
