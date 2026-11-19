const jwt = require("jsonwebtoken");
const { AppError } = require("../utils/errors");
exports.auth = (req, res, next) => {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) return next(new AppError(401, "UNAUTHENTICATED", "Login required"));
  try { req.user = jwt.verify(h.slice(7), process.env.JWT_SECRET); next(); }
  catch { next(new AppError(401, "UNAUTHENTICATED", "Invalid or expired token")); }
};
exports.requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : next(new AppError(403, "FORBIDDEN", "Insufficient role"));
