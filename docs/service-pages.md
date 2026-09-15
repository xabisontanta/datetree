# Service Pages: Phase 2

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
- Enquiries: project briefs/quotes, without an appointment or payment commitment.

Visitors verify an email through Supabase's normal passwordless flow; they do not
complete creator onboarding. Requests snapshot service terms, record age/sharing
consent, and are deduplicated by requester and idempotency key. Creators can see the
consenting client's email in their inbox. Private meeting/next-step details become
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
Scheduled, deliverable and enquiry acceptance use canonical `CONFIRMED`, with
type-specific UI labels. Free work can be cancelled by either party before completion;
creators mark completion, and appointments must have ended. Counters require requester
acceptance. State changes are audited; notification intent is persisted separately.

## Explicit limitations

Payment processing and status notifications are not connected. Fixed-price requests
can be accepted, but payment must be arranged directly and Date Tree never represents
it as collected. There is no fake payment or notification success. The inbox is the
source of status.
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
Browser signup/login/upload/publish/request testing still requires a connected
browser. No browser was available during the initial implementation session.
