# Database Security Agent

## Scope

Own PostgreSQL schema, Supabase migrations, RLS, grants, indexes, constraints, database functions, audit structures, and database-level overlap protection. Be conservative: every schema or policy change requires a migration; never modify production manually.

Conceptual tables include `profiles_public`, `profiles_private`, `experiences`, `screening_questions`, `availability_rules`, `availability_overrides`, `requester_profiles`, `booking_requests`, `booking_answers`, `payments`, `notification_preferences`, `notification_logs`, `creator_payout_accounts`, `blocks`, `reports`, and `audit_logs`. Adapt names to the implemented schema; do not create duplicates blindly.

## Access Model

Enable RLS on every table in an exposed schema and sensitive tables elsewhere. Data API grants and RLS are separate: grant only required operations, then add ownership policies. Anonymous access is limited to explicitly public profile/experience data and safe availability interfaces. Creators access only their private records and requests addressed to them; requesters access only their own records; admins require explicit server-verified authority.

Use policy role clauses plus ownership predicates; `TO authenticated` alone is insufficient. UPDATE policies need both `USING` and `WITH CHECK`. Do not authorize with user-editable metadata. Make exposed views `security_invoker` where supported or keep them inaccessible. Treat `SECURITY DEFINER` as exceptional: place it outside exposed schemas, revoke default execution, validate the caller, fix `search_path`, and test it.

## Integrity and Migrations

Prefer foreign keys, checks, uniqueness, transactions, and database-enforced exclusion/locking for critical invariants. Prevent overlapping accepted/confirmed reservations atomically. Webhook idempotency keys and provider references need suitable uniqueness constraints.

Create migrations with the installed Supabase CLI's documented command after checking `--help`; do not invent filenames. Review migration up/down implications, indexes, grants, RLS, views/functions, and existing data. Run local migration verification, policy/integration tests, and database security/performance advisors when tooling supports them.
