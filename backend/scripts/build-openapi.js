// Enriches the hand-maintained openapi.yaml skeleton with shared schemas,
// parameters, request bodies, examples and correct status codes, then writes
// both openapi.yaml and docs/openapi.json (the file Swagger UI actually serves).
// Run: npm run docs:openapi
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const root = path.join(__dirname, "..");
const yamlPath = path.join(root, "openapi.yaml");
const jsonPath = path.join(root, "docs", "openapi.json");
const spec = yaml.load(fs.readFileSync(yamlPath, "utf8"));

const obj = (properties, required = []) => ({
  type: "object", properties, ...(required.length ? { required } : {}),
});
const str = (maxLength) => ({ type: "string", ...(maxLength ? { maxLength } : {}) });
const int = (minimum = 0) => ({ type: "integer", minimum });

spec.components.schemas = {
  ...(spec.components.schemas || {}),
  Success: obj({
    success: { type: "boolean", enum: [true] },
    data: { description: "Endpoint-specific payload" },
    meta: { type: "object", description: "Pagination metadata: total, page, limit" },
    requestId: str(64),
  }, ["success", "data"]),
  Error: obj({
    success: { type: "boolean", enum: [false] },
    error: obj({
      code: str(60), message: str(200),
      details: { oneOf: [{ type: "object" }, { type: "null" }] },
    }, ["code", "message"]),
    requestId: str(64),
  }, ["success", "error", "requestId"]),
  RegisterRequest: obj({ name: str(80), email: { type: "string", format: "email" }, password: str(100) }, ["name", "email", "password"]),
  LoginRequest: obj({ email: { type: "string", format: "email" }, password: str(100) }, ["email", "password"]),
  OfferRequest: obj({ amount: int(1) }, ["amount"]),
  CartAddRequest: obj({ productId: str(24), qty: int(1) }, ["productId"]),
  CheckoutRequest: obj({
    couponCode: str(30),
    shippingInfo: obj({ fullName: str(80), address: str(200), phone: str(20) }, ["fullName", "address", "phone"]),
  }, ["shippingInfo"]),
  ProductRequest: obj({
    name: str(120), brand: str(40), description: str(2000), price: int(0), stock: int(0),
    category: str(24), condition: { type: "string", enum: ["like_new", "good", "fair", "worn"] },
    size: str(20), imageUrl: { type: "string", format: "uri" }, status: { type: "string", enum: ["active", "inactive"] },
  }, ["name", "price"]),
  StockRequest: obj({ stock: int(0), reason: str(200) }, ["stock", "reason"]),
  StatusRequest: obj({ status: { type: "string", enum: ["processing", "shipped", "delivered"] } }, ["status"]),
  OfferDecisionRequest: obj({ decision: { type: "string", enum: ["accepted", "rejected"] } }, ["decision"]),
  CouponRequest: obj({
    code: str(30), type: { type: "string", enum: ["percent", "fixed"] }, value: int(1),
    minSpend: int(0), expiresAt: { type: "string", format: "date-time" }, usageLimit: int(0), perUserLimit: int(1),
  }, ["code", "type", "value"]),
  AIRequest: obj({ text: str(300) }, ["text"]),
  WebhookEvent: obj({
    eventId: str(120), type: str(80), sessionId: str(120),
    paymentStatus: str(40),
  }, ["eventId"]),
};

const param = (name, where, schema, description, required = false) => ({ name, in: where, required, description, schema });
const idParam = (name) => param(name, "path", { type: "string", pattern: "^[0-9a-fA-F]{24}$" }, "24-character Mongo ObjectId", true);
const page = [param("page", "query", { type: "integer", minimum: 1, default: 1 }, "Page number"),
  param("limit", "query", { type: "integer", minimum: 1, maximum: 50, default: 10 }, "Items per page (max 50)")];

const queryParams = {
  "GET /products": [
    param("q", "query", str(120), "Case-insensitive name search"),
    idParam("category"), param("brand", "query", str(40), "Exact brand"),
    param("condition", "query", { type: "string", enum: ["like_new", "good", "fair", "worn"] }, "Condition grade"),
    param("minPrice", "query", int(0), "Minimum price in centavos"),
    param("maxPrice", "query", int(0), "Maximum price in centavos"),
    param("sort", "query", { type: "string", enum: ["newest", "price_asc", "price_desc"] }, "Whitelisted sort"),
    ...page,
  ],
  "GET /brands": [idParam("category")],
  "GET /orders": page,
  "GET /admin/orders": [param("status", "query", { type: "string", enum: ["pending_payment", "paid", "processing", "shipped", "delivered", "cancelled", "expired", "payment_failed"] }, "Order status"),
    param("from", "query", { type: "string", format: "date-time" }, "Created at >= from"),
    param("to", "query", { type: "string", format: "date-time" }, "Created at <= to"), ...page],
};

const pathIds = {
  "GET /products/{id}": "id", "POST /products/{id}/offers": "id",
  "DELETE /cart/items/{productId}": "productId",
  "GET /orders/{id}": "id", "POST /orders/{id}/cancel": "id", "POST /orders/{id}/pay": "id",
  "PATCH /admin/products/{id}": "id", "DELETE /admin/products/{id}": "id",
  "PATCH /admin/products/{id}/stock": "id", "PATCH /admin/orders/{id}/status": "id",
  "POST /admin/orders/{id}/reconcile": "id", "PATCH /admin/offers/{id}": "id",
};

