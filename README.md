# Thrift Store (ITPE101 Final Project)

**Thrift&Co** — a mobile-first marketplace for one-of-a-kind pre-loved fashion. React + Node/Express + MongoDB, Maya sandbox payments, and an AI shopping assistant.

## Prerequisites
Node.js 20.19+ or 22.12+ (Vite 8), a free MongoDB Atlas cluster, Maya sandbox keys (developers.maya.ph), optional Gemini API key.

## Install and run
```
cd backend
cp .env.example .env        # Windows: copy .env.example .env   then fill the values
npm install                 # includes mongodb-memory-server for tests
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

To check the production bundle locally: `cd frontend && npm run build && npm run preview`.

To test on a real phone, run `npm run dev` (it now binds to your LAN) and open `http://<your-computer-ip>:5173`. Set `VITE_API_URL` in `frontend/.env` to `http://<your-computer-ip>:4000/api/v1` — `localhost` on a phone points to the phone itself. `localhost`, `127.0.0.1`, and LAN IP origins on any local port are allowed by the API CORS rule; public origins must be listed in `FRONTEND_URL`.

## Frontend notes
- The UI is **mobile-first**: a bottom tab bar, 44px+ touch targets, safe-area padding, thumb-friendly filters, and a sticky add-to-cart bar on product pages. It scales up to a roomier tablet/desktop layout instead of being a stretched phone view.
- All styling lives in `frontend/src/style.css`; `mobile.css` only holds small polish rules. Keep new layout rules in the base file.
- `VITE_API_URL` is baked into the bundle at **build time**. Set it in Vercel before deploying, then rebuild.
- The app never assumes a local API in production: a production build without `VITE_API_URL` falls back to the deployed Render URL listed below.
- Images use the real photo when present and a generated clothing illustration otherwise, so cards never show broken images.

## Tests
`cd backend && npm test` runs 32 Jest + Supertest integration tests against an in-memory MongoDB (last run: 3 suites, 32/32 passing; raw output in `docs/test-results.txt`). Postman: import `postman/collection.json` (43 requests, 77 assertions) and `postman/environment.example.json`, run folders 1 to 7 in order (needs `npm run seed` first). See `docs/test-plan.md` for expected vs actual results.

## API docs
Swagger UI: http://localhost:4000/api-docs. `backend/openapi.yaml` is the editable contract; `npm run docs:openapi` regenerates it and `backend/docs/openapi.json` (the file the UI serves) together. The API is versioned under `/api/v1`; breaking changes would be released as `/api/v2` while v1 stays available.

## Demo accounts (test only)
`admin@thrift.test`, `customer1@thrift.test`, `customer2@thrift.test`, `Blaire@gmail.com`, `jydhan@gmail.com`. Password `Password123!`. Coupons: WELCOME10, SAVE100.

## Payment sandbox flow
Checkout redirects to the Maya sandbox page; pay with a sandbox card from Maya's "Sandbox Credentials and Cards" page. The order becomes `paid` through the webhook, or press Admin -> Orders -> Reconcile if no webhook arrives. Webhook setup: run ngrok, set `PUBLIC_API_URL`, run `node registerMayaWebhook.js`.

## Deployment notes
1. **Backend (Render):** set every variable from `backend/.env.example`, start command `npm start`. Set `FRONTEND_URL` to the deployed frontend origin so CORS allows only that site. In Atlas Network Access allow the Render host.
2. **Webhook:** register the Maya webhook with the deployed API URL (`PUBLIC_API_URL`) and keep `MAYA_WEBHOOK_TOKEN` identical on both sides.
3. **Frontend (Vercel):** Framework Preset `Vite`, Build Command `npm run build`, Output Directory `dist`. Set `VITE_API_URL` to the deployed API base **before** building, e.g. `https://thrift-store-api-0dcb.onrender.com/api/v1`. `vercel.json` already rewrites unknown paths to `index.html` for React Router.
4. **Smoke test after deploy:** open the site on a phone, search, open an item, add to cart, log in, and place a sandbox order. The free Render instance sleeps after ~15 minutes, so the first request can take 30–60 seconds; the frontend shows a clear timeout message if that happens.

## Docs
See `docs/` for architecture, database, patterns, AI, payment, business rules, test plan, code review, and contributions.

## Deployed app

| Part | URL |
| --- | --- |
| Frontend (Vercel) | https://thrift-store-web-psi.vercel.app |
| API base (Render) | https://thrift-store-api-0dcb.onrender.com/api/v1 |
| API docs (Swagger UI) | https://thrift-store-api-0dcb.onrender.com/api-docs |

Payments use the Maya sandbox only (no real money).
