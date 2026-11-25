const crypto = require("crypto");
const { AppError } = require("../utils/errors");
exports.requestId = (req, res, next) => { req.id = crypto.randomUUID(); res.locals.requestId = req.id; next(); };
exports.notFound = (req, res, next) => next(new AppError(404, "NOT_FOUND", "Route not found"));
exports.errorHandler = (err, req, res, next) => {
  let status = err.status || 500, code = err.code || "INTERNAL_ERROR", message = err.message;
  if (err.code === 11000) { status = 409; code = "DUPLICATE"; message = "Duplicate value"; }
  if (err.name === "CastError") { status = 404; code = "NOT_FOUND"; message = "Resource not found"; }
  if (status === 500) { console.error(err); message = "Unexpected server error"; code = "INTERNAL_ERROR"; }
  res.status(status).json({ success: false, error: { code, message, details: err.details }, requestId: req.id });
};
