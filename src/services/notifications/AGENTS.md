# Twilio WhatsApp Agent

## Scope

Own WhatsApp verification, service-request receipts/status notifications, counter-offers, cancellations, retry policy, and delivery status. Email launches first, then optional WhatsApp. Payments, marketing, chat, expiry and reminder campaigns are outside this phase. Use logical notification names rather than scattering provider template IDs.

## Security and Reliability

Keep provider secrets server-side. `TWILIO_CONTENT_SID_MAP` must map every sent logical name to an approved utility Content SID; never fall back to Body. Submit Meta templates named `dt_request_received`, `dt_new_booking_request`, `dt_counter_offer`, `dt_booking_confirmed`, `dt_booking_declined`, `dt_booking_cancelled`, `dt_booking_completed`, and `dt_booking_status_updated`. Verify Twilio signatures with its SDK and exact public URL/all form parameters; verify Resend raw bodies with Svix. Rate-limit Verify WhatsApp sends/checks; never log or store OTPs.

Notifications are downstream side effects. WhatsApp failure must never roll back a successful booking or payment. Commit business state first, record an outbox/job or notification intent, then retry delivery independently with bounded backoff and idempotency. Store safe status, logical template name, provider reference, attempt count, and redacted error—not message secrets or unnecessary personal data.

This domain may report delivery but cannot mutate payment or booking status. Accept typed, privacy-minimized payloads from owning domains. Test invalid signatures, retries, duplicate callbacks, rate limits, redaction, permanent failures, and confirmation persistence when Twilio is unavailable.

Reuse the transactional outbox and fenced leases. Six attempts within 24 hours;
stable immutable Resend payload/key; ambiguous WhatsApp sends await callbacks.
Channel flags default OFF. Never replay historical unconfigured deliveries.
Read `docs/request-notifications.md` before activation or provider setup.
