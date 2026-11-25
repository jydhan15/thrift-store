# Test plan and results

Automated suite: `cd backend && npm test` (Jest + Supertest + **in-memory MongoDB**, no external services needed). Full raw terminal output is saved in `docs/test-results.txt`. Last run: **2026-11-25 - 3 suites, 32/32 tests passing**.

| ID | Test case | Expected | Actual | Date |
|---|---|---|---|---|
| A1 | Register, duplicate email, wrong password | 201 token / 409 EMAIL_TAKEN / 401 INVALID_CREDENTIALS | Pass (`api.test.js`) | 2026-11-25 |
| A2 | Admin route: no token / customer / admin | 401 / 403 / 200 | Pass (`api.test.js`) | 2026-11-25 |
| A2b | All 12 admin routes with no token and with customer token | 401 / 403 for every route | Pass (`business.test.js`) | 2026-11-25 |
| A3 | Checkout totals, coupon, client-sent total, idempotency | total = subtotal - discount + shipping; 422 on tamper; same key -> same order | Pass (`api.test.js`) | 2026-11-25 |
| A3b | Concurrent same-key checkout; key reused with different body | one order / 409 IDEMPOTENCY_CONFLICT | Pass (`business.test.js`) | 2026-11-25 |
| A4 | Two buyers, last unit | one 201, one 409 ITEM_UNAVAILABLE, stock 0 | Pass (`api.test.js`) | 2026-11-25 |
| A5 | Webhook with bad signature / malformed payload | 401 INVALID_SIGNATURE / 422 INVALID_PAYLOAD | Pass (`api.test.js`, `business.test.js`) | 2026-11-25 |
| A5b | Amount mismatch; replay; missed-webhook reconcile (incl. old session) | flag AMOUNT_MISMATCH, no paid transition; duplicate ignored; paid via reconcile | Pass (`business.test.js`) | 2026-11-25 |
| A6 | AI provider down | 200, source keyword_fallback | Pass (`api.test.js`) | 2026-11-25 |
| A7 | Unknown product, brand filter, invalid id or query operator | 404 / filtered list / 422 VALIDATION_ERROR | Pass (`api.test.js`, `business.test.js`) | 2026-11-25 |
| L3-1 | Offers: 50% floor, price ceiling, one open offer, admin decision, accepted price at checkout | 422 / 422 / 409 / 200 / subtotal uses offer amount | Pass (`business.test.js`) | 2026-11-25 |
| L3-2 | Cancel unpaid order releases stock; paid/cancelled rules | 200 + stock restored; 409 on repeat / retry | Pass (`business.test.js`) | 2026-11-25 |
| L2-7 | Retry: new session, expired re-reserve, attempt limit, failed webhook | 200 / 200 / 409 TOO_MANY_ATTEMPTS / stock released | Pass (`api.test.js`, 6 cases) | 2026-11-25 |
| S-6 | CORS with untrusted Origin; requestId in responses | 403 CORS_DENIED; requestId present | Pass (`business.test.js`) | 2026-11-25 |
| S-7 | Local dev origins: localhost, 127.0.0.1, LAN IP on any local port (incl. Vite 5174) | 200 with matching ACAO header; production origin still 403 | Pass (`business.test.js`) | 2026-11-25 |
| M1 | Postman collection, folders 1-7 | assertions pass | **43/43 requests, 77/77 assertions passed** against a seeded local API (`docs/postman-results.txt`) | 2026-11-25 |
| M2 | Real Maya sandbox payment, then Reconcile | order becomes paid | Manual demo item — not yet captured (see `docs/payment-integration.md`) | pending |
| M3 | Replay webhook | duplicate ignored | Pass (`api.test.js`, `business.test.js`); still record a live webhook log for the defense | 2026-11-25 |

## Automated test output (last run)
```
> thrift-api@1.0.0 test
> jest --runInBand

PASS tests/business.test.js (5.556 s)
PASS tests/api.test.js
PASS tests/core.test.js
Test Suites: 3 passed, 3 total
Tests:       32 passed, 32 total
Time:        10.511 s
```
Jest prints an expected `console.warn` for the deliberate AI-provider failure and AMOUNT_MISMATCH tests; those warnings are evidence that the fallback and flag paths ran.

## Manual test results and known limitations
- Postman: 7 folders, 43 requests, 77 assertions, 3 pre-request scripts. Full Newman output is saved at `docs/postman-results.txt`; last run 2026-11-25: 43/43 requests and 77/77 assertions passed against a seeded local API (in-memory MongoDB because the configured Atlas credentials returned `bad auth`). The retry test now asserts a new `gatewayRef`, an incremented `paymentAttempts`, and preservation of the old session in `previousRefs`.
- Shared Maya sandbox keys can be changed by other users, so webhook delivery may be unreliable; Reconcile covers this.
- AI cache is in memory and resets on restart.
- Admin item list shows the newest 50 items.
- Cards without an `imageUrl` show generated clothing illustrations (not emoji placeholders) so no broken images appear.
- Post-upgrade phone render: headless Edge at 390×844 against `npm run preview` mounted the app, rendered the hero and bottom tab bar, and did not trigger an error boundary (2026-11-25).
- Local smoke after the CORS/local-API fix: headless Edge at `http://localhost:5173/`, `http://localhost:5174/` and `http://localhost:4173/` each rendered **12 product cards** from the local API; `http://127.0.0.1:5173` and LAN origins return 200 while `https://evil.example` still returns 403. A duplicate registration through the browser-origin path returned the expected `409 EMAIL_TAKEN`. Restored sample accounts `Blaire@gmail.com` and `jydhan@gmail.com` in `backend/src/seed.js`; all three saved sample emails (`Blaire@gmail.com`, `admin@thrift.test`, `jydhan@gmail.com`) now log in with `Password123!` and return 200.
- The deployed Render API may sleep; the first request can take 30–60 seconds. The frontend has a 90-second timeout with a clear message. On 2026-11-25 the Vercel frontend responded `200` in ~0.9 s, but every Render probe failed: `curl` received zero bytes and timed out after 120 s, while an independent fetch reported **HTTP 503** for `/api/v1/categories`, `/api/v1/products?limit=1`, and `/api-docs/`. DNS resolves correctly. Treat the live API smoke test as **not verified** until the Render service is awake/healthy; the same endpoints pass locally (Postman run above). Check the Render dashboard/logs or redeploy, then rerun these probes.

## Dependency audit (S-13)
Date run: 2026-11-25
- `backend`: `npm audit` and `npm audit --omit=dev` -> **0 vulnerabilities**.
- `frontend`: after upgrading to Vite 8.3.8 and react-router-dom 7.18.7, `npm audit` -> **0 vulnerabilities**. Production build: `npm run build` passed (34 modules, ~71 KB gzipped JS).
