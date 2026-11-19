
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");

const {
  requestId,
  notFound,
  errorHandler
} = require("./middleware/error");

const M = require("./controllers/miscController");

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(requestId);

// Webhook routes must be registered BEFORE express.json()
// because payment providers require the original RAW request body.

// Maya webhook
app.post(
  "/api/v1/webhooks/maya",
  express.raw({ type: "*/*" }),
  (req, res, next) => {
    req.headers["x-webhook-token"] = req.query.token || "";
    next();
  },
  M.webhook
);

// PayMongo webhook
app.post(
  "/api/v1/webhooks/paymongo",
  express.raw({ type: "*/*" }),
  async (req, res, next) => {
    try {
      await M.webhook(req, res, next);
    } catch (err) {
      next(err);
    }
  }
);

// JSON body parser
app.use(express.json({ limit: "20kb" }));

// API documentation
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(require("../docs/openapi.json"))
);

// API routes
app.use("/api/v1", require("./routes"));

// Error handling
app.use(notFound);
app.use(errorHandler);

module.exports = app;
