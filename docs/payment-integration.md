# Payment integration (Maya Checkout Sandbox)
PayMongo sign-ups were paused, so the project uses the **Maya Checkout sandbox** (allowed by the guideline). The code also contains `PayMongoProvider`, selectable with `PAYMENT_PROVIDER=paymongo`.

- **Configuration:** `.env` keys `MAYA_PUBLIC_KEY`, `MAYA_SECRET_KEY`, `MAYA_BASE_URL=https://pg-sandbox.paymaya.com`, `MAYA_WEBHOOK_TOKEN`. Never commit `.env`.
- **Flow:** backend creates the checkout session (`POST /checkout/v1/checkouts`, amount converted from centavos to pesos) and returns the redirect URL. The frontend redirects the buyer there; the return page is informational only.
- **Webhook:** `POST /api/v1/webhooks/maya?token=...` receives the raw body. The secret token is compared in constant time. Maya sandbox webhooks are not HMAC-signed as far as this project could confirm, so the token is not the only defence: the order is **only marked paid after the API calls Maya to retrieve the checkout and checks status, amount, and currency**. A forged call cannot mark an order paid. Real Maya statuses `PAYMENT_SUCCESS`, `CHECKOUT_FAILURE`, `PAYMENT_FAILED` and `EXPIRED` are mapped to paid/failed events (`MayaProvider.parseEvent`).
- **Event log and replay:** each event id is stored in `webhookevents` (unique) **after** processing succeeds, so a gateway outage does not burn the event. A replayed event returns `{duplicate:true}` and changes nothing.
- **Amount/currency mismatch:** order is flagged `AMOUNT_MISMATCH` with a history entry, not paid; both values are logged. A missing currency is treated as a mismatch, never assumed to be PHP.
- **Missed webhook recovery:** Admin -> Orders -> **Reconcile** calls Maya directly and applies the same checks to the current session **and older sessions saved in `previousRefs`**. Unpaid orders expire after 15 minutes and stock is restored; a confirmed payment arriving after expiry re-reserves stock before marking the order paid.
- **Webhook registration:** `node registerMayaWebhook.js` (needs a public URL such as ngrok in `PUBLIC_API_URL`). Shared sandbox keys can be overwritten by other users, which is why Reconcile exists.

## Evidence (automated)
`cd backend && npm test` covers: invalid signature -> 401 (`api.test.js`); malformed payload -> 422, amount mismatch flags the order, replay -> `{duplicate:true}`, failed-payment webhook releases stock, Reconcile settles an older session, and real Maya event mapping (`business.test.js`). Raw output: `docs/test-results.txt`.

## Evidence (live demo — to capture before defense)
- [ ] Maya sandbox checkout page with a sandbox card.
- [ ] Order changing from `pending_payment` to `paid` after the webhook.
- [ ] Replayed webhook showing `{received:true, duplicate:true}` and unchanged order.
- [ ] Short screen recording of the above as backup (required by D-09).

## Retry payment (failed, expired, or abandoned payments)
- Endpoint: `POST /api/v1/orders/:id/pay` (customer token required, own orders only). Code: `backend/src/services/retryService.js`, `backend/src/controllers/retryController.js`.
- Every retry creates a NEW gateway checkout session for the SAME order. The provider gives each session a unique reference number, so sessions never collide.
- The old session id is pushed into `previousRefs`. If the customer pays an old session later, the webhook or reconciliation still finds the order, and it is verified (status, amount, currency) like any other payment.
- If the order was `payment_failed` or `expired`, its stock was already released, so the items are reserved again all-or-nothing, and the coupon is claimed again with the same usage-limit check as checkout. If the gateway call fails after that, stock and coupon are given back and the order returns to `payment_failed`.
- If the order is still `pending_payment`, only the 15-minute hold is extended.
- Limit: 5 payment attempts per order (`paymentAttempts`). A paid order is never reversed or retried.
