# Payment integration (Maya Checkout Sandbox)
PayMongo sign-ups were paused, so the project uses the **Maya Checkout sandbox** (allowed by the guideline). The code also contains `PayMongoProvider`, selectable with `PAYMENT_PROVIDER=paymongo`.

- **Configuration:** `.env` keys `MAYA_PUBLIC_KEY`, `MAYA_SECRET_KEY`, `MAYA_BASE_URL=https://pg-sandbox.paymaya.com`, `MAYA_WEBHOOK_TOKEN`. The project uses Maya's **shared public sandbox keys**, which other users may also use. Never commit `.env`.
- **Flow:** backend creates the checkout session (`POST /checkout/v1/checkouts`, amount converted from centavos to pesos) and returns the redirect URL. The frontend redirects the buyer there; the return page is informational only.
- **Webhook:** `POST /api/v1/webhooks/maya?token=...` receives the raw body. It is checked with a secret token in the callback URL (compared in constant time). Maya sandbox webhooks are not HMAC-signed as far as this project could confirm, so the token is not the only defence: the order is **only marked paid after the API calls Maya to retrieve the checkout and checks status, amount, and currency**. A forged call cannot mark an order paid.
- **Event log and replay:** each event id is stored in `webhookevents` (unique). A replayed event returns `{duplicate:true}` and changes nothing.
- **Amount mismatch:** order is flagged `AMOUNT_MISMATCH`, not paid, and both values are logged.
- **Missed webhook recovery:** Admin -> Orders -> **Reconcile** calls Maya directly and applies the same checks. Unpaid orders expire after 15 minutes and stock is restored.
- **Webhook registration:** `node registerMayaWebhook.js` (needs a public URL such as ngrok in `PUBLIC_API_URL`). Shared sandbox keys can be overwritten by other users, which is why Reconcile exists.
- **Evidence to add:** screenshots of the Maya checkout page, the order turning `paid`, a replayed event, and a short screen recording.
