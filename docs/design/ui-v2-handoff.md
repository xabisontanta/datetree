# Date Tree: UI handoff and protected release baseline

## Responsibilities

Codex owns the request/authentication contracts, migrations, authorization,
notifications, verification and production release. Claude owns presentation in a
separate checkout and submits small commits for review; it does not deploy or merge.
The original checkout and supplied `files.zip` remain untouched. Its patch is an
input for review, not a replacement for current product requirements.

## Branch workflow

The notification implementation is on `feature/reliable-notifications`. After its
checks and checkpoint, `develop` and `design/ui-v2` start at that verified commit.
Use the separate `design/ui-v2` checkout supplied by Codex, not the original dirty
checkout. Do not reset, force-push, switch another agent's branch, or alter `main`.
Commit small UI changes and provide the branch, commit IDs, changed files,
screenshots, test results and unresolved contract change requests. Codex reviews
them against the release baseline before integration.

## Phase A: supported appearance only

Read the root and applicable nested `AGENTS.md` first. Add named presets and wire
them into `AppearanceEditor` in `src/features/creators/profile-editor.tsx`, using
the existing save, preview and publish flow. Test every preset against the current
page schema, selected-state/accessibility and preservation of all non-theme draft
fields. Match the approved concept without introducing unsupported saved values.

Existing tokens:

- Theme: `dark`, `minimal`, `luxury`, `vibrant`, `soft`.
- Background: `solid`, `gradient`, `image`; gradient: `night`, `ocean`, `sunset`.
- Font: `sans`, `serif`, `mono`; buttons: `pill`, `rounded`, `square`.
- Cards: `solid`, `glass`, `outline`; colour scheme: `light`, `dark`.

Preserve profile images, username, services, availability, private details, full
draft documents, revision checks and publishing. Legacy pricing fields may remain
in private drafts for compatibility; never display prices, "Free", checkout or
payment prompts. Public pages coordinate services, not payments.

## Protected contracts and deferred designs

Do not edit `supabase/`, `src/lib/supabase/`, authentication, request server actions,
notification/payment services, environment files, dependencies, hosting or CI.
Keep the existing Zap project and shared Auth SMTP settings. Only the selected,
verified requester contact is shared with explicit consent. WhatsApp is optional
and requires separate verification and notification opt-in in Settings.

Hero layouts, additional fonts or new stored fields need a Codex contract change
request with defaults, migration and old-page compatibility tests **before** UI
implementation. Reviews, review invitations, analytics, tracking, QR/share kits,
marketing and automated campaigns are not part of Phase A. Do not fake backend
success or substitute mock data for working journeys.

## Handoff gate

Run `npm run format:check` and `npm run check`; report any unavailable environment
honestly. Include mobile/desktop, keyboard/focus and empty/error-state screenshots.
Never call a mocked notification or accepted API response actual inbox delivery.
Stop for review when Phase A is ready; leave integration and publishing to Codex.
