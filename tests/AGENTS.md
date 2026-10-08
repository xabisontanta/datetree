# Security & Regression Testing Agent

## Scope

Own cross-domain test strategy and release-critical regression coverage. Mirror source domains where practical and name tests by behavior. Keep tests deterministic; isolate provider network calls behind fakes, and add integration/concurrency tests where mocks cannot prove database behavior.

## Release-Critical Coverage

Privacy and authorization tests must prove that anonymous users cannot read creator private data, phone numbers, or bookings; requester A cannot read or mutate requester B's booking; creators cannot access another creator's private records or accept their requests; and admin access is enforced server-side.

Booking-integrity tests must prove pending requests do not reserve time, acceptance does reserve it, confirmed bookings cannot overlap under concurrency, cancellation releases reservations, blocked requesters cannot submit, and illegal transitions fail. Cover scheduled appointments, deliverables and enquiries, including legacy fixed/quoted requests under the external-arrangement policy without changing their private snapshots or declaring payment.

Date Tree does not process payments. Test selected verified-contact isolation, separate sharing/notification consent, number changes, revoked contacts, unread activity and authenticated exact-request actions. Notification tests must cover signed Resend/Twilio callbacks, duplicate/out-of-order events, fenced leases, bounded retries, ambiguous WhatsApp sends, channel kill switches and OTP abuse limits. Provider failure must never undo a request or change its business status.

## Test Practice

Exercise RLS with realistic `anon`, authenticated owner, authenticated non-owner, and privileged server contexts—not only direct database-owner connections. Test public DTO shape to prevent accidental field exposure. Race tests should use real database constraints/transactions when available.

Use Vitest (`npm test`, `*.test.ts`) and pgTAP (`npm run test:db`, `*.test.sql`).
Run `npm run check` before release. Database tests require local Supabase and Docker;
the portable runner copies tests into its own temporary helper and rejects remote
Docker targets or a local database with missing migration versions. CI starts a
fresh runner-local stack; it has no production credentials or deployment authority.
rollback-only remote checks must be identified separately. Test server/client data
serialization as well as pure business logic; typechecking cannot detect RSC failures.
Never label synthetic database identities or mocked tests as browser authentication QA.
Actual inbox receipt and authorized production WhatsApp delivery are separate
launch requirements; provider acceptance alone is not delivery evidence.
