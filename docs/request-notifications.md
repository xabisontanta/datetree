# Reliable request notifications

## Product contract

Date Tree coordinates service requests, not payments. Public service DTOs and the
editor have no prices or “Free” labels. Legacy draft pricing fields are retained
only for schema compatibility; original request snapshots remain private. Every
request uses `external-v1`: acceptance confirms the service, never payment.

Email is the baseline; verified, opted-in WhatsApp is optional. Request status,
provider acceptance, delivery, and in-app read state are independent. Notes,
custom answers and private meeting instructions never appear in notification
payloads. Creator messages share only the explicitly consented, still-verified
preferred contact. Unselected email columns are not granted to Data API users.

## Links, identity and activity

`/dashboard/requests/[id]` and `/requests/[id]` are participant-authorized detail
pages. `?intent=accept` or `decline` opens review only. Buttons POST the current
version through the existing transaction, creator lock and conflict constraints.
Password sign-in preserves the same-origin destination; requester magic links do
not provision creator profiles. Opening a detail page marks only its viewed
events read. Provider callbacks never mark inbox activity read.

## Delivery architecture

Request/event/outbox/delivery intents commit together. Immediate dispatch is best
effort; `date-tree-notifications-minute` invokes the same worker through pg_net
every minute, with secrets read from Vault. Kill switches and first activation
timestamps live in `dt_private.notification_channels`; they default OFF. Old
`provider_not_configured` history is not replayed. Revoked contacts, changed
addresses, bounces and obsolete unsent notices are suppressed, not deleted.

Workers claim with `SKIP LOCKED` and fenced five-minute leases. Provider payloads
freeze before the first send. Email retries reuse the same Resend key/body;
six attempts and 24 hours bound retries. Backoff includes jitter and valid
Retry-After. Ambiguous WhatsApp POSTs or expired post-send leases become
`uncertain` and await signed callback reconciliation, not another send.

Resend uses Svix raw-body signature verification. Twilio uses the official SDK
and the exact configured public URL plus all form fields. Callback events are
deduplicated; terminal delivery states cannot be downgraded by older callbacks.
Callbacks only update delivery tables. Immutable signed email tags and a
per-delivery Twilio callback nonce allow reconciliation even if a worker crashes
before storing the provider reference. Early callbacks are retained for fenced
send-result reconciliation; delivery and business status remain separate.

Twilio Verify sends via `channel=whatsapp` using the owner's registered WhatsApp
Sender configured for the Verify Service, not a generic Twilio sender. Limits:
60-second cooldown, three sends/hour/account and number, five checks/challenge,
ten-minute expiry. Codes
are never stored or logged. Changing a number clears verification and consent;
STOP and settings opt-out disable WhatsApp sends without disabling requests.

## Owner setup and staged activation

1. Obtain owner approval for a Resend account and verify a domain/subdomain the owner
   controls (SPF/DKIM). These have not been supplied merely by owning a Twilio account.
   The generated `chatgpt.site` address is not an owner-controlled sending domain.
   Do not change Zap's shared Supabase Auth SMTP settings.
2. Store Edge secrets securely: `RESEND_API_KEY`, `NOTIFICATION_EMAIL_FROM`,
   `RESEND_WEBHOOK_SECRET`, `DATE_TREE_APP_URL`. Configure the Resend webhook at
   `SUPABASE_URL/functions/v1/dt-resend-webhook` for sent, delivered, bounced,
   failed and complained events.
3. Store a random `DT_NOTIFICATION_WORKER_SECRET` in Edge secrets and the same
   value in Vault as `dt_notification_worker_key`; Vault
   `dt_notification_worker_url` is the worker's full Supabase function URL.
   Never put credentials into SQL checked into Git or browser configuration.
4. Obtain real inbox delivery proof in isolated staging or with an enforced
   test-recipient allowlist before opening unrestricted production sending. The
   channel's private `recipient_allowlist` restricts claims/preparation to authorized
   test account IDs; leave it scoped until proof is captured. Set the email channel's
   first `activated_at` when starting that pilot, and enable it. Clear the allowlist
   only after delivery proof and launch approval. Kill-switch
   toggling preserves the original activation timestamp and history.
5. For WhatsApp, register the owner's production WhatsApp Sender and configure it
   for the Verify Service. A Twilio account or Verify Service alone is insufficient.
   Configure the inbound webhook and approved utility Content SIDs for every
   logical status template; Verify's authentication templates are distinct from
   these status templates. Required server secrets:
   `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`,
   `TWILIO_CONTENT_SID_MAP`, `TWILIO_VERIFY_SERVICE_SID`.
   Enable `DT_WHATSAPP_VERIFY_ENABLED=true` only after owner-approved testing.
   Missing templates fail closed: no unrestricted message Body fallback.
6. Prove real verification/status delivery with authorized numbers, then activate
   WhatsApp separately. Account terms, billing and paid upgrades require owner
   approval. Provider charges are operating costs, never requester payments.

## Operations and acceptance

Monitor redacted queue age/status/attempt counts, bounce/template errors and
`notification_worker_health.last_poll_at`. Check cron job-run history and pg_net
response codes without returning headers or secrets. An operator must reconcile
uncertain sends using provider records; never bulk reset them to queued.

Run `npm run check`, all pgTAP suites and browser submission/action/inbox tests.
Live acceptance also requires actual received receipt + creator email + status
update, retries with browsers closed, and real WhatsApp proof. Mocked tests,
sandbox sends and provider API acceptance do not prove inbox delivery. Payments,
marketing, chat, request expiry and reminder campaigns are outside this phase.

References: [Supabase scheduling](https://supabase.com/docs/guides/functions/schedule-functions),
[Resend domain setup](https://resend.com/docs/dashboard/domains/introduction),
[Resend idempotency](https://resend.com/docs/api-reference/emails/send-email),
[Resend signatures](https://resend.com/docs/webhooks/verify-webhooks-requests),
[Twilio signatures](https://www.twilio.com/docs/usage/webhooks/webhooks-security),
[WhatsApp Verify](https://www.twilio.com/docs/verify/whatsapp).
