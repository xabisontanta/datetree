# Product Specification

## Status

This is the initial product baseline. Update it when approved behavior changes; implementation details belong in [architecture.md](architecture.md).

## Product Purpose

The product gives creators a mobile-friendly booking link for a social-media bio. A visitor can request a date, call, video call, coffee meeting, or another approved social interaction without browsing a public directory. A creator retains control over every request.

This is an 18+ social booking product, not a dating marketplace or guaranteed-access service.

## Users

- **Creator:** publishes a profile and experiences, configures availability, reviews requests, and accepts, declines, or counter-proposes.
- **Requester:** visits a direct creator link, chooses an experience and safe available slot, submits minimal details, responds to counter-offers, and pays only after acceptance when required.
- **Administrator:** handles reports, blocks, suspensions, audits, and authorized payment/refund visibility.

## Core Journey

```text
Choose experience
-> select calculated available time
-> submit request
-> creator accepts, declines, or counter-proposes
-> requester pays if required
-> booking is confirmed
-> WhatsApp notifications are sent
```

Consent is authoritative: a requester cannot buy guaranteed access. Pending requests do not reserve time. A creator acceptance, or requester acceptance of a creator counter-offer, establishes consent and reserves the selected slot. Paid bookings confirm only after server-side payment verification; free accepted bookings may confirm immediately.

## MVP Capabilities

- Creator account, WhatsApp verification, onboarding, public profile, safe theme, experiences, availability, preview, and publishing.
- Public direct-link profile with display name, image, bio, theme, experience price/duration, and calculated slots.
- Low-friction request flow with minimal identity details, 18+ confirmation, and creator-defined screening answers.
- Booking accept, decline, counter, cancel, expire, complete, no-show, and refund lifecycle.
- Paystack initialization, verified webhooks, payment records, expiry, and refunds.
- Twilio WhatsApp verification, lifecycle notifications, delivery tracking, and independent retries.
- Blocking, reporting, suspension, moderation, and privileged-action audit logs.

## Explicit Exclusions

Do not add swiping, discovery feeds, matching algorithms, a public creator directory, public dating reviews, public calendars, sexual-services functionality, or arbitrary creator HTML/CSS/JavaScript unless the product scope is explicitly revised.

## Experience and Privacy Targets

Design mobile first for 360-430 px screens and social in-app browsers. Target about 60 seconds for a booking request and 2-4 minutes for creator onboarding. Reveal only safe slots—not event details or reasons for unavailability. Minimize requester data and never expose private contact, booking, calendar, payment, payout, credential, or settings data.

## Decisions Still Required

- Payment window duration and reminder cadence.
- Cancellation, rescheduling, no-show, and refund policies.
- Supported currencies, commission rules, and payout timing.
- Experience-category restrictions and moderation service levels.
- Data retention/deletion periods and account recovery policy.
