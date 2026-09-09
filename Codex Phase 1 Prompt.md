Read `docs/product-spec.md` completely before making changes.

We are starting Phase 1 of the MVP.

For this phase, build only the application foundation:

1. Initialize/inspect the Next.js + TypeScript + Tailwind architecture.
2. Establish a clean folder structure.
3. Configure Supabase client/server utilities.
4. Create authentication architecture.
5. Create initial PostgreSQL/Supabase database migrations.
6. Create public/private creator profile separation.
7. Create the initial RLS policies.
8. Create `.env.example`.
9. Create the base responsive layout and design system.
10. Create a minimal landing page.
11. Add README setup instructions.
12. Add tests proving anonymous users cannot access private creator information.

Do NOT implement Paystack or Twilio yet.

Do NOT build the booking UI yet.

Do NOT build secondary features.

Before writing code, inspect the repository and tell me what already exists and what you intend to change.

After implementation:

- run type checking
- run linting
- run tests
- fix failures
- summarize files created/modified
- summarize database migrations
- explain how I can run and verify Phase 1 locally

Follow `docs/product-spec.md` as the source of truth.