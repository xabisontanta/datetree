# Architecture

## System shape and ownership

Vinext's Next-compatible App Router, React, strict TypeScript and Tailwind provide
the mobile-first UI. The existing Supabase Zap project supplies PostgreSQL, Auth,
Storage and RLS. Sites hosts the production Cloudflare Worker. Resend and Twilio
are notification adapters, not authorities for request status.

Dependencies flow from UI to application validation/authorization, then domain
rules and infrastructure. Routes/server actions live in `src/app/`, feature rules
in `src/features/`, provider adapters in `src/services/notifications/`, and Supabase
clients/types in `src/lib/supabase/`. Read the nearest `AGENTS.md` before changes.

| Area | Owns | Must not own |
| --- | --- | --- |
| UI | Rendering, interaction, accessibility | Authorization or authoritative state transitions |
| Requests | Actor/version checks, lifecycle and service-specific acceptance | Provider signatures or delivery status |
| Availability | Safe slots, buffers and conflict checks | Public calendar contents |
| Notifications | Templates, delivery leases, retries and signed callbacks | Request acceptance or inbox read state |
| Supabase | Persistence, RLS, constraints and atomic request/event/outbox writes | Public serialization or provider policy |

Date Tree coordinates requests, not payments. Retained legacy payment-related
modules/data are outside this phase; they must not reintroduce public prices,
checkout or paid-status transitions.

## Public and private boundaries

Public DTOs expose only the published profile, price-less service definitions and
safe calculated availability. Draft changes do not affect the published snapshot.
Never serialize raw database rows or reasons for unavailable time.

Sensitive routes validate a live session and ownership server-side; RLS and
column grants also protect direct Data API access. Contact/preferences and delivery
internals live in private tables. Creator contact DTOs contain only the requester's
selected, consented, currently verified method, not an alternate email. Only
trusted Edge adapters use service-role credentials.

Requester email verification uses existing Auth without creator onboarding.
Password/magic-link destinations are validated same-origin paths. Individual
request routes preserve the exact destination through authentication; email intents
are review-only GETs, followed by authorized versioned POST actions.

## Service and notification sequence

1. A verified requester submits a service-specific request and explicit contact
   consent. Request, event and durable notification intents commit together.
2. Best-effort dispatch attempts the receipt and creator summary after commit.
   Both private inboxes remain the source of request status.
3. Creator acceptance or requester counter acceptance rechecks slots/capacity under
   creator/request locks and enters `CONFIRMED` under `external-v1`.
4. The transaction records activity and relevant status notices. It never records
   fees as paid; arrangements occur privately.
5. The namespaced one-minute Supabase Cron job invokes the same Edge worker using
   pg_net and Vault-protected authentication, independent of browser sessions.
6. Fenced claims freeze provider payloads and deduplicate event/recipient/channel
   sends. Signed provider callbacks update delivery only; opening request details
   marks viewed activity read through a separate participant-authorized API.

Email uses Resend HTML/plain text and a stable idempotency key. WhatsApp requires
verified opt-in and approved Twilio utility templates; no free-form fallback is
allowed. Bounded email retries and ambiguous WhatsApp reconciliation are described
in [Reliable Request Notifications](request-notifications.md).

## Data, time and rollout

Store authoritative timestamps in UTC and retain named IANA zones for display and
availability rules. Appointment reservations use database conflict protection;
deliverable capacity and enquiry acceptance stay separate. Legacy snapshots are
private and immutable; public projections remove pricing without rewriting history.

Channel flags default OFF and require first activation timestamps. Do not replay
historical provider-not-configured jobs. Consent revocation, address changes and
obsolete unsent notices suppress delivery while preserving activity history.
Keep shared Zap Auth SMTP and unrelated application resources unchanged.

## Configuration and verification

Dependencies/lockfiles are pinned. `npm run check` runs types, lint, Vitest and the
production build; `npm run test:db` requires local Supabase/Docker. Release evidence
must distinguish automated/mock checks, database checks and live browser/inbox
delivery. A successful provider API response is not inbox delivery proof.

`.openai/hosting.json` identifies the existing Sites project. Publish a bundle from
the exact pushed source commit and preserve its audience. Keep secret names only
in `.env.example`; never commit credentials, disposable accounts or test output.
Browser code receives publishable configuration only. RSC props must be plain DTOs;
`Object.groupBy` null-prototype results must be converted before client boundaries.
