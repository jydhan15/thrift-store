const crypto = require("crypto");
const PaymentProvider = require("./PaymentProvider");
const { AppError } = require("../../utils/errors");
const BASE = "https://api.paymongo.com/v1";

class PayMongoProvider extends PaymentProvider {
  headers() {
    const token = Buffer.from(process.env.PAYMONGO_SECRET_KEY + ":").toString("base64");
    return { Authorization: "Basic " + token, "Content-Type": "application/json", accept: "application/json" };
  }
  async call(path, opts) {
    let res;
    try { res = await fetch(BASE + path, { ...opts, headers: this.headers(), signal: AbortSignal.timeout(10000) }); }
    catch { throw new AppError(502, "GATEWAY_UNAVAILABLE", "Payment gateway unreachable"); }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new AppError(502, "GATEWAY_ERROR", "Payment gateway rejected the request");
    return json.data;
  }
  async createCheckout(order) {
    const FRONT = process.env.FRONTEND_URL;
    const d = await this.call("/checkout_sessions", { method: "POST", body: JSON.stringify({ data: { attributes: {
      line_items: [{ currency: "PHP", amount: order.total, name: "Thrift order " + order._id, quantity: 1 }],
      payment_method_types: ["gcash", "card", "paymaya"],
      success_url: FRONT + "/orders/" + order._id + "?paid=1",
      cancel_url: FRONT + "/orders/" + order._id + "?cancelled=1",
      description: "Thrift order", reference_number: String(order._id),
    } } }) });
    return { id: d.id, url: d.attributes.checkout_url };
  }
  async retrieve(sessionId) {
    const d = await this.call("/checkout_sessions/" + sessionId, { method: "GET" });
    const pay = (d.attributes.payments || [])[0];
    if (!pay) return { paid: false };
    return { paid: pay.attributes.status === "paid", amount: pay.attributes.amount,
             currency: pay.attributes.currency, paymentId: pay.id };
  }
  verifyWebhook(rawBody, headers) {
    const sig = headers["paymongo-signature"]; if (!sig) return false;
    const p = Object.fromEntries(sig.split(",").map((s) => s.split("=")));
    const expected = crypto.createHmac("sha256", process.env.PAYMONGO_WEBHOOK_SECRET)
      .update(p.t + "." + rawBody.toString()).digest("hex");
    const given = p.te || p.li || "";
    return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  }
  parseEvent(rawBody) {
    const e = JSON.parse(rawBody.toString());
    const attr = e.data.attributes;
    return { eventId: e.data.id, type: attr.type, sessionId: attr.data && attr.data.id };
  }
}
module.exports = PayMongoProvider;
