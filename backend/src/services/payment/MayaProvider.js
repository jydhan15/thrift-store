const crypto = require("crypto");
const PaymentProvider = require("./PaymentProvider");
const { AppError } = require("../../utils/errors");

const BASE = () => process.env.MAYA_BASE_URL || "https://pg-sandbox.paymaya.com";
const basic = (key) => "Basic " + Buffer.from(key + ":").toString("base64");

class MayaProvider extends PaymentProvider {
  async call(path, { method = "GET", body, key }) {
    let res;
    try {
      res = await fetch(BASE() + path, {
        method, signal: AbortSignal.timeout(10000),
        headers: { "Content-Type": "application/json", Authorization: basic(key) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch { throw new AppError(502, "GATEWAY_UNAVAILABLE", "Payment gateway unreachable"); }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("MAYA ERROR", res.status, JSON.stringify(json));
      throw new AppError(502, "GATEWAY_ERROR", "Payment gateway rejected the request");
    }
    return json;
  }

  async createCheckout(order) {
    const FRONT = process.env.FRONTEND_URL;
    const peso = Number((order.total / 100).toFixed(2)); // Maya uses pesos, not centavos
    const d = await this.call("/checkout/v1/checkouts", { method: "POST", key: process.env.MAYA_PUBLIC_KEY, body: {
      totalAmount: { value: peso, currency: "PHP" },
      items: [{ name: "Thrift order " + String(order._id).slice(-6), quantity: 1, amount: { value: peso }, totalAmount: { value: peso } }],
      redirectUrl: { success: FRONT + "/orders?paid=1", failure: FRONT + "/orders?failed=1", cancel: FRONT + "/orders?cancelled=1" },
      requestReferenceNumber: String(order._id),
    } });
    return { id: d.checkoutId, url: d.redirectUrl };
  }

  async retrieve(checkoutId) {
    const d = await this.call("/checkout/v1/checkouts/" + checkoutId, { key: process.env.MAYA_SECRET_KEY });
    const paid = d.paymentStatus === "PAYMENT_SUCCESS" || d.status === "PAYMENT_SUCCESS";
    if (!paid) return { paid: false };
    const value = d.totalAmount && (d.totalAmount.value ?? d.totalAmount.amount);
    return { paid: true, amount: Math.round(Number(value) * 100), currency: (d.totalAmount && d.totalAmount.currency) || "PHP",
             paymentId: d.transactionReferenceNumber || d.receiptNumber || checkoutId };
  }

  // Maya webhook: callback URL carries a secret token. Payment is ALSO verified by calling Maya's API
  // in paymentService, so a fake call cannot mark an order paid.
  verifyWebhook(rawBody, headers) {
    const given = String(headers["x-webhook-token"] || ""), exp = String(process.env.MAYA_WEBHOOK_TOKEN || "");
    return exp.length > 0 && given.length === exp.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(exp));
  }

  parseEvent(rawBody) {
    const e = JSON.parse(rawBody.toString());
    const status = e.paymentStatus || e.status || "UNKNOWN";
    return { eventId: e.id + ":" + status,
             type: status === "PAYMENT_SUCCESS" ? "checkout_session.payment.paid" : "maya." + status, sessionId: e.id };
  }
}
module.exports = MayaProvider;