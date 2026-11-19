require("dotenv").config();
const bcrypt = require("bcryptjs");
const getDb = require("./config/db");
const { User, Category, Product, Coupon, Order } = require("./models");
const { buildItems, categoryOf, CATEGORIES, BRANDS } = require("./seedData");
(async () => {
  await getDb();
  if (process.argv.includes("--reset")) { for (const m of Object.values(require("./models"))) await m.deleteMany({}); console.log("reset"); }
  // rename old categories (safe to re-run)
  for (const [from, to] of [["Tops", "Shirts"], ["Bottoms", "Pants"], ["Dresses", "Dresses & Skirts"]]) { try { await Category.updateOne({ name: from }, { name: to }); } catch {} }
  const cats = {};
  for (const n of CATEGORIES) cats[n] = (await Category.findOneAndUpdate({ name: n }, { name: n }, { upsert: true, new: true }))._id;
  const hash = await bcrypt.hash("Password123!", 10);
  await User.findOneAndUpdate({ email: "admin@thrift.test" }, { name: "Admin", email: "admin@thrift.test", password: hash, role: "admin" }, { upsert: true });
  for (const n of [1, 2]) await User.findOneAndUpdate({ email: "customer" + n + "@thrift.test" }, { name: "Customer " + n, email: "customer" + n + "@thrift.test", password: hash }, { upsert: true });
  // remove OLD generated catalog (keeps anything with orders and your own custom items), then rebuild
  const used = await Order.distinct("items.product");
  const del = await Product.deleteMany({ _id: { $nin: used }, description: /once sold, it is gone|^One-of-a-kind thrifted/ });
  console.log("removed old generated items:", del.deletedCount);
  for (const it of buildItems(160)) {
    const { category, ...rest } = it;
    await Product.findOneAndUpdate({ name: it.name }, { $set: { ...rest, category: cats[category], status: "active" }, $setOnInsert: { stock: 1 } }, { upsert: true });
  }
  // every remaining item gets a category and a brand
  let k = 0;
  for (const p of await Product.find()) {
    p.category = cats[categoryOf(p.name)];
    if (!p.brand) { const m = /Brand: (.+)/.exec(p.description || ""); p.brand = m ? m[1].trim() : BRANDS[k++ % BRANDS.length]; }
    await p.save();
  }
  for (const c of [{ code: "WELCOME10", type: "percent", value: 10, usageLimit: 100 }, { code: "SAVE100", type: "fixed", value: 10000, minSpend: 50000 }, { code: "EXPIRED", type: "percent", value: 50, expiresAt: new Date("2020-01-01") }])
    await Coupon.findOneAndUpdate({ code: c.code }, c, { upsert: true });
  console.log("seeded " + (await Product.countDocuments()) + " items. admin@thrift.test / Password123!"); process.exit(0);
})();
