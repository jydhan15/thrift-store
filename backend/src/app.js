const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");

const { requestId, notFound, errorHandler } = require("./middleware/error");
const { AppError } = require("./utils/errors");
const M = require("./controllers/miscController");

const app = express();

// Behind Render/Vercel the TLS terminator is one hop away; without this,
// express-rate-limit sees the proxy IP and every user shares one bucket.
app.set("trust proxy", 1);
app.use(helmet());

// Fail closed: only the deployed frontend origin and explicit local dev
// origins may call the API with credentials. Supertest/server-to-server
// requests have no Origin and remain allowed.
const allowedOrigins = () => [
  ...(process.env.FRONTEND_URL || "").split(",").map((s) => s.trim()).filter(Boolean),
  "http://localhost:5173",
  "http://localhost:4173",
];
// Phones, VS Code preview and extra Vite servers use 127.0.0.1, LAN IPs, and
// ports other than 5173 (Vite increments when a port is busy). Any http origin
// on a local/private host is a dev machine; public production origins must
// still be listed explicitly in FRONTEND_URL.
const isLocalDevOrigin = (origin) => {
  try {
    const u = new URL(origin);
    if (u.protocol !== "http:") return false;
    const h = u.hostname.toLowerCase();
    return h === "localhost" || h === "127.0.0.1" || h === "::1" ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(h) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h) ||
      /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(h);
  } catch { return false; }
};
app.use(cors({
  origin: (origin, cb) => (!origin || allowedOrigins().includes(origin) || isLocalDevOrigin(origin)
    ? cb(null, true)
    : cb(new AppError(403, "CORS_DENIED", "Origin not allowed"))),
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key", "Paymongo-Signature"],
  maxAge: 600,
}));
app.use(requestId);

// Webhook routes are registered BEFORE express.json() because payment
// providers verify a signature over the original RAW request body.
app.post("/api/v1/webhooks/maya", express.raw({ type: "*/*" }), (req, res, next) => {
  req.headers["x-webhook-token"] = req.query.token || "";
  next();
}, M.webhook);

app.post("/api/v1/webhooks/paymongo", express.raw({ type: "*/*" }), M.webhook);

app.use(express.json({ limit: "20kb" }));

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(require("../docs/openapi.json")));
app.use("/api/v1", require("./routes"));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
