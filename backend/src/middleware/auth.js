const jwt = require("jsonwebtoken");
const { User } = require("../models");
const { AppError } = require("../utils/errors");

exports.auth = (req, res, next) => {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) return next(new AppError(401, "UNAUTHENTICATED", "Login required"));
  if (!process.env.JWT_SECRET) return next(new AppError(500, "CONFIG_ERROR", "Server is misconfigured"));
  try {
    const payload = jwt.verify(h.slice(7), process.env.JWT_SECRET, { algorithms: ["HS256"] });
    if (!payload || !payload.id) throw new Error("invalid payload");
    req.user = payload;
    next();
  } catch {
    next(new AppError(401, "UNAUTHENTICATED", "Invalid or expired token"));
  }
};

// Role is re-read from the database, not trusted from a day-old token, so a
// demotion takes effect immediately. Every admin route uses this middleware.
exports.requireRole = (...roles) => async (req, res, next) => {
  try {
    const u = await User.findById(req.user.id).select("role").lean();
    if (!u) return next(new AppError(401, "UNAUTHENTICATED", "Account no longer exists"));
    if (!roles.includes(u.role)) return next(new AppError(403, "FORBIDDEN", "Insufficient role"));
    req.user.role = u.role;
    next();
  } catch (e) {
    next(e);
  }
};
