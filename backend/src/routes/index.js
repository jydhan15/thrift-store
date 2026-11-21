const r = require("express").Router();
const rateLimit = require("express-rate-limit");
const { auth, requireRole } = require("../middleware/auth");
const v = require("../middleware/validate");
const A = require("../controllers/authController");
const P = require("../controllers/productController");
const C = require("../controllers/cartController");
const O = require("../controllers/orderController");
const F = require("../controllers/offerController");
const M = require("../controllers/miscController");
const RC = require("../controllers/retryController");

const authLimit = rateLimit({ windowMs: 15 * 60000, limit: 30, standardHeaders: true, message: { success: false, error: { code: "RATE_LIMITED", message: "Too many requests" } } });
const aiLimit = rateLimit({ windowMs: 60000, limit: 10, message: { success: false, error: { code: "RATE_LIMITED", message: "Too many AI requests" } } });
const admin = [auth, requireRole("admin")];

r.post("/auth/register", authLimit, v(A.registerSchema), A.register);
r.post("/auth/login", authLimit, v(A.loginSchema), A.login);

r.get("/categories", P.categories);
r.get("/brands", P.brands);
r.get("/products", P.list);
r.get("/products/:id", P.get);
r.post("/products/:id/offers", auth, v(F.offerSchema), F.make);       // thrift feature 2

r.get("/cart", auth, C.get);
r.post("/cart/items", auth, v(C.addSchema), C.add);
r.delete("/cart/items/:productId", auth, C.remove);

r.post("/orders", auth, v(O.checkoutSchema), O.checkout);              // reserves items 15 min (thrift feature 1)
r.get("/orders", auth, O.mine);
r.get("/orders/:id", auth, O.getMine);
r.post("/orders/:id/cancel", auth, O.cancel);
r.post("/orders/:id/pay", auth, RC.retry);                             // retry payment (new session, same order)
r.get("/offers/mine", auth, F.mine);

r.post("/ai/assistant", auth, aiLimit, v(M.aiSchema), M.assistant);

// admin
r.post("/admin/products", ...admin, v(P.productSchema), P.create);
r.patch("/admin/products/:id", ...admin, v(P.productSchema.partial()), P.update);
r.delete("/admin/products/:id", ...admin, P.remove);
r.patch("/admin/products/:id/stock", ...admin, v(P.stockSchema), P.adjustStock);
r.get("/admin/orders", ...admin, O.adminList);
r.patch("/admin/orders/:id/status", ...admin, v(O.statusSchema), O.adminStatus);
r.post("/admin/orders/:id/reconcile", ...admin, O.reconcile);
r.get("/admin/dashboard", ...admin, O.dashboard);
r.get("/admin/offers", ...admin, F.adminList);
r.patch("/admin/offers/:id", ...admin, v(F.decideSchema), F.decide);
r.post("/admin/coupons", ...admin, v(M.couponSchema), M.createCoupon);
r.get("/admin/coupons", ...admin, M.listCoupons);
module.exports = r;