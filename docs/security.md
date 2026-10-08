# Security and Privacy

## Objectives and classification

Protect creator contact/calendar data, requester identity and answers, private
requests, legacy financial history, authentication tokens and provider credentials.
Default to denial, least privilege, minimization and auditable privileged actions.

| Class | Examples | Handling |
| --- | --- | --- |
| Public | Published name/images/bio/theme, price-less services, safe slots | Allowlisted DTOs only |
| Private | Contacts, request notes/answers, calendar settings, request history | Participant/owner authorization, RLS and restricted grants |
| Highly sensitive | Service keys, Resend/Twilio credentials, OTPs, legacy payout data | Server-only secrets; never log or expose; do not store OTPs |
| Audit-sensitive | Moderation records, redacted delivery failures/activity | Restricted access and retention policy |

The creator's real calendar is never public. Availability exposes no event,
participant, source or unavailability-reason metadata. Date Tree processes no
payments in this phase; preserve existing private history without declaring it paid.

## Authentication and database authorization

- Validate a live session, ownership and operation-specific permission for each
  sensitive read/write. UI visibility and forwarded email links are not authority.
- Requesters access their own requests; creators access requests directed to them.
  Email intents open review only. Final actions are authenticated POSTs using the
  current version, transaction locks and booking-conflict protections.
- Requester verification must not create a creator profile. Validate same-origin
  post-login destinations; preserve existing recovery and Auth configuration.
- Authorization must not rely on user-editable metadata. Account deletion alone
  does not invalidate existing JWTs; sensitive RPCs validate the live Auth session.

Enable RLS on exposed tables and minimize grants independently. Test anonymous,
owner and non-owner Data API access, including column grants. Views must use
`security_invoker` where supported or have access revoked. Keep privileged
`SECURITY DEFINER` code in the private schema with a fixed safe `search_path`,
explicit caller/ownership checks and restricted execution; exposed wrappers use
invoker semantics. Never expose service-role credentials through `NEXT_PUBLIC_`.

## Contact consent and notification privacy

Derive verified email/WhatsApp server-side, not from submitted claims. Share only
one selected verified contact with explicit request-specific consent. A creator
must not retrieve unselected email through another RPC, table grant or notification
payload. Working `mailto:`/WhatsApp links use the selected DTO; email Reply-To is
set only for a consented verified email preference.

Contact sharing and WhatsApp status-notification opt-in are independent. A number
change invalidates verification and opt-in. STOP/settings opt-out stop WhatsApp;
request contact revocation stops future sharing. Recheck eligibility before sends.
Keep full notes, custom answers and private meeting instructions out of messages.

Twilio Verify uses WhatsApp with no OTP persistence/logging: 60-second resend
cooldown, three sends/hour per account and number, and five checks per challenge.
Keep verification usable by requesters without creator onboarding. Production
Verify requires an owner-supplied WhatsApp Sender configured for the Verify Service.

## Provider and worker controls

Keep provider secrets and worker authentication in secure Edge/Vault settings.
Background dispatch requires its secret; interactive dispatch also validates the
current session and authorized request. Separate channel kill switches default OFF.
Activation must not replay historical setup backlog or alter shared Zap Auth SMTP.

Verify Resend/Svix against the raw body and Twilio against the exact external URL
and all form fields using pinned SDKs. Reject invalid signatures before processing;
deduplicate callbacks and handle reordered states. Callbacks change delivery only,
never request status or read markers. Never blindly retry ambiguous WhatsApp sends.
Use approved utility templates without an unrestricted Body fallback.

Fenced leases and immutable provider payloads protect retries. Resend retries keep
the same body/key within its 24-hour window; six total attempts bound retries.
Provider failure cannot reverse a committed request or acceptance.

## Validation, logging and release gates

Validate bounded inputs/URLs and reject arbitrary creator HTML/CSS/scripts. Logs
must redact destinations, tokens, secrets, OTPs, request answers and raw webhook
bodies. Prefer delivery/request correlation IDs and normalized error codes.

Release-critical checks cover cross-account access, unselected-contact protection,
number changes/revocation, OTP abuse limits, stale/repeated actions, concurrent
acceptance, invalid/duplicate/reordered callbacks, worker crashes and expired
leases. Actual receipt/creator-email/status delivery and browser-closed retry
evidence are required for channel launch; mocks and sandbox/API acceptance are not
production proof. See [Request Notifications](request-notifications.md) and
[Test Instructions](../tests/AGENTS.md).

Finalize retention/deletion, incident response, key rotation, backup/restore,
recovery, abuse escalation, dependency review and monitoring ownership before
broader launch. Provider terms, billing, purchases or upgrades require owner approval.
