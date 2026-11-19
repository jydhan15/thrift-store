// Abstract base class
class PaymentProvider {
  constructor() { if (new.target === PaymentProvider) throw new Error("PaymentProvider is abstract"); }
  async createCheckout(order) { throw new Error("not implemented"); }
  async retrieve(sessionId) { throw new Error("not implemented"); }
  verifyWebhook(rawBody, headers) { throw new Error("not implemented"); }
  parseEvent(rawBody) { throw new Error("not implemented"); }
}
module.exports = PaymentProvider;