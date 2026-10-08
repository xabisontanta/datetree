# Booking State Machine Agent

## Scope

Own service requests, acceptance, decline, appointment counter-proposals, cancellation, completion, and booking integrity. Preserve legacy history without adding payment, refund, no-show, or automatic-expiry flows. [docs/booking-state-machine.md](../../../docs/booking-state-machine.md) is the canonical lifecycle reference.

## Required States

Active states are `PENDING_CREATOR`, `COUNTER_PROPOSED`, `CONFIRMED`, `DECLINED`, `CANCELLED`, and `COMPLETED`. `CONFIRMED` means appointment confirmed, delivery in progress, or enquiry accepted, never paid. Other existing states are legacy schema/history compatibility; do not create their transitions in this phase. Never permit arbitrary status assignment.

Use the submission RPC and named operations `accept`, `decline`, `counter`, `accept_counter`, `cancel`, and `complete`. Verify operation-specific actor permission, version/state, and slot/capacity rules even on retries. Email GET links open review only; final actions require authorized POSTs. Payment and delivery callbacks never gate or mutate acceptance under `external-v1`.

## Invariants

- A pending request does not reserve a slot.
- Acceptance reserves appointment slots; deliverables and enquiries do not reserve time. `external-v1` requests never enter payment states or imply payment.
- Overlapping accepted or confirmed bookings must be prevented atomically in the backend/database, never only by UI checks.
- Preserve legacy snapshots and historical states privately. Prices and payment operations are outside this phase.
- Notification failure never reverses a successful transition.

Commit transitions, activity, and outbox intent transactionally with auditable timestamps and idempotency. Do not call payment or messaging providers directly. Test active legal edges, illegal/legacy edges, authorization, consent isolation, races, stale/repeated actions, capacity, and overlap behavior.
