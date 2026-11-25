# Architecture

## Layered / context diagram
```mermaid
flowchart LR
  B[Browser: React + Vite] -->|HTTPS JSON, JWT| API[Express API /api/v1]
  API --> R[routes] --> C[controllers] --> S[services] --> M[(MongoDB Atlas via Mongoose models)]
  S -->|Factory: getPaymentProvider| PAY[Maya Checkout Sandbox]
  S -->|Proxy + Factory: AI service| AI[Gemini API]
  PAY -. signed/token webhook .-> API
```
Trusted boundary: the browser is **untrusted** (client totals are ignored); routes/controllers/services/models, the database, and all provider keys are **trusted backend only**. Layers: **routes** (URL + validation + auth middleware) -> **controllers** (HTTP only) -> **services** (business rules) -> **models** (Mongoose). No database queries live in routes.

## Use cases
```mermaid
usecaseDiagram
  actor Customer
  actor Admin
  actor Gateway as Payment gateway
  actor AI as Gemini
  Customer --> (Register / sign in)
  Customer --> (Browse, search, filter catalog)
  Customer --> (Add unique item to cart)
  Customer --> (Make an offer below listing price)
  Customer --> (Checkout with coupon and 15-minute hold)
  Customer --> (Pay / retry / cancel order)
  Admin --> (Manage products, stock, coupons)
  Admin --> (Accept or reject offers)
  Admin --> (Advance order status / reconcile payment)
  Admin --> (View sales dashboard)
  Customer --> (Ask AI shopping assistant)
  (Checkout with coupon and 15-minute hold) --> Gateway : hosted checkout
  Gateway --> (Verify webhook + retrieve payment) : signed callback
  (Ask AI shopping assistant) --> AI : grounded candidates only
```

## Checkout sequence (with webhook and missed-webhook paths)
```mermaid
sequenceDiagram
  participant U as Buyer (React)
  participant A as API
  participant D as MongoDB
  participant P as Maya sandbox
  U->>A: POST /orders (Idempotency-Key, shipping, coupon)
  A->>D: atomic stock decrement per item (reservation, 15 min)
  A->>D: create order pending_payment
  A->>P: create checkout session
  P-->>A: checkoutId + redirectUrl
  A-->>U: order + checkoutUrl
  U->>P: pays with sandbox card
  alt webhook arrives
    P->>A: POST /webhooks/maya?token=... (raw body)
    A->>A: verify token, parse event, check event id
    A->>P: retrieve checkout (status, amount, currency)
    A->>D: pending_payment -> paid (atomic, history entry)
    A->>D: store WebhookEvent id AFTER successful processing
  else webhook missed
    Note over A,D: Admin presses Reconcile, API asks Maya directly (current + previousRefs)
    Note over A,D: If never paid, sweeper marks order expired after 15 min and restores stock
  end
```
The browser redirect after payment is informational only. Only the verified webhook or reconcile can mark an order paid. If a gateway-confirmed payment arrives after expiry, `recoverPaidOrder()` re-reserves stock and coupon, then moves `expired -> pending_payment -> paid` with history, or flags the order if the item is gone.

## Class / module model (abstract class, inheritance, composition)
```mermaid
classDiagram
  class PaymentProvider {
    <<abstract>>
    +createCheckout(order)
    +retrieve(checkoutId)
    +verifyWebhook(raw, headers)*
    +parseEvent(raw)*
  }
  class MayaProvider
  class PayMongoProvider
  PaymentProvider <|-- MayaProvider
  PaymentProvider <|-- PayMongoProvider

  class AIProvider {
    <<abstract>>
    +generateJson(system, payload)*
  }
  class GeminiProvider
  class OpenAIProvider
  AIProvider <|-- GeminiProvider
  AIProvider <|-- OpenAIProvider

  class CheckoutService {
    -inventoryService
    -couponService
    -orderService
    -paymentProvider
    +checkout()
  }
  CheckoutService *-- InventoryService
  CheckoutService *-- CouponService
  CheckoutService *-- OrderService
  CheckoutService *-- PaymentProvider
  class AIServiceProxy {
    -real: RealAIService
    -cache: Map
    +recommend()
  }
  AIServiceProxy *-- RealAIService
  RealAIService *-- AIProvider
```
`PaymentProvider` and `AIProvider` throw on unimplemented operations (`backend/src/services/payment/PaymentProvider.js`, `backend/src/services/ai/AIProvider.js`). Concrete providers are selected at runtime by factories. `CheckoutService` uses **composition** of collaborators instead of inheriting them. See `docs/design-patterns-oop.md` for the full trace and trade-offs.

## Order state machine
```mermaid
stateDiagram-v2
  [*] --> pending_payment
  pending_payment --> paid : verified webhook / reconcile
  pending_payment --> cancelled : customer
  pending_payment --> payment_failed : failed webhook
  pending_payment --> expired : 15-minute sweep
  payment_failed --> pending_payment : retry (re-reserve)
  expired --> pending_payment : retry (re-reserve)
  paid --> processing : admin
  processing --> shipped : admin
  shipped --> delivered : admin
  cancelled --> [*]
  delivered --> [*]
```
Anything not on an arrow returns 409 `ILLEGAL_TRANSITION`; every transition appends `{from, to, actor, at}` to `order.history`.
