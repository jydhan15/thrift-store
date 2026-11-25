process.env.PAYMONGO_WEBHOOK_SECRET = "whsk_test"; process.env.PAYMONGO_SECRET_KEY = "sk_test"; process.env.JWT_SECRET = "x";
const crypto = require("crypto");
const PayMongoProvider = require("../src/services/payment/PayMongoProvider");
const PaymentProvider = require("../src/services/payment/PaymentProvider");
const { canTransition } = require("../src/services/orderService");
const AIProvider = require("../src/services/ai/AIProvider");
const { AIServiceProxy } = require("../src/services/ai");

const sign = (body, t = "123") => "t=" + t + ",te=" + crypto.createHmac("sha256", "whsk_test").update(t + "." + body).digest("hex") + ",li=";
test("valid webhook signature accepted", () => { const b = Buffer.from("{}"); expect(new PayMongoProvider().verifyWebhook(b, { "paymongo-signature": sign("{}") })).toBe(true); });
test("tampered webhook signature rejected", () => { expect(new PayMongoProvider().verifyWebhook(Buffer.from("{\"x\":1}"), { "paymongo-signature": sign("{}") })).toBe(false); });
test("missing signature rejected", () => { expect(new PayMongoProvider().verifyWebhook(Buffer.from("{}"), {})).toBe(false); });
test("abstract PaymentProvider cannot be instantiated", () => { expect(() => new PaymentProvider()).toThrow(); });
test("abstract AIProvider cannot be instantiated", () => { expect(() => new AIProvider()).toThrow(); });
test("order state machine: legal and illegal", () => { expect(canTransition("pending_payment", "paid")).toBe(true); expect(canTransition("paid", "cancelled")).toBe(false); expect(canTransition("delivered", "paid")).toBe(false); });
// DB-backed integration tests live in api.test.js and business.test.js.
