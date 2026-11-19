const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const { User } = require("../models");
const { AppError } = require("../utils/errors");
const { ok, wrap } = require("../utils/helpers");

exports.registerSchema = z.object({ name: z.string().min(2).max(80), email: z.string().email(), password: z.string().min(8).max(100) });
exports.loginSchema = z.object({ email: z.string().email(), password: z.string() });
const sign = (u) => jwt.sign({ id: u._id, role: u.role }, process.env.JWT_SECRET, { expiresIn: "1d" });

exports.register = wrap(async (req, res) => {
  const { name, email, password } = req.body;
  if (await User.exists({ email: email.toLowerCase() })) throw new AppError(409, "EMAIL_TAKEN", "Email already registered");
  const u = await User.create({ name, email, password: await bcrypt.hash(password, 10) });
  ok(res, { token: sign(u), user: { id: u._id, name: u.name, role: u.role } }, null, 201);
});
exports.login = wrap(async (req, res) => {
  const u = await User.findOne({ email: req.body.email.toLowerCase() });
  if (!u || !(await bcrypt.compare(req.body.password, u.password))) throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  ok(res, { token: sign(u), user: { id: u._id, name: u.name, role: u.role } });
});
