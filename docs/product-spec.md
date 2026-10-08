# Product Specification

## Product purpose and scope

Date Tree gives coaches, businesses, freelancers and creators a mobile-first
service profile to share through a social-media bio or direct link. It coordinates
requests and responses; it is not a dating marketplace or payment processor.
Creators retain control over accepting every request. The existing 18+ requirement
and account consent remain in place.

The current contract is defined by [Service Pages](service-pages.md),
[Booking State Machine](booking-state-machine.md) and
[Reliable Request Notifications](request-notifications.md). These supersede the
original dating-only and paid-booking baseline. Implementation or test availability
does not establish that a provider channel is live.

## People and journeys

- Creators choose a username, profile images, bio, theme and services, configure
  appointment availability where needed, then publish a stable direct link.
- Requesters choose a service, verify their email, supply relevant details and
  explicitly consent to sharing one selected, verified contact method.
- Creators review private requests and accept, decline or propose a new appointment
  time. Requesters respond to proposals and track their own requests.

Three service kinds remain distinct:

| Kind | Request flow | Acceptance result |
| --- | --- | --- |
| Appointment | Select a calculated date/time and optional notes | Confirmed time; conflict protection applies |
| Deliverable | Describe the work; optional preferred delivery date | Delivery deadline and active-capacity limit |
| Enquiry | Submit a brief; optional preferred date | Accepted enquiry; no calendar reservation |

Public pages and service editing contain no prices, “Free” labels, checkout or
payment prompts. Any fees are arranged privately. Acceptance confirms a service
request under `external-v1`, never collection or verification of payment. Preserve
legacy request terms and history privately; do not rewrite them as paid.

## Notifications and privacy

Submission saves a request and both participants' activity history atomically with
notification intent. The requester receives a receipt; the creator receives a
summary and authenticated review links. Subsequent relevant status updates notify
the other participant. Email is the baseline channel, with verified and opted-in
WhatsApp optional. Both private inboxes remain usable when delivery is unavailable.

Creator notifications include only the consented preferred contact; notes, custom
answers and private meeting instructions stay behind authentication. Contact sharing
and WhatsApp notification opt-in are separate. Opening an email or receiving a
provider callback does not mark inbox activity read or accept a request.

## Experience targets and exclusions

Design for 360–430 px screens and social in-app browsers. Keep creator onboarding
simple and service-specific; requesters do not need creator profiles. Expose only
safe availability, never calendar contents or reasons for unavailable dates.

Payments, marketing, conversational chat, automatic request expiry, reminder
campaigns, discovery feeds, matching, swiping and public calendars are outside this
phase. Group sessions, external calendar sync, subscriptions and custom domains are
not part of the current service-page scope.

## Launch decisions still required

Owner-controlled email domain, Resend account/credentials, Twilio production sender,
Verify configuration and approved WhatsApp templates are delivery prerequisites.
Provider costs, terms and upgrades require appropriate owner approval. Finalize
retention/deletion, abuse escalation, cancellation/rescheduling policies and
monitoring ownership before broader launch. Require actual received-message evidence,
not only provider API success, before enabling production channels.
