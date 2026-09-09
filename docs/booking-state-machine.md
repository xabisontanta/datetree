# Booking State Machine

## Canonical Status Set

```ts
enum BookingStatus {
  DRAFT = "DRAFT",
  PENDING_CREATOR = "PENDING_CREATOR",
  COUNTER_PROPOSED = "COUNTER_PROPOSED",
  ACCEPTED_AWAITING_PAYMENT = "ACCEPTED_AWAITING_PAYMENT",
  CONFIRMED = "CONFIRMED",
  DECLINED = "DECLINED",
  EXPIRED = "EXPIRED",
  CANCELLED = "CANCELLED",
  COMPLETED = "COMPLETED",
  NO_SHOW = "NO_SHOW",
  REFUND_PENDING = "REFUND_PENDING",
  REFUNDED = "REFUNDED"
}
```

Status is changed only through named domain transition functions. Direct assignment from UI, provider adapters, generic repositories, or webhook handlers is forbidden.

## Invariants

1. Consent precedes payment and confirmation.
2. `PENDING_CREATOR` and `COUNTER_PROPOSED` do not reserve a slot.
3. Creator acceptance reserves a slot; requester acceptance of a creator counter-offer reserves the countered slot.
4. Paid acceptance enters `ACCEPTED_AWAITING_PAYMENT`; free acceptance enters `CONFIRMED`.
5. Only verified server-side payment evidence can move a paid booking to `CONFIRMED`.
6. Accepted/confirmed reservations cannot overlap for the same creator.
7. Payment expiry releases the reservation.
8. Notification failure never changes or reverses booking state.
9. Every transition validates actor, current state, target state, slot, and applicable payment facts.

## Transition Matrix

| From | Operation / actor | To | Important guards |
| --- | --- | --- | --- |
| `DRAFT` | `createBookingRequest` / requester | `PENDING_CREATOR` | Valid experience, requester data, screening answers, safe slot; no block |
| `PENDING_CREATOR` | `acceptBooking` / owning creator | `ACCEPTED_AWAITING_PAYMENT` | Paid experience; slot rechecked and reserved atomically |
| `PENDING_CREATOR` | `acceptBooking` / owning creator | `CONFIRMED` | Free experience; slot rechecked and reserved atomically |
| `PENDING_CREATOR` | `declineBooking` / owning creator | `DECLINED` | Optional safe reason policy |
| `PENDING_CREATOR` | `counterBooking` / owning creator | `COUNTER_PROPOSED` | Proposed slot valid; not yet reserved |
| `COUNTER_PROPOSED` | `acceptCounterOffer` / owning requester | `ACCEPTED_AWAITING_PAYMENT` or `CONFIRMED` | Counter current; slot rechecked/reserved; payment rule selects target |
| `COUNTER_PROPOSED` | decline/cancel / owning requester | `DECLINED` or `CANCELLED` | Idempotent terminal handling |
| `PENDING_CREATOR`, `COUNTER_PROPOSED` | `expireBooking` / system | `EXPIRED` | Deadline reached; no reservation to release |
| `ACCEPTED_AWAITING_PAYMENT` | verified payment / system through booking service | `CONFIRMED` | Signature, reference, amount, currency, idempotency, current reservation |
| `ACCEPTED_AWAITING_PAYMENT` | `expireBooking` / system | `EXPIRED` | Payment window elapsed; release reservation atomically |
| Active nonterminal state | `cancelBooking` / authorized party/system | `CANCELLED` | Cancellation policy and refund need evaluated |
| `CONFIRMED` | `markCompleted` / authorized actor/system | `COMPLETED` | Booking end reached and policy satisfied |
| `CONFIRMED` | `markNoShow` / authorized actor | `NO_SHOW` | Booking end reached; evidence/policy applied |
| Eligible paid state | refund initiation / authorized service/admin | `REFUND_PENDING` | Refund policy, amount, audit record |
| `REFUND_PENDING` | verified refund completion / system | `REFUNDED` | Provider reference and idempotency |

Any transition not explicitly allowed is denied. Final cancellation/refund eligibility and who may mark completion/no-show remain product-policy decisions and must be made explicit before implementation.

## Transaction and Concurrency Boundary

Acceptance and counter acceptance must re-read authoritative availability and reserve within one database transaction. Use a database constraint, exclusion rule, or correctly locked conflict check to make competing accepts safe; a frontend precheck is insufficient. Store transition actor, timestamp, previous/next state, and correlation/idempotency reference where relevant.

Payment webhook processing records verified payment and requests booking confirmation idempotently. It must tolerate duplicates and out-of-order events. Notification intent is recorded after or atomically with successful business state, then delivered outside the transaction.

## Expiration and Scheduled Work

System jobs may expire stale pending/counter requests and accepted bookings whose payment window elapsed. Each job must be idempotent, use database time, verify current state/deadline again, and release reservations in the same transaction. Exact deadlines and reminders are documented product decisions.
