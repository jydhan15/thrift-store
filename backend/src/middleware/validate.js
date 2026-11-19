const { AppError } = require("../utils/errors");
module.exports = (schema, where = "body") => (req, res, next) => {
  const r = schema.strict().safeParse(req[where]);
  if (!r.success) return next(new AppError(422, "VALIDATION_ERROR", "Invalid input", r.error.flatten().fieldErrors));
  req[where] = r.data; next();
};
