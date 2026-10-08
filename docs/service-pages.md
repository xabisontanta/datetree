# Service Pages

Date Tree now supports coaches, businesses, consultants, creators and freelancers.
Dating is not the default market. There is no discovery feed or public calendar.

## Creator journey

`/dashboard` provides four steps: profile, services, availability and appearance.
Save reserves the normalized username and persists a revisioned draft in Supabase.
Publish validates consent, active services and appointment availability, then copies
an allowlisted public snapshot. Later draft changes do not change the live page.
Published usernames are locked so links remain stable. Pause disables new requests;
unpublish hides the page and fresh media reads without deleting request history.

Profiles support an avatar, separate cover and background images, bio, tagline,
ordered HTTPS links and versioned theme tokens. Uploads decode/re-encode pixels in
the browser, discard metadata, and undergo bounded PNG validation on the server.
The private `date-tree-media` bucket enforces ownership and published references.
Images use immutable names. Already downloaded copies cannot be recalled.

## Services and requests

- Appointments: duration, online/in-person, public city and private meeting details.
- Deliverables: turnaround and maximum active deliveries, without calendar slots.
- Enquiries: project briefs, without an appointment or delivery reservation.

Services have no public prices, “Free” labels, checkout or payment prompts. Any fees
are arranged privately. Legacy draft pricing fields remain only for compatibility;
original request terms and history stay private and are not reclassified as paid.

Visitors verify an email through Supabase's normal passwordless flow; they do not
complete creator onboarding. Requests snapshot service terms, record age/sharing
consent, and are deduplicated by requester and idempotency key. Creators receive only
the requester's selected, currently verified contact with explicit sharing consent;
WhatsApp notification opt-in is separate. Private meeting/next-step details become
visible to the requester after acceptance. Deliverable acceptance records its due date.

## Availability and integrity

Named IANA zones convert to UTC. Windows may span midnight; an override cuts off
previous-day spillover. DST boundary gaps omit that window; ambiguous boundaries
use PostgreSQL's standard-time interpretation, with UTC slots displayed by offset.
Buffers apply on both sides of each appointment. Notice and horizon are rechecked.
Pending/countered requests do not reserve time. An accepted appointment blocks the
creator's whole local calendar day; unavailable dates are returned without a reason or
client data. Acceptance locks the creator row and the database constraint prevents
conflicting reservations across services.
Appointment, deliverable and enquiry acceptance use canonical `CONFIRMED` under
`external-v1`, with type-specific UI labels. Existing pending fixed-price requests
can be accepted under that policy; acceptance never proves payment. Requests can
be cancelled by either party before completion;
creators mark completion, and appointments must have ended. Counters require requester
acceptance. State changes are audited; notification intent is persisted separately.

## Notifications

Both private inboxes have participant-authorized detail routes and unread event
history. Submission records a requester receipt and creator summary; relevant
status changes record further notification intents. Email is the baseline;
verified, opted-in WhatsApp is optional. Exact email links open authenticated
review screens, not mutating GET actions. Notes, answers and private meeting
instructions remain behind authentication.

An atomic outbox, fenced leases and a one-minute background worker keep delivery
independent of browser sessions. Provider failures never lose or undo requests.
Channel flags default OFF until owner setup and live delivery verification;
historical setup backlog is not automatically replayed. See
[Reliable Request Notifications](request-notifications.md) for rollout and safety.

## Explicit limitations

Date Tree does not process payments or mark requests paid. Legacy records and
statuses remain private. Provider adapters and queued intents are not evidence of
live email/WhatsApp delivery; the inbox remains the source of request status.
Auth email delivery still depends on the shared project's SMTP limits and redirect
configuration. Do not alter unrelated Zap application tables or global auth policies.
Group sessions, external calendar sync, payouts, subscriptions and custom domains are
not included. Uploaded replacements are retained (500 files/account; 40/hour);
an owner-authorized, reference-aware cleanup workflow remains future work.

## Verification

Run `npm run check` and `npm run test:db` with local Supabase/Docker available.
The rollback-only pgTAP suite also runs against Zap through the SQL connector.
Its synthetic identities/sessions test database authorization, not real signup,
email verification or browser behaviour. Never count them as authentication E2E.
Browser signup/login/upload/publish/request testing requires a connected browser.
Release reporting must distinguish these checks from database tests and actual
received-email/WhatsApp evidence; do not infer delivery from provider API acceptance.
