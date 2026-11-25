const { z } = require("zod");
const { AppError } = require("../utils/errors");

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");
const num = z.string().regex(/^\d+(\.\d+)?$/, "Invalid number");

exports.idParam = z.object({ id: objectId });
exports.productIdParam = z.object({ productId: objectId });

// Whitelisted query fields: no arbitrary Mongo operators can reach a query.
exports.listQuery = z.object({
  page: num.optional(),
  limit: num.optional(),
  q: z.string().max(120).optional(),
  category: objectId.optional(),
  condition: z.enum(["like_new", "good", "fair", "worn"]).optional(),
  brand: z.string().max(40).optional(),
  minPrice: num.optional(),
  maxPrice: num.optional(),
  sort: z.enum(["price_asc", "price_desc", "newest"]).optional(),
}).strict();

exports.adminOrderQuery = z.object({
  page: num.optional(),
  limit: num.optional(),
  status: z.enum(["pending_payment", "paid", "processing", "shipped", "delivered", "cancelled", "expired", "payment_failed"]).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
}).strict();

// Keeps req.query plain (Express 4) while returning a documented 422 on bad input.
exports.validateQuery = (schema) => (req, res, next) => {
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return next(new AppError(422, "VALIDATION_ERROR", "Invalid query", parsed.error.flatten().fieldErrors));
  req.query = parsed.data;
  next();
};
