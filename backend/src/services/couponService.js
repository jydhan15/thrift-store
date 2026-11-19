const { Coupon, Order } = require("../models");
const { AppError } = require("../utils/errors");

async function validateAndPrice(code, userId, subtotal) {
  const c = await Coupon.findOne({ code: code.toUpperCase() });
  const fail = (k, m) => { throw new AppError(422, k, m); };
  if (!c || !c.active) fail("COUPON_INVALID", "Coupon not valid");
  if (c.expiresAt && c.expiresAt < new Date()) fail("COUPON_EXPIRED", "Coupon expired");
  if (subtotal < c.minSpend) fail("COUPON_MIN_SPEND", "Minimum spend not reached");
  if (c.usageLimit && c.usedCount >= c.usageLimit) fail("COUPON_EXHAUSTED", "Coupon fully used");
  const used = await Order.countDocuments({ user: userId, couponCode: c.code, status: { $nin: ["cancelled", "expired", "payment_failed"] } });
  if (used >= c.perUserLimit) fail("COUPON_USER_LIMIT", "You already used this coupon");
  const discount = c.type === "percent" ? Math.round((subtotal * c.value) / 100) : c.value;
  return { coupon: c, discount: Math.min(discount, subtotal) };
}
module.exports = { validateAndPrice };
