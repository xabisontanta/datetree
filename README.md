# Date Tree

Date Tree is a mobile-first social booking product for creators who want to share one
link, present services, receive requests, and decide who gets access to their time.
Creators can publish a branded profile, social links, services, availability, and a
private request inbox.

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

## Notification providers

Request transitions always commit before notification delivery. The Supabase
`dt-notification-worker` sends queued email through Resend and WhatsApp through Sent
when its server-side secrets are configured:

- `RESEND_API_KEY` and `NOTIFICATION_EMAIL_FROM`
- `SENT_DM_API_KEY` and `SENT_TEMPLATE_MAP`
- Optional `SENT_PROFILE_ID`, `SENT_BASE_URL`, and `DATE_TREE_APP_URL`

`SENT_TEMPLATE_MAP` is a JSON object mapping logical names such as
`BOOKING_CONFIRMED` to approved provider template names. Configure these with
`supabase secrets set`; never place them in browser variables or commit them. A provider
acceptance is tracked as `accepted`, not falsely reported as delivered.

## Product boundaries

Implemented now: responsive authentication, creator page building and publishing,
social links, services, availability, booking requests, lifecycle actions, durable
notification intents, explicit public DTOs, RLS policies, and privacy tests. Online
payments and marketplace-style discovery are not represented as available.

See `docs/product-spec.md`, `docs/architecture.md`, and `docs/security.md` before making
cross-domain changes. Directory-specific guidance is provided by nested `AGENTS.md`
files.
