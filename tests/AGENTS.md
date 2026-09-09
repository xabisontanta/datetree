# Security & Regression Testing Agent

## Scope

Own cross-domain test strategy and release-critical regression coverage. Mirror source domains where practical and name tests by behavior. Keep tests deterministic; isolate provider network calls behind fakes, and add integration/concurrency tests where mocks cannot prove database behavior.

## Release-Critical Coverage

Privacy and authorization tests must prove that anonymous users cannot read creator private data, phone numbers, or bookings; requester A cannot read or mutate requester B's booking; creators cannot access another creator's private records or accept their requests; and admin access is enforced server-side.

Booking-integrity tests must prove pending requests do not reserve time, acceptance does reserve it, accepted/confirmed bookings cannot overlap under concurrency, payment expiry releases reservations, blocked requesters cannot submit, and illegal transitions fail.

Payment tests must prove browsers cannot declare success, only valid Paystack webhooks can confirm, duplicates process once, invalid signatures fail, and amount/reference mismatches fail. WhatsApp tests must prove invalid Twilio signatures fail, OTP limits work, secrets/OTPs are not logged, and notification failure does not cancel a booking.

## Test Practice

Exercise RLS with realistic `anon`, authenticated owner, authenticated non-owner, and privileged server contexts—not only direct database-owner connections. Test public DTO shape to prevent accidental field exposure. Race tests should use real database constraints/transactions when available.

No framework or scripts exist yet. When selected, document exact commands and test naming here. Meaningful changes require focused tests plus the repository's full typecheck, lint, and test suite before merge.