const bodies = {
  "POST /auth/register": ["RegisterRequest", { name: "Ana", email: "ana@example.com", password: "Password123!" }],
  "POST /auth/login": ["LoginRequest", { email: "ana@example.com", password: "Password123!" }],
  "POST /products/{id}/offers": ["OfferRequest", { amount: 650000 }],
  "POST /cart/items": ["CartAddRequest", { productId: "665f0f2c9d1b4a0012345678", qty: 1 }],
  "POST /orders": ["CheckoutRequest", { couponCode: "WELCOME10", shippingInfo: { fullName: "Ana Reyes", address: "12 Maple St", phone: "09171234567" } }],
  "POST /ai/assistant": ["AIRequest", { text: "warm jacket under 1000 pesos" }],
  "POST /admin/products": ["ProductRequest", { name: "Washed Denim Jacket", price: 65000, stock: 1, condition: "good", brand: "Levi's", size: "M" }],
  "PATCH /admin/products/{id}": ["ProductRequest", { name: "Washed Denim Jacket", price: 60000 }],
  "PATCH /admin/products/{id}/stock": ["StockRequest", { stock: 0, reason: "item sold at counter" }],
  "PATCH /admin/orders/{id}/status": ["StatusRequest", { status: "processing" }],
  "PATCH /admin/offers/{id}": ["OfferDecisionRequest", { decision: "accepted" }],
  "POST /admin/coupons": ["CouponRequest", { code: "WELCOME10", type: "percent", value: 10, minSpend: 0, usageLimit: 100 }],
};

const successCode = {
  "POST /auth/register": "201", "POST /products/{id}/offers": "201", "POST /cart/items": "201",
  "POST /orders": "201", "POST /admin/products": "201", "POST /admin/coupons": "201",
  "DELETE /admin/products/{id}": "204",
};

const publicOps = new Set(["POST /auth/register", "POST /auth/login", "GET /categories", "GET /brands", "GET /products", "GET /products/{id}"]);
const isWebhook = (p) => p.startsWith("/webhooks/");

const errorExample = (code, message) => ({
  description: message,
  content: { "application/json": {
    schema: { $ref: "#/components/schemas/Error" },
    example: { success: false, error: { code, message, details: null }, requestId: "1f0c2f2a-9b3e-4a7d-8c11-5e2a4b6d0f11" },
  } },
});
const successExample = (example) => ({
  description: "Success — { success:true, data, meta?, requestId }",
  content: { "application/json": {
    schema: { $ref: "#/components/schemas/Success" },
    example: { success: true, data: example, meta: { total: 1, page: 1, limit: 10 }, requestId: "1f0c2f2a-9b3e-4a7d-8c11-5e2a4b6d0f11" },
  } },
});

for (const [p, item] of Object.entries(spec.paths)) {
  for (const [m, op] of Object.entries(item)) {
    const key = m.toUpperCase() + " " + p;
    const parameters = [];
    if (queryParams[key]) parameters.push(...queryParams[key]);
    if (pathIds[key]) parameters.push(idParam(pathIds[key]));
    if (key === "POST /orders") parameters.push(param("Idempotency-Key", "header", str(100), "Client-generated key; replay returns the same order", true));
    if (isWebhook(p) && p.endsWith("maya")) parameters.push(param("token", "query", str(120), "MAYA_WEBHOOK_TOKEN (constant-time compared)", true));
    if (parameters.length) op.parameters = parameters; else delete op.parameters;

    if (!publicOps.has(key) && !isWebhook(p)) op.security = [{ bearer: [] }];

    if (bodies[key]) {
      const [schemaName, example] = bodies[key];
      op.requestBody = {
        required: true,
        content: { "application/json": {
          schema: { $ref: "#/components/schemas/" + schemaName },
          example,
        } },
      };
    }
    if (isWebhook(p)) {
      op.requestBody = {
        required: true,
        description: "Raw request body; the gateway signature/token is verified over these exact bytes.",
        content: { "application/json": {
          schema: { $ref: "#/components/schemas/WebhookEvent" },
          example: { eventId: "evt_123", type: "checkout_session.payment.paid", sessionId: "cs_abc", paymentStatus: "PAYMENT_SUCCESS" },
        } },
      };
    }

    const responses = op.responses || {};
    const okCode = successCode[key] || "200";
    for (const code of Object.keys(responses)) if (/^2\d\d$/.test(code)) delete responses[code];
    responses[okCode] = okCode === "204"
      ? { description: "Deleted — no body" }
      : successExample({ _id: "665f0f2c9d1b4a0012345678", status: "pending_payment" });

    for (const [code, message] of Object.entries({
      "401": "Unauthenticated — missing, expired or tampered token",
      "403": "Forbidden — wrong role or origin",
      "404": "Resource not found",
      "409": "Conflict — duplicate, illegal state or stock taken",
      "422": "Validation failure with field-level details",
      "429": "Rate limited",
      "500": "Unexpected error — generic message plus requestId",
    })) {
      if (code === "401" && publicOps.has(key)) continue;
      if (code === "403" && publicOps.has(key)) continue;
      responses[code] = errorExample(code, message);
    }
    op.responses = responses;
  }
}

fs.writeFileSync(jsonPath, JSON.stringify(spec, null, 2) + "\n");
fs.writeFileSync(yamlPath, yaml.dump(spec, { noRefs: true, lineWidth: 120 }));
console.log("Wrote", path.relative(root, yamlPath), "and", path.relative(root, jsonPath));
