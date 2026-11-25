const r = require("express").Router();
const rateLimit = require("express-rate-limit");
const { auth, requireRole } = require("../middleware/auth");
const v = require("../middleware/validate");
const V = require("../validators/common");
const A = require("../controllers/authController");
const P = require("../controllers/productController");
const C = require("../controllers/cartController");
const O = require("../controllers/orderController");
const F = require("../controllers/offerController");
const M = require("../controllers/miscController");
const RC = require("../controllers/retryController");

const limited = (message) => (req, res) => res.status(429).json({
  success: false, error: { code: "RATE_LIMITED", message }, requestId: req.id,
});
const authLimit = rateLimit({ windowMs: 15 * 60000, limit: 30, standardHeaders: true, handler: limited("Too many requests") });
const aiLimit = rateLimit({ windowMs: 60000, limit: 10, standardHeaders: true, handler: limited("Too many AI requests") });
const apiLimit = rateLimit({ windowMs: 15 * 60000, limit: 500, standardHeaders: true, handler: limited("Too many requests") });
const admin = [auth, requireRole("admin")];

r.use(apiLimit);

r.post("/auth/register", authLimit, v(A.registerSchema), A.register);
r.post("/auth/login", authLimit, v(A.loginSchema), A.login);

r.get("/categories", P.categories);
r.get("/brands", P.brands);
r.get("/products", V.validateQuery(V.listQuery), P.list);
r.get("/products/:id", v(V.idParam, "params"), P.get);
r.post("/products/:id/offers", auth, v(V.idParam, "params"), v(F.offerSchema), F.make); // thrift feature 2

r.get("/cart", auth, C.get);
r.post("/cart/items", auth, v(C.addSchema), C.add);
r.delete("/cart/items/:productId", auth, v(V.productIdParam, "params"), C.remove);

r.post("/orders", auth, v(O.checkoutSchema), O.checkout); // reserves items 15 min (thrift feature 1)
r.get("/orders", auth, O.mine);
r.get("/orders/:id", auth, v(V.idParam, "params"), O.getMine);
r.post("/orders/:id/cancel", auth, v(V.idParam, "params"), O.cancel);
r.post("/orders/:id/pay", auth, v(V.idParam, "params"), RC.retry); // retry: new session, same order
r.get("/offers/mine", auth, F.mine);

r.post("/ai/assistant", auth, aiLimit, v(M.aiSchema), M.assistant);

// admin — every route goes through authentication AND the server-side role check
r.post("/admin/products", ...admin, v(P.productSchema), P.create);
r.patch("/admin/products/:id", ...admin, v(V.idParam, "params"), v(P.productSchema.partial()), P.update);
r.delete("/admin/products/:id", ...admin, v(V.idParam, "params"), P.remove);
r.patch("/admin/products/:id/stock", ...admin, v(V.idParam, "params"), v(P.stockSchema), P.adjustStock);
r.get("/admin/orders", ...admin, V.validateQuery(V.adminOrderQuery), O.adminList);
r.patch("/admin/orders/:id/status", ...admin, v(V.idParam, "params"), v(O.statusSchema), O.adminStatus);
r.post("/admin/orders/:id/reconcile", ...admin, v(V.idParam, "params"), O.reconcile);
r.get("/admin/dashboard", ...admin, O.dashboard);
r.get("/admin/offers", ...admin, F.adminList);
r.patch("/admin/offers/:id", ...admin, v(V.idParam, "params"), v(F.decideSchema), F.decide);
r.post("/admin/coupons", ...admin, v(M.couponSchema), M.createCoupon);
r.get("/admin/coupons", ...admin, M.listCoupons);

module.exports = r;
