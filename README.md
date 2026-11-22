# Thrift Store (ITPE101 Final Project)
React + Node/Express + MongoDB thrift marketplace with Maya sandbox payments and an AI shopping assistant.

## Prerequisites
Node.js 20+, a free MongoDB Atlas cluster, Maya sandbox keys (developers.maya.ph), optional Gemini API key.

## Install and run
```
cd backend
cp .env.example .env        # Windows: copy .env.example .env   then fill the values
npm install
npm install -D mongodb-memory-server   # needed for tests
npm run seed                # adds ~160 items, coupons, demo users (safe to re-run)
npm run dev                 # API on http://localhost:4000
```
```
cd frontend
cp .env.example .env        # VITE_API_URL=http://localhost:4000/api/v1
npm install
npm run dev                 # http://localhost:5173
```
Reset all data: `npm run reset` in `backend` (deletes everything, then reseed with `npm run seed`).

## Environment variables (backend/.env)
PORT, MONGO_URI, JWT_SECRET, FRONTEND_URL, PAYMENT_PROVIDER (maya | paymongo), MAYA_PUBLIC_KEY, MAYA_SECRET_KEY, MAYA_BASE_URL, MAYA_WEBHOOK_TOKEN, PUBLIC_API_URL, GEMINI_API_KEY, GEMINI_MODEL, AI_PROVIDER. Never commit `.env`.

## Tests
`cd backend && npm test` runs the Jest + Supertest integration tests. Postman: import `postman/collection.json` and `postman/environment.example.json`, run folders 1 to 7 in order (needs `npm run seed` first).

## API docs
Swagger UI: http://localhost:4000/api-docs (spec: `backend/openapi.yaml`). The API is versioned under `/api/v1`; breaking changes would be released as `/api/v2` while v1 stays available.

## Demo accounts (test only)
`admin@thrift.test`, `customer1@thrift.test`, `customer2@thrift.test`. Password `Password123!`. Coupons: WELCOME10, SAVE100.

## Payment sandbox flow
Checkout redirects to the Maya sandbox page; pay with a sandbox card from Maya's "Sandbox Credentials and Cards" page. The order becomes `paid` through the webhook, or press Admin -> Orders -> Reconcile if no webhook arrives. Webhook setup: run ngrok, set `PUBLIC_API_URL`, run `node registerMayaWebhook.js`.

## Deployment notes
Backend on Render (set all env vars, start command `npm start`), frontend on Vercel (`VITE_API_URL` = deployed API URL + /api/v1). Set `FRONTEND_URL` to the deployed frontend so CORS allows only that origin. In Atlas Network Access allow the host. Register the Maya webhook with the deployed API URL.

## Docs
See `docs/` for architecture, database, patterns, AI, payment, business rules, test plan, code review, and contributions.

## Deployed app

| Part | URL |
| --- | --- |
| Frontend (Vercel) | https://thrift-store-web-psi.vercel.app |
| API base (Render) | https://thrift-store-api-0dcb.onrender.com/api/v1 |
| API docs (Swagger UI) | https://thrift-store-api-0dcb.onrender.com/api-docs |

The API runs on a free Render instance. After 15 minutes without requests it sleeps, so the first request can take 30 to 60 seconds. Payments use the Maya sandbox only (no real money).
