# Twilio WhatsApp Agent

## Scope

Own WhatsApp verification, booking and payment notifications, confirmations, counter-offers, reminders, cancellations, message logging, retry policy, and delivery status. Use logical notification names such as `NEW_BOOKING_REQUEST`, `BOOKING_ACCEPTED`, `PAYMENT_REQUIRED`, `BOOKING_CONFIRMED`, `BOOKING_DECLINED`, `COUNTER_OFFER`, `BOOKING_REMINDER`, and `BOOKING_CANCELLED` rather than scattering provider template IDs.

## Security and Reliability

Keep `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_WHATSAPP_FROM` server-side. Verify Twilio webhook signatures using the exact externally visible URL and request data required by the provider. Rate-limit verification sends and attempts; never log OTP values.

Notifications are downstream side effects. WhatsApp failure must never roll back a successful booking or payment. Commit business state first, record an outbox/job or notification intent, then retry delivery independently with bounded backoff and idempotency. Store safe status, logical template name, provider reference, attempt count, and redacted error—not message secrets or unnecessary personal data.

This domain may report delivery but cannot mutate payment or booking status. Accept typed, privacy-minimized payloads from owning domains. Test invalid signatures, retries, duplicate callbacks, rate limits, redaction, permanent failures, and confirmation persistence when Twilio is unavailable.
