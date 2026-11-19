// Integration tests: Jest + Supertest + in-memory MongoDB. Run: npm test
process.env.JWT_SECRET = "test_secret";
process.env.FRONTEND_URL = "http://localhost:5173";
process.env.PAYMENT_PROVIDER = "maya";
process.env.MAYA_WEBHOOK_TOKEN = "good-token";

// Fake payment gateway: no real network calls in tests
jest.mock("../src/services/payment", () => {
  const fake = {
    createCheckout: async (o) => ({ id: "cs_" + o._id, url: "http://pay.test/" + o._id }),
    retrieve: async () => ({ paid: false }),
    verifyWebhook: (raw, h) => h["x-webhook-token"] === "good-token",
    parseEvent: () => ({ eventId: "evt1", type: "ignored", sessionId: "s" }),
  };
  return () => fake;
});

const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongod, app, M, cat;
const auth = (t) => ({ Authorization: "Bearer " + t });
async function register(email) {
  const r = await request(app).post("/api/v1/auth/register").send({ name: "Test User", email, password: "Password123!" });
  return r.body.data.token;
}
async function makeProduct(over = {}) {
  return M.Product.create({ name: "Test Item " + Math.random(), brand: "Nike", price: 10000, stock: 1, category: cat._id, condition: "good", size: "M", description: "d", ...over });
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  app = require("../src/app");
  M = require("../src/models");
  await Promise.all(Object.values(M).map((m) => m.init())); // build unique indexes first
  cat = await M.Category.create({ name: "Shirts" });
  await M.User.create({ name: "Admin", email: "admin@t.test", password: await bcrypt.hash("Password123!", 4), role: "admin" });
  await M.Coupon.create({ code: "TEN", type: "percent", value: 10 });
}, 180000);
afterAll(async () => { await mongoose.disconnect(); if (mongod) await mongod.stop(); });

describe("Authentication", () => {
  test("register returns a token; duplicate email gives 409; wrong password gives 401", async () => {
    const ok = await request(app).post("/api/v1/auth/register").send({ name: "Ann", email: "ann@t.test", password: "Password123!" });
    expect(ok.status).toBe(201); expect(ok.body.data.token).toBeTruthy();
    const dup = await request(app).post("/api/v1/auth/register").send({ name: "Ann", email: "ann@t.test", password: "Password123!" });
    expect(dup.status).toBe(409); expect(dup.body.error.code).toBe("EMAIL_TAKEN");
    const bad = await request(app).post("/api/v1/auth/login").send({ email: "ann@t.test", password: "wrong-pass" });
    expect(bad.status).toBe(401); expect(bad.body.error.code).toBe("INVALID_CREDENTIALS");
  });
});

describe("Role enforcement", () => {
  test("no token gives 401, customer token on admin route gives 403, admin gets 200", async () => {
    const customer = await register("role@t.test");
    expect((await request(app).get("/api/v1/admin/dashboard")).status).toBe(401);
    expect((await request(app).get("/api/v1/admin/dashboard").set(auth(customer))).status).toBe(403);
    const login = await request(app).post("/api/v1/auth/login").send({ email: "admin@t.test", password: "Password123!" });
    expect((await request(app).get("/api/v1/admin/dashboard").set(auth(login.body.data.token))).status).toBe(200);
  });
});

describe("Checkout pricing", () => {
  test("server computes totals, rejects client-sent prices, and honours the idempotency key", async () => {
    const token = await register("price@t.test");
    const p = await makeProduct({ price: 10000 });
    await request(app).post("/api/v1/cart/items").set(auth(token)).send({ productId: String(p._id), qty: 1 });
    const body = { shippingInfo: { fullName: "Price Test", address: "123 Test Street", phone: "0917000000" }, couponCode: "TEN" };
    const tamper = await request(app).post("/api/v1/orders").set(auth(token)).set("Idempotency-Key", "k-tamper").send({ ...body, total: 1 });
    expect(tamper.status).toBe(422); // unknown field "total" rejected
    const res = await request(app).post("/api/v1/orders").set(auth(token)).set("Idempotency-Key", "k1").send(body);
    expect(res.status).toBe(201);
    expect(res.body.data.subtotal).toBe(10000);
    expect(res.body.data.discount).toBe(1000);          // 10% coupon
    expect(res.body.data.total).toBe(10000 - 1000 + 5000); // + shipping
    const again = await request(app).post("/api/v1/orders").set(auth(token)).set("Idempotency-Key", "k1").send(body);
    expect(again.body.data._id).toBe(res.body.data._id); // same key -> same order, no duplicate
  });
});

describe("Stock conflict", () => {
  test("two buyers race for the last unit: exactly one succeeds", async () => {
    const a = await register("racea@t.test"), b = await register("raceb@t.test");
    const p = await makeProduct({ stock: 1 });
    for (const t of [a, b]) await request(app).post("/api/v1/cart/items").set(auth(t)).send({ productId: String(p._id), qty: 1 });
    const body = { shippingInfo: { fullName: "Race Test", address: "123 Test Street", phone: "0917000000" } };
    const [ra, rb] = await Promise.all([
      request(app).post("/api/v1/orders").set(auth(a)).set("Idempotency-Key", "race-a").send(body),
      request(app).post("/api/v1/orders").set(auth(b)).set("Idempotency-Key", "race-b").send(body),
    ]);
    expect([ra.status, rb.status].sort()).toEqual([201, 409]);
    const loser = ra.status === 409 ? ra : rb;
    expect(loser.body.error.code).toBe("ITEM_UNAVAILABLE");
    expect((await M.Product.findById(p._id)).stock).toBe(0);
  });
});

describe("Webhook security", () => {
  test("a webhook with an invalid signature or token is rejected with 401", async () => {
    const r = await request(app).post("/api/v1/webhooks/paymongo").set("Content-Type", "application/json").send("{}");
    expect(r.status).toBe(401); expect(r.body.error.code).toBe("INVALID_SIGNATURE");
  });
});

describe("AI assistant fallback", () => {
  test("when the AI provider fails, the API returns keyword results instead of an error", async () => {
    const token = await register("ai@t.test");
    await makeProduct({ name: "Zara Navy Hoodie", brand: "Zara" });
    const realFetch = global.fetch;
    global.fetch = jest.fn().mockRejectedValue(new Error("provider down"));
    try {
      const r = await request(app).post("/api/v1/ai/assistant").set(auth(token)).send({ text: "warm hoodie please" });
      expect(r.status).toBe(200);
      expect(r.body.data.source).toBe("keyword_fallback");
      expect(r.body.data.aiAssisted).toBe(false);
      expect(r.body.data.results.length).toBeGreaterThan(0);
    } finally { global.fetch = realFetch; }
  });
});

describe("Catalog", () => {
  test("unknown product id gives 404 and brand filter works", async () => {
    const miss = await request(app).get("/api/v1/products/" + new mongoose.Types.ObjectId());
    expect(miss.status).toBe(404);
    await makeProduct({ brand: "Carhartt", name: "Carhartt Test Jacket" });
    const r = await request(app).get("/api/v1/products?brand=Carhartt");
    expect(r.status).toBe(200); expect(r.body.data.every((x) => x.brand === "Carhartt")).toBe(true);
    const b = await request(app).get("/api/v1/brands");
    expect(b.body.data.some((x) => x.name === "Carhartt")).toBe(true);
  });
});
