# DataTree Phase 2 — Database Foundation (integration notes)

## What's in this drop
- `supabase/migrations/20260911000000_phase2_multi_vertical_booking.sql`
  Profile columns (username, bio, avatar/wall URLs, theme, category, timezone,
  buffer), `services`, `availability_rules`, `blocked_dates`,
  `booking_requests` (with an exclusion constraint that makes double-booking
  impossible), `analytics_events`, RLS policies, public DTO views, and two
  RPCs: `generate_time_slots` and `submit_booking_request`.
- `supabase/tests/phase2_privacy_tests.sql` — pgTAP privacy + behavior suite.
- `supabase/seed.sql` — 5 demo creators (one per category), services,
  weekday availability, one sample request.

## BEFORE you apply — 2-minute reconciliation
This was built from the README only. Check against your Phase 1 migration:
1. **Table/column names.** The migration assumes `public.profiles` with
   `id` + `is_public`. All added columns use `ADD COLUMN IF NOT EXISTS`,
   so renames are safe — but if your profiles table is named something else
   (e.g. `creators`), do a find/replace first.
2. **Seed file.** It inserts `display_name` on profiles. If Phase 1 named it
   differently, adjust that one column in `seed.sql`.
3. **Public DTO pattern.** If Phase 1 already exposes a profile DTO view,
   merge `public_creator_profiles` into it rather than running both.

## Apply locally
```
npm exec supabase db reset          # applies all migrations + seed
npm run test:db                     # must pass all 14 pgTAP assertions
npm run check                       # typecheck, lint, unit tests, build
```

## Hand-off to Codex for the UI
The migration + tests here replace the schema/RPC half of the Phase 2 prompt.
Feed Codex: (1) this migration, (2) the original Phase 2 prompt minus its
"DATA MODEL / RLS" sections, and (3) tell it to build the onboarding,
dashboard, public profile page, and booking stepper against the
`public_services` / `public_creator_profiles` views and the two RPCs.
