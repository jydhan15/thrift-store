// Integration tests for business differentiation, idempotency, admin rules and security hardening.
// Run with: npm test  (Jest + Supertest + in-memory MongoDB)
process.env.JWT_SECRET = "business_test_secret";
process.env.FRONTEND_URL = "http://localhost:5173";
process.env.PAYMENT_PROVIDER = "maya";
process.env.MAYA_WEBHOOK_TOKEN = "good-token";

let sessionCounter = 0;
const mockProvider = {
  createCheckout: jest.fn(async (o) => ({ id: "cs_" + o._id + "_" + (++sessionCounter), url: "http://pay.test/" + o._id })),
  retrieve: jest.fn(async () => ({ paid: false })),
  verifyWebhook: jest.fn((raw, h) => h["x-webhook-token"] === "good-token"),
  parseEvent: jest.fn((raw) => {
    const e = JSON.parse(raw.toString() || "{}");
    return { eventId: e.eventId || "evt-x", type: e.type || "ignored", sessionId: e.sessionId };
  }),
};
jest.mock("../src/services/payment", () => () => mockProvider);

const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { MongoMemoryServer } = require("mongodb-memory-server");
const MayaProvider = require("../src/services/payment/MayaProvider");

let mongod, app, M, cat, adminToken;
const auth = (t) => ({ Authorization: "Bearer " + t });
const uuid = () => "k-" + Math.random().toString(36).slice(2);

async function register(email) {
  const r = await request(app).post("/api/v1/auth/register").send({ name: "Test User", email, password: "Password123!" });
  expect(r.status).toBe(201);
  return r.body.data.token;
}
async function makeProduct(over = {}) {
  return M.Product.create({ name: "Jacket " + Math.random(), brand: "Nike", price: 10000, stock: 2,
    category: cat._id, condition: "good", size: "M", description: "d", ...over });
}
async function addAndCheckout(token, product, extra = {}, key = uuid()) {
  // A failed checkout keeps the cart, so reset it to exactly one unit.
  const current = await request(app).get("/api/v1/cart").set(auth(token));
  for (const item of current.body.data.items || []) {
    await request(app).delete("/api/v1/cart/items/" + item.productId).set(auth(token));
  }
  await request(app).post("/api/v1/cart/items").set(auth(token)).send({ productId: String(product._id), qty: 1 });
  const r = await request(app).post("/api/v1/orders").set(auth(token)).set("Idempotency-Key", key).send({
    shippingInfo: { fullName: "Test Buyer", address: "123 Test Street", phone: "0917000000" }, ...extra,
  });
  return r;
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  app = require("../src/app");
  M = require("../src/models");
  await Promise.all(Object.values(M).map((m) => m.init()));
  cat = await M.Category.create({ name: "Outerwear" });
  await M.User.create({ name: "Admin", email: "admin@business.test", password: await bcrypt.hash("Password123!", 4), role: "admin" });
  const login = await request(app).post("/api/v1/auth/login").send({ email: "admin@business.test", password: "Password123!" });
  adminToken = login.body.data.token;
}, 180000);

beforeEach(() => { mockProvider.retrieve.mockResolvedValue({ paid: false }); });
afterAll(async () => { await mongoose.disconnect(); if (mongod) await mongod.stop(); });

describe("Thrift feature 2 — offer workflow", () => {
  test("enforces the 50% floor, listing-price ceiling and one open offer, then prices checkout at the accepted amount", async () => {
    const buyer = await register("offer@business.test");
    const p = await makeProduct({ price: 10000, stock: 1 });
    const post = (amount) => request(app).post("/api/v1/products/" + p._id + "/offers").set(auth(buyer)).send({ amount });

    expect((await post(4000)).body.error.code).toBe("OFFER_TOO_LOW");
    expect((await post(10000)).body.error.code).toBe("OFFER_NOT_BELOW_PRICE");
    const made = await post(6000);
    expect(made.status).toBe(201);
    expect((await post(6500)).body.error.code).toBe("OFFER_EXISTS");

    const decided = await request(app).patch("/api/v1/admin/offers/" + made.body.data._id)
      .set(auth(adminToken)).send({ decision: "accepted" });
    expect(decided.status).toBe(200);

    const order = await addAndCheckout(buyer, p);
    expect(order.status).toBe(201);
    expect(order.body.data.subtotal).toBe(6000);         // accepted offer, not the ₱100 listing
    expect(order.body.data.total).toBe(6000 + 5000);     // + server shipping
    expect((await M.Product.findById(p._id)).price).toBe(10000); // listing untouched for others
    expect((await M.Offer.findById(made.body.data._id)).status).toBe("used");
  });

  test("rejects an offer on an unavailable item", async () => {
    const buyer = await register("offer2@business.test");
    const p = await makeProduct({ stock: 0 });
    const r = await request(app).post("/api/v1/products/" + p._id + "/offers").set(auth(buyer)).send({ amount: 6000 });
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe("NOT_FOUND");
  });
});

