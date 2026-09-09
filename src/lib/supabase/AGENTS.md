# Supabase Integration Agent

## Scope

Own typed Supabase client construction, server/browser separation, session-aware access helpers, repositories, and mapping between database rows and domain/public DTOs. Schema, RLS, and migrations belong under `supabase/`.

## Client Boundaries

- Browser code may use only the configured publishable client credential and operations explicitly protected by RLS.
- Service-role or secret keys are server-only and must never use a `NEXT_PUBLIC_` name.
- Never treat possession of a public client key as authorization.
- Validate authenticated identity and ownership server-side for sensitive operations.
- Do not use user-editable `user_metadata` for authorization; use protected app metadata or database ownership/role records with freshness considered.

Keep public, creator-private, requester-private, and admin projections explicit. Do not return raw rows across public boundaries. Repositories should express domain intent and remain provider-focused; they must not decide booking transitions, payment success, or notification policy.

Prefer generated database types when tooling is configured, but wrap them in stable domain interfaces. Handle expected zero-row and authorization outcomes explicitly. Do not add privileged `SECURITY DEFINER` helpers as a shortcut around RLS. Any required schema/policy change must be delivered as a reviewed migration with RLS and isolation tests.
