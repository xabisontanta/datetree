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
The same checksum and counts matched immediately after migration/release. The
owner later cancelled both original requests from their own creator session and
explicitly confirmed these cancellations. Their original snapshots are unchanged;
the legitimate cancellations are preserved, not restored by QA.

## Automated evidence

- `npm run check`: strict TypeScript, Oxlint, 223 Vitest tests in 29 files and
  production Vinext build passed.
- `npm run format:check`: passed with explicit LF formatting. Formatting-only
  changes do not alter legacy booking/UI behavior; the three original Twilio
  files have no Git content diff in this checkout.
- Fresh, isolated Docker stack: all 10 release migration files applied; all 164
  pgTAP tests in three suites passed. The follow-up foreign-key index migration
  brings the repository/local database to 11 versions; all 166 pgTAP checks pass.
  The original local stack was not reset. Both notification migrations are also
  applied to Zap. The index follow-up changes no rows, policies or channel flags.
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
The actual [GitHub run for the release checkpoint](https://github.com/xabisontanta/datetree/actions/runs/37724683795)
completed successfully: both application and fresh-database jobs passed.

## Live release and browser evidence

Sites v12 is live at [Date Tree](https://date-tree-social-booking.xabison.chatgpt.site),
from `f97af43876ae556372e52e6e7b60dc9ac6372d8c`. GitHub `main` remains
`b361140279e16c99ab946c8c50e7d7f6928056e3`; publishing to the separate Sites
source repository does not merge GitHub branches. `develop` and `design/ui-v2`
provide the preserved baseline and isolated presentation lane.

Chrome checks used two existing, authorized disposable accounts and real
password sign-in, without account resets or authentication bypass:

- Existing draft services, appearance and private images survived release;
  public QA publishing worked without price or "Free" labels.
- An email-only deliverable and enquiry were submitted through the public form,
  with explicit sharing/age/request consent, review and named in-app receipts.
- Requester access to the creator-only detail returned 404. Logged-out action
  links preserved the exact request/intent through sign-in. Both acceptance and
  decline GETs left requests pending until authenticated confirmation.
- Acceptance produced the expected three-day delivery deadline and matching
  requester activity. The unread link cleared after opening the private detail.
  Creator contact was the selected verified email with a working `mailto:` URL.
- Decline and completion are tested separately from notification delivery. The
  interface correctly says "Email: waiting for provider setup", not delivered.
- The published disposable page was restored to its original unpublished state;
  its draft and existing images were retained. Synthetic requests are kept
  privately as closed QA evidence, not permanently deleted through privileged SQL.
- Notification settings show verified email and optional WhatsApp separately;
  no live number, verification code or provider account was fabricated.

Private synthetic references: `3adc44ba-127a-485e-95be-ccebfd996d83`
(deliverable) and `eb08b70e-5489-44d9-91f8-4844e24ddc7f` (enquiry).
Local screenshots are in ignored `outputs/notification-*-qa.png`, not public
Git history. These browser checks do not claim receipt of any provider email.

## Background transport

The internal worker secret was generated securely and stored in Edge secrets
and Vault, without a plaintext file, command-line value or checked-in SQL.
The Vault worker URL and `DATE_TREE_APP_URL` are configured. An authenticated
worker POST and a separate database-initiated pg_net probe both returned HTTP
200 with `processed: 0, providerConfigured: false`. The namespaced minute job
is active and has successful runs. With both channel flags OFF, scheduled
polls intentionally exit before HTTP dispatch; this is not a retry-delivery test.
Unauthenticated worker/Verify POSTs reject access. Provider webhook endpoints
fail closed until their signature secrets are configured.

## Remaining launch gates

Status channels default OFF, with no retrospective contact sharing or replay of
the historical unconfigured backlog. Owner-controlled sending domain, Resend
account/secure credentials, signed webhook setup and real received email proof
are still required. Twilio production sender/Verify registration, approved
utility templates and explicitly authorized live test numbers are also required.
An existing Twilio account alone does not meet these requirements.

Mocked worker tests and a successful provider API response are not inbox proof.
Fresh magic-link/signup/recovery browser journeys were not rerun in this phase;
their compatibility is covered by repository checks and the preserved existing
flows. Real received receipts/status emails, background provider retries with
browsers closed and production WhatsApp evidence remain launch gates. Do not
describe disabled channels or the successful internal transport as live delivery.
