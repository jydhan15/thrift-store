const crypto = require("crypto");
const PaymentProvider = require("./PaymentProvider");
const { AppError } = require("../../utils/errors");

const BASE = () => process.env.MAYA_BASE_URL || "https://pg-sandbox.paymaya.com";
const basic = (key) => "Basic " + Buffer.from(key + ":").toString("base64");
const FAILURES = ["CHECKOUT_FAILURE", "PAYMENT_FAILED", "PAYMENT_FAILURE", "EXPIRED", "CANCELLED", "CANCELED", "FAILED"];

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
    // unique per session, so a retry for the same order never reuses a reference
    const ref = String(order._id) + "-" + Date.now().toString(36);
    const d = await this.call("/checkout/v1/checkouts", {
      method: "POST", key: process.env.MAYA_PUBLIC_KEY,
      body: {
        totalAmount: { value: peso, currency: "PHP" },
        items: [{ name: "Thrift order " + String(order._id).slice(-6), quantity: 1, amount: { value: peso }, totalAmount: { value: peso } }],
        redirectUrl: { success: FRONT + "/orders?paid=1", failure: FRONT + "/orders?failed=1", cancel: FRONT + "/orders?cancelled=1" },
        requestReferenceNumber: ref,
      },
    });
    return { id: d.checkoutId, url: d.redirectUrl };
  }

  async retrieve(checkoutId) {
    const d = await this.call("/checkout/v1/checkouts/" + checkoutId, { key: process.env.MAYA_SECRET_KEY });
    const status = String(d.paymentStatus || d.status || "").toUpperCase();
    if (status !== "PAYMENT_SUCCESS") return { paid: false };
    const value = d.totalAmount && (d.totalAmount.value ?? d.totalAmount.amount);
    if (!Number.isFinite(Number(value))) return { paid: false };
    return {
      paid: true,
      amount: Math.round(Number(value) * 100),
      // Do not default the currency: a missing currency must be treated as a mismatch.
      currency: (d.totalAmount && d.totalAmount.currency) || null,
      paymentId: d.transactionReferenceNumber || d.receiptNumber || checkoutId,
    };
  }

  // Maya sandbox callback URL carries a secret token. Payment is ALSO verified
  // by calling Maya's API in paymentService, so a fake call cannot mark it paid.
  verifyWebhook(rawBody, headers) {
    const given = String(headers["x-webhook-token"] || ""), exp = String(process.env.MAYA_WEBHOOK_TOKEN || "");
    return exp.length > 0 && given.length === exp.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(exp));
  }

  parseEvent(rawBody) {
    let e;
    try { e = JSON.parse(rawBody.toString()); }
    catch { throw new AppError(422, "INVALID_PAYLOAD", "Malformed webhook payload"); }
    if (!e || !e.id) throw new AppError(422, "INVALID_PAYLOAD", "Webhook has no checkout id");
    const status = String(e.paymentStatus || e.status || "UNKNOWN").toUpperCase();
    const type = status === "PAYMENT_SUCCESS" ? "checkout_session.payment.paid"
      : FAILURES.includes(status) ? "checkout_session.payment.failed"
      : "maya." + status; // unknown types are acknowledged and ignored safely
    return { eventId: e.id + ":" + status, type, sessionId: e.id };
  }
}
module.exports = MayaProvider;
