# Architecture

## System Shape

The application uses Next.js and React with strict TypeScript and Tailwind CSS. Supabase provides PostgreSQL, Auth, and RLS. Paystack and Twilio are external infrastructure providers. Business rules remain provider-independent.

```text
Next.js UI
    |
    v
Route/application boundary (validation + authorization)
    |
    v
Domain services (booking, creators, requester, admin)
    |
    v
Infrastructure services (availability, payments, notifications, repositories)
    |
    v
Supabase/PostgreSQL, Paystack, Twilio
```

Dependencies point downward. Infrastructure adapters implement typed domain-facing interfaces; external providers never become the source of business policy.

## Ownership

| Area | Owns | Must not own |
| --- | --- | --- |
| Frontend | Rendering, interaction, accessibility | Authorization, booking transitions, payment verification |
| Booking | Lifecycle and transition rules | Provider signatures or message delivery |
| Availability | Safe slot calculation and conflict input | Public calendar event disclosure |
| Payments | Paystack verification and payment records | Booking-rule bypass |
| Notifications | Twilio delivery and retries | Booking/payment status |
| Supabase | Persistence, RLS, constraints, transactions | UI and provider-specific policy |
| Admin | Moderation workflows and audit intent | Unrestricted database access |

See the nearest `AGENTS.md` for each directory's detailed contract.

## Public and Private Boundaries

Public routes return purpose-built DTOs containing only published creator information, published experiences, price/duration, and calculated availability. They never return raw table rows or distinguish why a time is unavailable.

Authenticated creator, requester, and admin routes must validate identity and authorization server-side. RLS provides defense in depth and direct Data API isolation. Service-role access is restricted to trusted server adapters and does not replace application authorization.

## Paid Booking Sequence

1. Requester submits a validated request; booking becomes `PENDING_CREATOR` and does not reserve time.
2. Creator accepts; booking rechecks the slot transactionally and enters `ACCEPTED_AWAITING_PAYMENT`, reserving time.
3. Payments initializes a Paystack transaction using a server-owned reference.
4. A signature-verified, amount-matched, idempotent webhook records payment success.
5. Booking validates the current state and transitions atomically to `CONFIRMED`.
6. A notification intent is recorded and Twilio delivery runs independently.

Free accepted bookings skip Paystack and enter `CONFIRMED`. Counter-offers remain unreserved until the requester accepts the creator's proposed slot.

## Data and Time

Keep separate public/private projections for creators and requesters. Store authoritative timestamps in UTC and retain the relevant named timezone for display and recurrence rules. Use database constraints, locks, or exclusion semantics to prevent overlapping accepted/confirmed reservations. Use unique provider references/idempotency keys for webhook replay safety.

## Reliability

Commit authoritative booking/payment state before attempting notifications. Use an outbox/job boundary so provider failure is retryable without reversing business state. Make webhook consumers safe for duplicates and out-of-order delivery. Redact logs and attach a correlation identifier rather than copying sensitive payloads.

## Configuration and Deployment

No runtime/toolchain exists yet. When introduced, pin dependencies and commit lockfiles. Document environment-variable names in `.env.example` without values, distinguish browser-safe publishable configuration from server secrets, and add health, migration, rollback, and observability procedures before production launch.
