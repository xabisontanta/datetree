# Security and Privacy

## Security Objectives

Protect creator contact/calendar data, requester identity and answers, private bookings, payment/payout records, authentication tokens, and provider/OAuth credentials. Default to denial, least privilege, data minimization, and auditable privileged actions.

## Data Classification

| Class | Examples | Handling |
| --- | --- | --- |
| Public | Published display name, image, bio, safe theme, experiences, price/duration, calculated slots | Purpose-built read DTOs only |
| Private | Phone/email, requester details, bookings, calendar rules/events, screening answers, settings | Owner/role authorization plus RLS |
| Highly sensitive | Payout data, OAuth tokens, service keys, Paystack/Twilio secrets, OTPs | Server-only, minimal storage, encrypted platform facilities, never logged |
| Audit-sensitive | Reports, moderation actions, provider errors | Restricted access, redaction, retention policy |

The creator's real calendar is never public. Availability responses contain only UTC start/end slots and no event, participant, source, or unavailability-reason metadata.

## Authentication and Authorization

- Validate sessions and ownership on the server for every sensitive read/write; UI visibility is not authorization.
- Enforce tenant isolation with RLS and test owner/non-owner behavior.
- Anonymous users receive only explicitly published data and safe availability.
- Requesters access only their own bookings; creators access only their records and requests directed to them.
- Admin authority must come from protected server/database claims, not user-editable metadata.
- Consider token freshness/revocation for high-risk actions; JWT claims can be stale.

## Supabase/PostgreSQL Controls

Enable RLS on every exposed table. Data API grants and RLS solve different layers, so minimize both. Policies must include row ownership; `TO authenticated` alone is not authorization. UPDATE requires suitable SELECT access and both `USING` and `WITH CHECK`. Use `security_invoker` for exposed views where supported or revoke access. Avoid `SECURITY DEFINER`; if essential, isolate it outside exposed schemas, restrict execution, validate callers, set a safe `search_path`, and test it.

Use constraints and transactions for slug uniqueness, webhook idempotency, ownership integrity, and booking overlap prevention. Never expose the service-role/secret key in browser code or a `NEXT_PUBLIC_` variable.

## Provider and Payment Controls

Keep Paystack and Twilio secrets server-side. Verify webhook signatures against the required raw request representation before parsing business fields. Validate Paystack amount, currency, reference, booking association, and current state. Treat redirects as untrusted. Never store card number, CVV, or raw card data.

Rate-limit WhatsApp verification sends and attempts; hash or otherwise minimize verification state and never log OTPs. Notification delivery failure must be retried separately and must not undo payment or booking state.

## Input, Output, and Logging

Validate all untrusted inputs with explicit schemas, constrain lengths and URLs, and reject creator-supplied scripts/styles/HTML. Return allow-listed DTOs instead of serializing database rows. Logs must redact tokens, secrets, phone numbers where feasible, OTPs, payout/card data, screening answers, and raw webhook bodies. Prefer correlation IDs and normalized error codes.

## Required Security Tests

Release-critical tests cover anonymous/private isolation, cross-requester and cross-creator access, admin authorization, public DTO leakage, illegal transitions, concurrent overlap prevention, blocked requesters, webhook signature/replay/spoofing, OTP limits, and notification failure independence. See [../tests/AGENTS.md](../tests/AGENTS.md).

## Policies to Finalize Before Launch

Define retention/deletion, breach response, key rotation, backup/restore testing, account recovery, abuse escalation, refund approval, monitoring/alerting, dependency review, and production access procedures.
