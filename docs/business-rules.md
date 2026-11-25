# Business rules (Level 3 — Thrift store)

## Concept statement

**Thrift&Co** sells secondhand clothing where **every listing is a unique item**, not a reusable SKU with unlimited quantity. The catalog is therefore modeled around one-off pieces with a condition grade, a single-unit stock default, a visible reservation countdown at checkout, and a buyer offer workflow. A generic store template would treat these as cosmetic labels; here they change the data model, server rules, API contract, and both the customer and administrator workflows.

- **Customer:** browses one-off pieces, checks the condition grade, can name a price, and must pay within a 15-minute reservation window.
- **Administrator:** manages condition grades, stock (sold/restocked), coupons, and offer decisions.
- **Why custom rules are needed:** two buyers must never take the same physical item; a lower offer must not silently override the asking price; and an unpaid order must not hold an item forever.

---

## Feature 1 — Unique-item inventory with reservation countdown

| Aspect | Implementation |
|---|---|
| Data model | `Product.stock` defaults to `1` and has `min: 0`; `Product.condition` is an enum `like_new / good / fair / worn`; `Order.expiresAt` records the reservation deadline (`backend/src/models/index.js`, lines 13–25 and 45–63). |
| API | `POST /api/v1/orders` reserves stock; `GET /api/v1/orders` exposes `expiresAt`; `POST /api/v1/orders/:id/cancel` releases it; `POST /api/v1/orders/:id/pay` re-reserves after failure/expiry. |
| Server rule | `reserve()` in `backend/src/services/inventoryService.js` uses a conditional atomic update `{ status: "active", stock: { $gte: qty } }` with `$inc: { stock: -qty }`. If the update matches nothing, the item was already taken and the request fails with **409 `ITEM_UNAVAILABLE`**. `reserveAll()` rolls back every earlier reservation if a later item fails. |
| Reservation window | 15 minutes (`RESERVE_MINUTES` in `backend/src/services/checkoutService.js`). Failed/cancelled/expired payments release stock through `releaseOrder()`; the retry path reserves again with the same atomic rule. |
| UI path | Product detail shows the condition tag and explanation; the mobile sticky bar adds the one-off item to the cart; `Orders` shows a live `⏳ m:ss left to pay` countdown with Pay/Cancel actions. |
| Error when violated | `409 ITEM_UNAVAILABLE` (item taken / no stock), `409 CANNOT_CANCEL` (paid order), `409 ALREADY_PAID` (retry on paid order). |
| Test | `backend/tests/api.test.js` — "two buyers race for the last unit: exactly one succeeds" (expects `[201, 409]` and final stock `0`); `backend/tests/business.test.js` — cancellation releases stock; `api.test.js` retry/expiry tests verify release and re-reservation. |

**Without this rule:** two customers could check out the same physical jacket, and abandoned carts would keep stock locked forever.

---

## Feature 2 — Buyer offer workflow with accepted-price override

| Aspect | Implementation |
|---|---|
| Data model | `Offer { product, buyer, amount, status: pending/accepted/rejected/used }` with indexes on product and buyer (`backend/src/models/index.js`, lines 69–75). |
| API | `POST /api/v1/products/:id/offers` (customer), `GET /api/v1/offers/mine`, `GET /api/v1/admin/offers`, `PATCH /api/v1/admin/offers/:id`. |
| Server rule | `backend/src/controllers/offerController.js`: the item must be active and in stock (**404 `NOT_FOUND`**); an offer at or above the listed price is rejected (**422 `OFFER_NOT_BELOW_PRICE`**); an offer below 50% of the listed price is rejected (**422 `OFFER_TOO_LOW`**); a buyer may have only one pending or accepted offer per item (**409 `OFFER_EXISTS`**). Only an admin may decide, and only a pending offer can be decided (**409 `OFFER_NOT_PENDING`**). |
| Checkout rule | `backend/src/services/checkoutService.js` finds an `accepted` offer for `(product, buyer)`, atomically flips it to `used`, and uses `offer.amount` as that line's `unitPrice`. The listing price in the database is never changed, so other buyers still pay full price. Stock rollback also restores an offer to `accepted` if checkout fails before the order is created. |
| UI path | Product detail has a "Make an offer (₱)" form; `Orders → My offers` shows status; `Admin → Offers waiting` has Accept/Reject buttons. |
| Error when violated | `422 OFFER_NOT_BELOW_PRICE`, `422 OFFER_TOO_LOW`, `409 OFFER_EXISTS`, `404 NOT_FOUND`, `409 OFFER_NOT_PENDING`. |
| Test | `backend/tests/business.test.js` — "enforces the 50% floor, listing-price ceiling and one open offer, then prices checkout at the accepted amount", plus the unavailable-item case. |

**Without this rule:** buyers could offer the listed price or less than half of it, stack multiple offers on one item, or have a rejected offer silently change the checkout total.

---

## Feature 3 — Condition grading (data + workflow)

`condition` is a required enum on every product, surfaced as a colored tag in the grid and detail view with a plain-language explanation (`LIKE NEW`, `GOOD`, `FAIR`, `WORN`). The admin add-item form must select a grade, and the AI assistant receives condition as one of the grounded candidate fields. It changes the model enum, the validation schema, the API response, and the customer/admin UI — not just a color theme.

---

## Rule-to-error quick reference

| Rule | Violation response | Enforced in |
|---|---|---|
| One unit per physical item | `409 ITEM_UNAVAILABLE` | `services/inventoryService.js` |
| 15-minute reservation | `409 CANNOT_CANCEL`, `409 ALREADY_PAID` | `services/orderService.js`, `services/retryService.js` |
| Offer below listing | `422 OFFER_NOT_BELOW_PRICE` | `controllers/offerController.js` |
| Offer below 50% floor | `422 OFFER_TOO_LOW` | `controllers/offerController.js` |
| One open offer per item | `409 OFFER_EXISTS` | `controllers/offerController.js` |
| Only admin decides | `403 FORBIDDEN` | `middleware/auth.js`, `routes/index.js` |
| Invalid coupon | `422 COUPON_*` | `services/couponService.js` |
| Client-sent price/total | `422` unknown field | `middleware/validate.js` |
| Illegal order transition | `409 ILLEGAL_TRANSITION` | `services/orderService.js` |
