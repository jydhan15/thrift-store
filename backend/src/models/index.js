const { Schema, model, Types } = require("mongoose");
const opts = { timestamps: true };

const User = model("User", new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["customer", "admin"], default: "customer" },
}, opts));

const Category = model("Category", new Schema({ name: { type: String, unique: true, required: true } }));

// Thrift: every item is unique (stock normally 1) with a condition grade
const Product = model("Product", new Schema({
  name: { type: String, required: true, index: true },
  brand: { type: String, index: true },
  description: String,
  price: { type: Number, required: true, min: 0 }, // centavos
  stock: { type: Number, required: true, min: 0, default: 1 },
  category: { type: Types.ObjectId, ref: "Category" },
  condition: { type: String, enum: ["like_new", "good", "fair", "worn"], default: "good" },
  size: String,
  imageUrl: String,
  status: { type: String, enum: ["active", "inactive"], default: "active" },
}, opts));

const StockLog = model("StockLog", new Schema({
  product: { type: Types.ObjectId, ref: "Product" }, previous: Number, current: Number,
  reason: String, actor: { type: Types.ObjectId, ref: "User" },
}, opts));

const Cart = model("Cart", new Schema({
  user: { type: Types.ObjectId, ref: "User", unique: true },
  items: [{ product: { type: Types.ObjectId, ref: "Product" }, qty: { type: Number, min: 1 }, _id: false }],
}, opts));

const Coupon = model("Coupon", new Schema({
  code: { type: String, unique: true, uppercase: true },
  type: { type: String, enum: ["percent", "fixed"] }, value: Number,
  minSpend: { type: Number, default: 0 }, expiresAt: Date,
  usageLimit: { type: Number, default: 0 }, usedCount: { type: Number, default: 0 },
  perUserLimit: { type: Number, default: 1 }, active: { type: Boolean, default: true },
}, opts));

const orderSchema = new Schema({
  user: { type: Types.ObjectId, ref: "User", index: true },
  items: [{ product: Types.ObjectId, name: String, unitPrice: Number, qty: Number, _id: false }],
  subtotal: Number, discount: { type: Number, default: 0 }, shipping: Number, total: Number,
  couponCode: String,
  shippingInfo: { fullName: String, address: String, phone: String },
  status: { type: String, default: "pending_payment", index: true,
    enum: ["pending_payment", "paid", "processing", "shipped", "delivered", "cancelled", "expired", "payment_failed"] },
  history: [{ from: String, to: String, actor: String, at: { type: Date, default: Date.now }, _id: false }],
  expiresAt: Date, // reservation countdown
  idempotencyKey: String,
  gatewayRef: { type: String, unique: true, sparse: true },
  checkoutUrl: String, paymentId: String, paidAt: Date,
  flag: String, // AMOUNT_MISMATCH, PAID_AFTER_EXPIRY
}, opts);
orderSchema.index({ user: 1, idempotencyKey: 1 }, { unique: true, sparse: true });
const Order = model("Order", orderSchema);

const WebhookEvent = model("WebhookEvent", new Schema({
  eventId: { type: String, unique: true }, type: String,
}, opts));

// THRIFT FEATURE 2: buyer offers
const Offer = model("Offer", new Schema({
  product: { type: Types.ObjectId, ref: "Product", index: true },
  buyer: { type: Types.ObjectId, ref: "User", index: true },
  amount: { type: Number, min: 1 }, // centavos
  status: { type: String, enum: ["pending", "accepted", "rejected", "used"], default: "pending" },
}, opts));

module.exports = { User, Category, Product, StockLog, Cart, Coupon, Order, WebhookEvent, Offer };
