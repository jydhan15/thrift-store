const { retryPayment } = require("../services/retryService");

// POST /api/v1/orders/:id/pay -> new payment session for the customer's own order
exports.retry = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const order = await retryPayment(userId, req.params.id);
    res.json({ success: true, data: order });
  } catch (e) { next(e); }
};