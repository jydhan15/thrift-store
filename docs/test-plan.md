# Test plan and results
Run: `cd backend && npm test` (Jest + Supertest + in-memory MongoDB). Paste the real terminal output below after you run it.

| ID | Test case | Expected | Actual | Date |
|---|---|---|---|---|
| A1 | Register, duplicate email, wrong password | 201 token / 409 EMAIL_TAKEN / 401 INVALID_CREDENTIALS | (fill in) | |
| A2 | Admin route: no token / customer / admin | 401 / 403 / 200 | (fill in) | |
| A3 | Checkout totals, coupon, client-sent total, idempotency | total = subtotal - discount + shipping; 422 on tamper; same key -> same order | (fill in) | |
| A4 | Two buyers, last unit | one 201, one 409 ITEM_UNAVAILABLE, stock 0 | (fill in) | |
| A5 | Webhook with bad signature | 401 INVALID_SIGNATURE | (fill in) | |
| A6 | AI provider down | 200, source keyword_fallback | (fill in) | |
| A7 | Unknown product, brand filter | 404 / only that brand | (fill in) | |
| M1 | Postman collection, folders 1-7 | all assertions pass | (fill in) | |
| M2 | Real Maya sandbox payment, then Reconcile | order becomes paid | (fill in) | |
| M3 | Replay webhook | duplicate ignored | (fill in) | |

## Automated test output
(paste the `npm test` output here)

## Known limitations
- Shared Maya sandbox keys can be changed by other users, so webhook delivery may be unreliable; Reconcile covers this.
- AI cache is in memory and resets on restart.
- Admin item list shows the newest 50 items.
- Photos are emoji placeholders unless an imageUrl is set.

## Payment retry (L2-07)

Date run: 2026-11-21 | Command: `cd backend; npm test` | Result: 19 of 19 tests passing (2 suites)

| Case | Expected | Actual |
| --- | --- | --- |
| POST /api/v1/orders/:id/pay on a pending order | 200, NEW gateway session, old session saved in previousRefs, paymentAttempts +1 | Pass |
| Retry when paymentAttempts is already 5 | 409 TOO_MANY_ATTEMPTS | Pass |
| Failed-payment webhook, then replay of the same webhook | Stock released, replay returns duplicate: true, no second change | Pass |
| Retry after a failed payment | 200, order back to pending_payment, stock reserved again | Pass |

Known limitation: the retry endpoint is also covered in the Postman collection (folder: Orders), but the real Maya sandbox page is tested manually, not in automated tests.


## Dependency audit (S-13)

Date run: 2026-11-21 | Command: `cd backend; npm audit --omit=dev`

| Finding | Severity | Resolution |
| --- | --- | --- |
| zod < 4.6.6 (GHSA-mrhx-c7xc-m3w5, memory exhaustion on oversized collections) | High | Fixed by upgrading zod to 4.x. Test suite re-run: 19 of 19 passing. Audit re-run: 0 vulnerabilities. |
