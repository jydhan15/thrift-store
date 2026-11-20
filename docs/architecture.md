# Architecture

## Layered / context diagram
```mermaid
flowchart LR
  B[Browser: React + Vite] -->|HTTPS JSON, JWT| API[Express API /api/v1]
  API --> R[routes] --> C[controllers] --> S[services] --> M[(MongoDB Atlas via Mongoose models)]
  S -->|Factory: getPaymentProvider| PAY[Maya Checkout Sandbox]
  S -->|Proxy + Factory: AI service| AI[Gemini API]
  PAY -. webhook .-> API
```
Layers: **routes** (URL + validation + auth middleware) -> **controllers** (HTTP only) -> **services** (business rules) -> **models** (Mongoose). No database queries live in routes.

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
    P->>A: POST /webhooks/maya?token=...
    A->>A: verify token, store event id (unique), ack 200 fast
    A->>P: retrieve checkout (status, amount, currency)
    A->>D: pending_payment -> paid (atomic)
  else webhook missed
    Note over A,D: Admin presses Reconcile, API asks Maya directly and applies the same checks
    Note over A,D: If never paid, sweeper marks order expired after 15 min and restores stock
  end
```
The browser redirect after payment is informational only. Only the verified webhook or reconcile can mark an order paid.

## Order state machine
`pending_payment -> paid | cancelled | expired | payment_failed`, then `paid -> processing -> shipped -> delivered`. Illegal moves return 409 `ILLEGAL_TRANSITION`.
