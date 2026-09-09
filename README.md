# Date Tree

Date Tree is a mobile-first social booking product for creators who want to share one
link, review requests, and decide who gets access to their time. This repository is at
Phase 1: application foundations, authentication, public/private creator profiles, and
database privacy controls.

## Stack

- Vinext's Next-compatible App Router runtime, React 19, and TypeScript
- Tailwind CSS 4 with local UI primitives
- Supabase Auth and PostgreSQL with row-level security
- Vitest, pgTAP, Oxlint, and Oxfmt
- Cloudflare-backed OpenAI Sites hosting

## Local setup

Requirements: Node.js 22.13 or newer. Docker is also required to run the local Supabase
stack and database tests.

```bash
npm install
cp .env.example .env.local
npm exec supabase start
npm exec supabase db reset
npm run dev
```

Copy the local API URL and publishable key reported by Supabase into `.env.local`. Never
place a secret or service-role key in a `NEXT_PUBLIC_*` variable. The application opens
at `http://localhost:3000` by default.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run typecheck` | Validate strict TypeScript |
| `npm run lint` | Run Oxlint |
| `npm run format:check` | Check Oxfmt formatting |
| `npm test` | Run TypeScript unit and security tests |
| `npm run test:db` | Run pgTAP against local Supabase |
| `npm run build` | Create the production Sites bundle |
| `npm run check` | Run typecheck, lint, unit tests, and build |

## Phase 1 boundaries

Implemented now: responsive landing and auth screens, request-scoped Supabase clients,
creator profile provisioning, explicit public DTOs, migrations, grants, RLS policies,
and privacy tests. Booking UI, payments, WhatsApp delivery, and marketplace-style
discovery are intentionally outside this phase.

See `docs/product-spec.md`, `docs/architecture.md`, and `docs/security.md` before making
cross-domain changes. Directory-specific guidance is provided by nested `AGENTS.md`
files.
