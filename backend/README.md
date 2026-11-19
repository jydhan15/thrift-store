# Thrift Store API
## Run
1. `cp .env.example .env` and fill values (MongoDB Atlas URI, PayMongo test keys, Gemini key)
2. `npm install`
3. `npm run seed`  (admin@thrift.test / Password123!)  |  `npm run reset` to wipe + reseed
4. `npm run dev` -> http://localhost:4000/api-docs
5. `npm test`
## PayMongo webhook
Dashboard (test mode) -> Developers -> Webhooks -> URL `https://<ngrok-or-host>/api/v1/webhooks/paymongo`, event `checkout_session.payment.paid`. Copy the whsk_ secret into .env.
## Patterns
MVC (routes/controllers/services/models), Singleton (config/db.js), Factory (services/payment/index.js, services/ai/index.js), Facade (paymentService), Proxy (AIServiceProxy).
## Versioning
All routes under /api/v1; breaking changes ship as /api/v2 while v1 stays live.
