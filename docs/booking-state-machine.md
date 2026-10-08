# Booking State Machine

## Current request lifecycle

The active service-request flow uses `PENDING_CREATOR`, `COUNTER_PROPOSED`,
`CONFIRMED`, `DECLINED`, `CANCELLED` and `COMPLETED`. `CONFIRMED` means
“Appointment confirmed,” “Delivery in progress” or “Enquiry accepted,” according to
the snapshotted service kind. It never means payment was collected or verified.

Older schemas may retain `DRAFT`, `ACCEPTED_AWAITING_PAYMENT`, `EXPIRED`,
`NO_SHOW`, `REFUND_PENDING` and `REFUNDED`. Preserve existing records and original
terms privately; this phase does not create payment/refund transitions or migrate
historical statuses to pretend success. Existing pending fixed-price requests can
be accepted under the explicit `external-v1` arrangement policy.

## Invariants

1. A verified requester, 18+ confirmation and required consent precede submission.
   Contact sharing additionally requires a selected, verified method and explicit
   consent; notification opt-in is separate.
2. Pending and countered appointments do not reserve time.
3. Acceptance rechecks publication, service availability, appointment conflicts or
   deliverable capacity in the same database transaction.
4. Acceptance and counter acceptance enter `CONFIRMED` without any payment flow.
   Any fees are arranged privately outside Date Tree.
5. Only request participants can read private requests; transition permissions are
   actor-specific and enforced server-side, including repeated clicks.
6. Transitions require the current version. Exact repeat actions are idempotent;
   stale or conflicting actions fail without bypassing booking checks.
7. Notification acceptance, delivery, failure and unread activity are independent
   of request status. Messaging callbacks never mutate business state.

## Transition matrix

| From | Operation / actor | To | Important guards |
| --- | --- | --- | --- |
| New request | Submit / verified requester | `PENDING_CREATOR` | Valid service, consent, answers and applicable slot; idempotency key |
| `PENDING_CREATOR` | `accept` / owning creator | `CONFIRMED` | Current version; service/publication active; conflict or capacity rechecked |
| Pending or countered | `decline` / owning creator | `DECLINED` | Creator ownership; current version |
| Pending or countered appointment | `counter` / owning creator | `COUNTER_PROPOSED` | Valid proposed slot; still unreserved |
| `COUNTER_PROPOSED` | `accept_counter` / owning requester | `CONFIRMED` | Current proposal/version; authoritative slot rechecked |
| Pending, countered or confirmed | `cancel` / either participant | `CANCELLED` | Current version; release any reservation atomically |
| `CONFIRMED` | `complete` / owning creator | `COMPLETED` | Appointment must have ended; current version |

Any other transition is denied. A requester can cancel a counter instead of
accepting it; creators can decline it. Automatic expiry, no-show handling and
reminder campaigns are outside this phase.

## Transaction and concurrency boundary

The transition RPC locks the creator and request, validates the authenticated
actor, then re-reads authoritative state. Appointment acceptance uses buffer-aware
reservations and database conflict constraints; an accepted appointment also blocks
the creator's local calendar day. Deliverable acceptance enforces capacity and
records its due date; enquiries reserve no slot.

Each successful state change records a versioned event and notification intent
within the transaction. Provider sends run afterward through the fenced outbox
worker. A send failure cannot reverse acceptance or lose the request. See
[Reliable Request Notifications](request-notifications.md) for retry, callback,
consent-recheck and channel-activation rules.

Email action URLs only open an authenticated review screen. GET never changes
request status; final actions require an authorized POST with the current version.
