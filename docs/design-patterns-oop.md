# Design patterns and OOP

Patterns implemented in the live request path: **MVC (layered)**, **Factory Method**, **Facade**, **Proxy**. Each section below gives the problem, the files, the collaborators and flow, the trade-off, and one rejected alternative.

## 1. MVC / layered architecture

**Problem.** Mixing HTTP handling, business rules, and database access in one file makes rules (stock, coupons, order states) hard to test and easy to bypass.

**Files.**
- Routes: `backend/src/routes/index.js` (routing, auth/role middleware, rate limits, validation only)
- Controllers: `backend/src/controllers/*.js` (read the request, call a service, format the response)
- Services: `backend/src/services/*.js` (`checkoutService`, `couponService`, `orderService`, `paymentService`, `retryService`)
- Models: `backend/src/models/index.js` (Mongoose schemas)

**Flow (retry payment).** `POST /api/v1/orders/:id/pay` -> `routes/index.js` (`auth`) -> `retryController.retry` -> `retryService.retryPayment` (ownership check, attempt limit, atomic stock re-reservation, coupon claim) -> `getPaymentProvider().createCheckout` -> `Order` updated -> `{ success: true, data }`.

**Trade-off.** Easier: each rule lives in one service and is tested through the API. More complex: a small feature touches 3 to 4 files.

**Rejected alternative.** Business logic inside route handlers. Rejected because rules would be duplicated between customer and admin paths and could not be reused by the webhook and reconcile paths.

## 2. Factory Method (payment and AI providers)

**Problem.** The app must switch between payment gateways (PayMongo, Maya) and AI providers (Gemini, OpenAI) without editing the code that uses them.

**Files.**
- `backend/src/services/payment/index.js` exports `getPaymentProvider()`, which returns a `PayMongoProvider` or `MayaProvider` depending on the `PAYMENT_PROVIDER` environment variable.
- `backend/src/services/ai/index.js` does the same for `GeminiProvider` and `OpenAIProvider` using `AI_PROVIDER`.

**Collaborators and flow.** `paymentService.js` and `retryService.js` call `getPaymentProvider()` and then only use the base-class methods (`createCheckout`, `retrieve`, `verifyWebhook`, `parseEvent`). They never import a concrete provider.

**Trade-off.** Easier: adding a third gateway means one new subclass and one line in the factory. More complex: one extra indirection when reading the code.

**Rejected alternative.** `if (provider === "maya") ... else ...` inside the services. Rejected because every new gateway would require edits in several services.

## 3. Facade (payment service)

**Problem.** Gateway work (creating sessions, verifying signatures, checking amount and currency, handling duplicate events) is detailed and gateway-specific. Controllers should not know about it.

**File.** `backend/src/services/paymentService.js`.

**Collaborators and flow.** Controllers call one method. Inside, the facade calls the provider's `verifyWebhook` (invalid signature returns 401 `INVALID_SIGNATURE`), stores the event so a duplicate (Mongo error 11000 on the unique `eventId`) returns `{ duplicate: true }`, calls `retrieve` to confirm status, amount and currency, and flags `AMOUNT_MISMATCH` instead of marking the order paid when the amount differs.

**Trade-off.** Easier: controllers stay small and the gateway logic is in one place. More complex: the facade can grow large if too many gateway rules are added.

**Rejected alternative.** Controllers calling the providers directly. Rejected because signature and amount checks could be skipped or implemented twice.

## 4. Proxy (AI service)

**Problem.** AI calls are slow, can fail, and cost money. The store must keep working when the AI provider is down.

**File.** `AIServiceProxy` in `backend/src/services/ai/index.js`, wrapping `RealAIService`.

**Collaborators and flow.** `miscController.assistant` calls the proxy, which has the same `recommend` method as the real service. The proxy returns a cached result when available, calls the real service otherwise, validates the result against the database, and on failure falls back to a keyword search of active products. If nothing can be returned it throws `503 AI_UNAVAILABLE`.

**Trade-off.** Easier: caching and failure handling are added without changing the real service or the controller. More complex: the in-memory cache resets when the server restarts.

**Rejected alternative.** Putting the cache and fallback inside `GeminiProvider`. Rejected because it would be duplicated in `OpenAIProvider`.

## Abstract class and subclasses (inheritance and polymorphism)

- `PaymentProvider` (abstract): the constructor throws if instantiated directly (`new.target`), and `createCheckout`, `retrieve`, `verifyWebhook`, `parseEvent` throw "not implemented" unless overridden. Subclasses: `PayMongoProvider`, `MayaProvider`. Services use them through the base type.
- `AIProvider` (abstract). Subclasses: `GeminiProvider`, `OpenAIProvider`.

**Why inheritance here.** All providers share one contract and differ only in gateway details, so a one-level hierarchy removes duplication and allows polymorphic use.

## Composition

- `RealAIService` is composed with an `AIProvider`, and `AIServiceProxy` is composed with a `RealAIService`.
- `checkoutService` composes the coupon service, the order service, and the payment provider.
- `retryService` composes `orderService` (state transitions), the `Product` and `Coupon` models, and the payment provider.

**Why composition here.** These are "has-a" relationships. Collaborators can be replaced in tests and there is no deep inheritance chain.

## Encapsulation

State changes go through service functions (for example `transition` in `orderService.js`, which enforces the order state machine). Routes and controllers never write order status directly.

## Trade-offs (inheritance)

Inheritance is limited to one level (abstract base class plus concrete subclasses) to avoid the fragile base class problem. Everything else uses composition.

## Refactoring note

Commit 4cbd14f extracted the stock reservation and rollback code that was duplicated in checkoutService.js and retryService.js into a shared inventoryService.js (reserve, release, reserveAll). Before: both services had their own conditional stock decrement and their own rollback loop. After: both call the same functions, so the atomic rule exists in one place. Behavior is unchanged and npm test still passes (19 of 19).

