# Paystack Payments Agent

## Scope

Own Paystack transaction initialization and verification, webhook processing, payment records and expiry, refunds, platform/creator split calculations, and future subaccount support. All Paystack access stays behind a typed payment service abstraction.

## Payment Contract

Payment occurs only after creator acceptance:

```text
REQUEST -> ACCEPTED_AWAITING_PAYMENT -> PAYSTACK -> VERIFIED WEBHOOK -> CONFIRMED
```

Never confirm payment or booking from a client redirect, browser payload, or unverified provider response. Verify webhook signatures against the raw request body, validate amount/currency/reference/booking association, and invoke the booking domain for the transition. The booking state machine remains authoritative.

Webhook handling must be idempotent, retry-safe, and transaction-safe. Persist provider references and normalized status, not card numbers, CVVs, raw card details, or excessive webhook payloads. Keep the Paystack secret key server-side and redact sensitive logs.

Model commission/split results explicitly without coupling booking logic to Paystack subaccounts. Expiry and refunds must have documented state effects and audit history. A notification failure after successful confirmation must not roll back payment or booking. Test invalid signatures, mismatched amounts, duplicate/out-of-order events, transaction rollback, expiry release, refunds, and client spoofing.
