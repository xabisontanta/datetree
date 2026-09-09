# Booking State Machine Agent

## Scope

Own booking requests, acceptance, decline, counter-proposal, cancellation, expiration, completion, no-show, refund-related states, and booking-integrity rules. [docs/booking-state-machine.md](../../../docs/booking-state-machine.md) is the canonical lifecycle reference.

## Required States

Use `DRAFT`, `PENDING_CREATOR`, `COUNTER_PROPOSED`, `ACCEPTED_AWAITING_PAYMENT`, `CONFIRMED`, `DECLINED`, `EXPIRED`, `CANCELLED`, `COMPLETED`, `NO_SHOW`, `REFUND_PENDING`, and `REFUNDED`. Never permit arbitrary status assignment.

Expose named domain operations such as `createBookingRequest`, `acceptBooking`, `declineBooking`, `counterBooking`, `acceptCounterOffer`, `expireBooking`, `cancelBooking`, `markCompleted`, and `markNoShow`. Each transition must verify actor permission, current/target state, slot validity, and payment requirements.

## Invariants

- A pending request does not reserve a slot.
- Acceptance reserves the slot; paid bookings enter `ACCEPTED_AWAITING_PAYMENT` until verified.
- Overlapping accepted or confirmed bookings must be prevented atomically in the backend/database, never only by UI checks.
- Payment expiry releases the reservation according to documented policy.
- Payment verification may request a transition but cannot bypass state-machine rules.
- Notification failure never reverses a successful transition.

Perform transitions transactionally with auditable timestamps and idempotency where retries are possible. Do not call Paystack or Twilio directly. Test every legal edge, representative illegal edges, authorization, races, retries, expiry, and overlap behavior.