describe("Thrift feature 1 — reservation and cancellation", () => {
  test("cancelling an unpaid order releases stock; a cancelled order cannot be cancelled or paid again", async () => {
    const t = await register("cancel@business.test");
    const p = await makeProduct({ stock: 1 });
    const order = await addAndCheckout(t, p);
    expect(order.status).toBe(201);
    expect((await M.Product.findById(p._id)).stock).toBe(0);

    const cancel = await request(app).post("/api/v1/orders/" + order.body.data._id + "/cancel").set(auth(t));
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.status).toBe("cancelled");
    expect((await M.Product.findById(p._id)).stock).toBe(1);

    expect((await request(app).post("/api/v1/orders/" + order.body.data._id + "/cancel").set(auth(t))).status).toBe(409);
    const retry = await request(app).post("/api/v1/orders/" + order.body.data._id + "/pay").set(auth(t));
    expect(retry.body.error.code).toBe("CANNOT_RETRY");
  });
});

describe("Idempotency and price integrity", () => {
  test("concurrent checkouts with one key create one order; reusing the key with another body is a 409", async () => {
    const t = await register("idem@business.test");
    const p = await makeProduct({ stock: 2 });
    await request(app).post("/api/v1/cart/items").set(auth(t)).send({ productId: String(p._id), qty: 1 });
    const key = uuid();
    const body = { shippingInfo: { fullName: "Idem Test", address: "123 Test Street", phone: "0917000000" } };
    const [a, b] = await Promise.all([
      request(app).post("/api/v1/orders").set(auth(t)).set("Idempotency-Key", key).send(body),
      request(app).post("/api/v1/orders").set(auth(t)).set("Idempotency-Key", key).send(body),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 201]);
    expect(String(a.body.data._id)).toBe(String(b.body.data._id));
    expect(await M.Order.countDocuments({ user: a.body.data.user || (await M.User.findOne({ email: "idem@business.test" }))._id, idempotencyKey: key })).toBe(1);

    const changed = await request(app).post("/api/v1/orders").set(auth(t)).set("Idempotency-Key", key)
      .send({ ...body, couponCode: "WHATEVER" });
    expect(changed.status).toBe(409);
    expect(changed.body.error.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  test("coupon rules reject invalid use without changing the total", async () => {
    const t = await register("coupon@business.test");
    const p = await makeProduct({ stock: 3 });
    await M.Coupon.create({ code: "MINSPEND", type: "percent", value: 10, minSpend: 999999 });
    await M.Coupon.create({ code: "OLDEXP", type: "fixed", value: 1000, expiresAt: new Date("2020-01-01") });
    await M.Coupon.create({ code: "ONCE", type: "fixed", value: 1000, usageLimit: 1, usedCount: 1 });

    const first = await addAndCheckout(t, p, { couponCode: "MINSPEND" });
    expect(first.status).toBe(422);
    expect(first.body.error.code).toBe("COUPON_MIN_SPEND");
    const second = await addAndCheckout(t, p, { couponCode: "OLDEXP" });
    expect(second.body.error.code).toBe("COUPON_EXPIRED");
    const third = await addAndCheckout(t, p, { couponCode: "ONCE" });
    expect(third.body.error.code).toBe("COUPON_EXHAUSTED");
    const clean = await addAndCheckout(t, p);
    expect(clean.body.data.total).toBe(10000 + 5000); // no discount applied
  });

  test("percent coupon creation above 100 and past expiry are rejected", async () => {
    const bad = await request(app).post("/api/v1/admin/coupons").set(auth(adminToken))
      .send({ code: "BADPERCENT", type: "percent", value: 150 });
    expect(bad.status).toBe(422);
    const old = await request(app).post("/api/v1/admin/coupons").set(auth(adminToken))
      .send({ code: "PASTEXP", type: "fixed", value: 1000, expiresAt: "2020-01-01T00:00:00.000Z" });
    expect(old.status).toBe(422);
  });
});

describe("Admin operations", () => {
  test("illegal status transitions return 409; reconcile can settle an older payment session", async () => {
    const t = await register("adminops@business.test");
    const p = await makeProduct({ stock: 2 });
    const order = await addAndCheckout(t, p);
    const id = order.body.data._id;

    const illegal = await request(app).patch("/api/v1/admin/orders/" + id + "/status")
      .set(auth(adminToken)).send({ status: "delivered" });
    expect(illegal.status).toBe(409);
    expect(illegal.body.error.code).toBe("ILLEGAL_TRANSITION");

    await M.Order.updateOne({ _id: id }, { status: "paid" });
    const legal = await request(app).patch("/api/v1/admin/orders/" + id + "/status")
      .set(auth(adminToken)).send({ status: "processing" });
    expect(legal.status).toBe(200);
    expect(legal.body.data.history.some((h) => h.to === "processing")).toBe(true);

    // Retry created a second session; the first one is kept in previousRefs.
    const t2 = await register("recon@business.test");
    const p2 = await makeProduct();
    const o2 = await addAndCheckout(t2, p2);
    const oldRef = o2.body.data.gatewayRef;
    const retried = await request(app).post("/api/v1/orders/" + o2.body.data._id + "/pay").set(auth(t2));
    expect(retried.body.data.previousRefs).toContain(oldRef);
    mockProvider.retrieve.mockResolvedValueOnce({ paid: true, amount: o2.body.data.total, currency: "PHP", paymentId: "pay_old" });
    const rec = await request(app).post("/api/v1/admin/orders/" + o2.body.data._id + "/reconcile").set(auth(adminToken));
    expect(rec.status).toBe(200);
    expect(rec.body.data.result.paid).toBe(true);
    expect(rec.body.data.order.status).toBe("paid");
  });

  test("every admin route rejects a customer token with 403 and no token with 401", async () => {
    const customer = await register("roles@business.test");
    const id = new mongoose.Types.ObjectId();
    const routes = [
      ["get", "/api/v1/admin/dashboard"], ["get", "/api/v1/admin/orders"],
      ["get", "/api/v1/admin/offers"], ["get", "/api/v1/admin/coupons"],
      ["post", "/api/v1/admin/products", { name: "X", price: 100 }],
      ["patch", "/api/v1/admin/products/" + id, { name: "X" }],
      ["delete", "/api/v1/admin/products/" + id],
      ["patch", "/api/v1/admin/products/" + id + "/stock", { stock: 1, reason: "test" }],
      ["patch", "/api/v1/admin/orders/" + id + "/status", { status: "shipped" }],
      ["post", "/api/v1/admin/orders/" + id + "/reconcile"],
      ["patch", "/api/v1/admin/offers/" + id, { decision: "accepted" }],
      ["post", "/api/v1/admin/coupons", { code: "XXXXX", type: "fixed", value: 100 }],
    ];
    for (const [method, path, body] of routes) {
      const req = request(app)[method](path);
      if (body) req.send(body);
      expect({ path, scenario: "no token", status: (await req).status }).toEqual({ path, scenario: "no token", status: 401 });
      const withToken = request(app)[method](path);
      if (body) withToken.send(body);
      expect({ path, scenario: "customer token", status: (await withToken.set(auth(customer))).status })
        .toEqual({ path, scenario: "customer token", status: 403 });
    }
  });

  test("query operators and malformed ids are rejected with 422, not passed to MongoDB", async () => {
    expect((await request(app).get("/api/v1/products/not-an-id")).status).toBe(422);
    const injected = await request(app).get("/api/v1/admin/orders?status[$ne]=paid").set(auth(adminToken));
    expect(injected.status).toBe(422);
    expect(injected.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("Webhook verification and failure paths", () => {
  test("malformed payload is a 422 and an untrusted origin is blocked by CORS", async () => {
    const bad = await request(app).post("/api/v1/webhooks/maya?token=good-token")
      .set("Content-Type", "application/json").send("not json");
    expect(bad.status).toBe(422);
    expect(bad.body.error.code).toBe("INVALID_PAYLOAD");

    const cors = await request(app).get("/api/v1/categories").set("Origin", "https://evil.example");
    expect(cors.status).toBe(403);
    expect(cors.body.error.code).toBe("CORS_DENIED");
    expect(bad.body.requestId).toBeTruthy();
  });

  test("local dev origins work on any localhost/LAN port but production origins stay explicit", async () => {
    for (const origin of ["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173", "http://192.168.1.50:5173", "http://10.0.0.5:4173"]) {
      const r = await request(app).get("/api/v1/categories").set("Origin", origin);
      expect({ origin, status: r.status }).toEqual({ origin, status: 200 });
      expect({ origin, allowOrigin: r.headers["access-control-allow-origin"] })
        .toEqual({ origin, allowOrigin: origin });
    }
    const prod = await request(app).get("/api/v1/categories").set("Origin", "https://random.example");
    expect(prod.status).toBe(403);
  });

  test("a gateway amount mismatch flags the order instead of marking it paid", async () => {
    const t = await register("mismatch@business.test");
    const p = await makeProduct();
    const order = await addAndCheckout(t, p);
    mockProvider.retrieve.mockResolvedValueOnce({ paid: true, amount: 1, currency: "PHP", paymentId: "pay_bad" });
    const hook = await request(app).post("/api/v1/webhooks/maya?token=good-token").send({
      eventId: "evt-mismatch-" + uuid(), type: "checkout_session.payment.paid", sessionId: order.body.data.gatewayRef,
    });
    expect(hook.body.flagged).toBe(true);
    const saved = await M.Order.findById(order.body.data._id);
    expect(saved.status).toBe("pending_payment");
    expect(saved.flag).toBe("AMOUNT_MISMATCH");
    expect(saved.history.some((h) => h.to === "AMOUNT_MISMATCH")).toBe(true);
  });

  test("real Maya event mapping treats CHECKOUT_FAILURE as a failed payment", () => {
    const p = new MayaProvider();
    expect(p.parseEvent(Buffer.from(JSON.stringify({ id: "cs_1", paymentStatus: "PAYMENT_SUCCESS" }))).type)
      .toBe("checkout_session.payment.paid");
    expect(p.parseEvent(Buffer.from(JSON.stringify({ id: "cs_2", paymentStatus: "CHECKOUT_FAILURE" }))).type)
      .toBe("checkout_session.payment.failed");
    expect(() => p.parseEvent(Buffer.from("oops"))).toThrow();
  });
});
