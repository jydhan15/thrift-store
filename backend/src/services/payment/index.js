// Factory Method: callers never import a concrete provider
const PayMongoProvider = require("./PayMongoProvider");
const MayaProvider = require("./MayaProvider");
let cached;
module.exports = function getPaymentProvider() {
  if (cached) return cached;
  cached = (process.env.PAYMENT_PROVIDER === "maya") ? new MayaProvider() : new PayMongoProvider();
  return cached;
};
