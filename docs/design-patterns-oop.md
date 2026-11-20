# Design patterns and OOP

| Pattern | Where | Why |
|---|---|---|
| MVC / layered | routes, controllers, services, models | separates HTTP from business rules |
| Singleton | `src/config/db.js` | one shared database connection |
| Factory | `src/services/payment/index.js`, `src/services/ai/index.js` | callers never import a concrete provider; switch with PAYMENT_PROVIDER / AI_PROVIDER |
| Facade | `src/services/paymentService.js` | controllers call one method; gateway details stay hidden |
| Proxy | `AIServiceProxy` in `src/services/ai/index.js` | adds cache and keyword fallback around the real AI service |

## Abstract class and subclasses
- `PaymentProvider` (abstract: constructor throws if instantiated directly) -> `PayMongoProvider`, `MayaProvider` (used), both implement `createCheckout`, `retrieve`, `verifyWebhook`, `parseEvent`.
- `AIProvider` (abstract) -> `GeminiProvider`, `OpenAIProvider`.

## Composition
`RealAIService` is composed with an `AIProvider`; `AIServiceProxy` is composed with a `RealAIService`. `checkoutService` composes the coupon service, order service, and the payment provider.

## Request trace: POST /api/v1/orders
`routes/index.js` (auth + zod validation) -> `orderController.checkout` -> `checkoutService.checkout` (atomic stock reservation, coupon check, totals) -> `getPaymentProvider().createCheckout` -> `Order` saved -> response.

## Trade-offs
Inheritance is kept one level deep (abstract base + concrete subclasses) to avoid fragile hierarchies. The proxy adds a small in-memory cache that resets on restart.

## Refactoring note
(Write your own: one real refactor you made, the file, and the commit hash. It must match your Git history.)
