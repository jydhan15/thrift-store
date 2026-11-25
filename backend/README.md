# Thrift&Co API

## Run
1. `copy .env.example .env` and fill the values (MongoDB Atlas URI, Maya sandbox keys, Gemini key, `FRONTEND_URL`, `JWT_SECRET`).
2. `npm install`
3. `npm run seed` (admin@thrift.test / Password123!) — `npm run reset` wipes and reseeds.
4. `npm run dev` -> http://localhost:4000/api-docs
5. `npm test` (Jest + Supertest + in-memory MongoDB, 32 integration tests).

Set `PAYMENT_PROVIDER=maya` (deployed) or `paymongo` (alternative implementation). Set `AI_PROVIDER=gemini` (deployed) or `openai`.

## Webhook
- Maya sandbox: register `https://<public-host>/api/v1/webhooks/maya?token=<MAYA_WEBHOOK_TOKEN>` with `node registerMayaWebhook.js` (needs `PUBLIC_API_URL`).
- PayMongo test mode (if selected): `https://<ngrok-or-host>/api/v1/webhooks/paymongo`, event `checkout_session.payment.paid`; put the `whsk_` secret in `.env`.
- The raw request body is used for verification. Event ids are stored **after** successful processing so a gateway outage can be retried; replays are ignored.

## Patterns
MVC (routes/controllers/services/models), Singleton (`config/db.js`), Factory (`services/payment/index.js`, `services/ai/index.js`), Facade (`paymentService`), Proxy (`AIServiceProxy`). See `../docs/design-patterns-oop.md`.

## Versioning
All routes under `/api/v1`; breaking changes ship as `/api/v2` while v1 stays live.
