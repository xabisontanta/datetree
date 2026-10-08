# Reliable notifications: verification and release record

## Preserved baseline

The work starts at `b361140279e16c99ab946c8c50e7d7f6928056e3` on an isolated
`feature/reliable-notifications` checkout. The original checkout, its local
Twilio changes and Claude's supplied archive are not overwritten. Zap remains
the backend; no replacement project, data reset or shared Auth SMTP change.

Read-only live preflight on 8 October: two original requests (one confirmed, one
pending), eight creator profiles, six published pages, five historical
`provider_not_configured` deliveries. Preservation checksum:
`b47a88e163c0bce15f49e52da56ec4ee`, computed as
`md5(string_agg(id::text || status || snapshot::text, '' order by id))`.
Compare that same expression after the compatible migration.

## Automated evidence

- `npm run check`: strict TypeScript, Oxlint, 223 Vitest tests in 29 files and
  production Vinext build passed.
- `npm run format:check`: passed with explicit LF formatting. Formatting-only
  changes do not alter legacy booking/UI behavior; the three original Twilio
  files have no Git content diff in this checkout.
- Fresh, isolated Docker stack: all 10 exact migration files applied; all 164
  pgTAP tests in three suites passed. The original local stack was not reset.
- All four Edge entrypoints passed Deno 2.9.6 checks with pinned SDKs.
- Real concurrent acceptance on the isolated replay database passed: two
  independent authenticated transactions waited at the same creator-row lock
  barrier; exactly one confirmed/reserved and the other remained pending and
  unreserved with an availability-conflict error. This is database concurrency
  evidence, not browser or inbox-delivery evidence.
- Notification migration SHA256:
  `D3F22CFD77D0C1F56F52F3BC72E2CA4FDB4055CB1B85690D2C1701B4A2CEC1FB`.

Coverage includes selected-contact isolation, revoked consent, number changes,
OTP limits, invalid signatures, duplicate/out-of-order callbacks, fenced leases,
uncertain WhatsApp sends, retry bounds, pilot allowlist rechecks, activity/read
separation, safe auth destinations and immutable legacy fixed/quoted snapshots.

## Supply chain and CI

Compatible overrides patch tinypool, sharp, undici, fast-uri and source-map-js.
`npm audit` no longer reports critical or moderate findings; six high findings
remain in the Vinext build-tool dependency chain through unpatched braces.
Do not apply audit's proposed framework downgrades automatically. Track the
upstream fix separately and keep build tooling away from untrusted glob input.

CI runs application checks and a fresh local database for PRs/main/develop. It
has read-only GitHub permissions, no production secrets and no deployment step.
A workflow definition is not evidence of a completed GitHub run.

## Remaining launch gates

Status channels default OFF, with no retrospective contact sharing or replay of
the historical unconfigured backlog. Owner-controlled sending domain, Resend
account/secure credentials, signed webhook setup and real received email proof
are still required. Twilio production sender/Verify registration, approved
utility templates and explicitly authorized live test numbers are also required.
An existing Twilio account alone does not meet these requirements.

Mocked worker tests and a successful provider API response are not inbox proof.
Browser submission/action/inbox checks, real received receipts/status emails,
background retries with browsers closed and production WhatsApp evidence must
be recorded separately. Do not describe disabled channels as launched delivery.
