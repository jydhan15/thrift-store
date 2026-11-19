# Business Rules (Thrift Store)
| Rule | Endpoint | Error |
|---|---|---|
| Each item is unique (stock 1); only one buyer can reserve it | POST /api/v1/orders | 409 ITEM_UNAVAILABLE |
| Reservation lasts 15 min, then stock auto-released | background sweep | order -> expired |
| Offer must be below price and >= 50% of price | POST /api/v1/products/:id/offers | 422 OFFER_NOT_BELOW_PRICE / OFFER_TOO_LOW |
| One open offer per buyer per item | same | 409 OFFER_EXISTS |
| Only admin can accept/reject; accepted offer price applies only to that buyer, once | PATCH /api/v1/admin/offers/:id | 403 / 409 OFFER_NOT_PENDING |
| Coupon rules: expiry, min spend, usage limits | POST /api/v1/orders | 422 COUPON_* |
| Illegal order transitions | PATCH /api/v1/admin/orders/:id/status | 409 ILLEGAL_TRANSITION |
