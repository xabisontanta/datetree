# Repository Guidelines

## Project Structure & Module Organization

Date Tree is a mobile-first social booking app. Routes and server actions live in `src/app/`; reusable presentation belongs in `src/components/`; feature rules belong in `src/features/`; and Supabase clients and generated database types live in `src/lib/supabase/`. Database migrations and pgTAP checks are under `supabase/migrations/` and `supabase/tests/`. Cross-cutting tests live in `tests/`, while architecture and security decisions are documented in `docs/`.

Read the nearest nested `AGENTS.md` before changing a directory. Keep dependencies flowing from UI to domain services to infrastructure, never the reverse.

## Build, Test, and Development Commands

- `npm install` installs the pinned Node dependencies (Node 22.13+).
- `npm run dev` starts the local Vinext/Next-compatible development server.
- `npm run typecheck` runs strict TypeScript validation.
- `npm run lint` runs Oxlint; `npm run format` applies Oxfmt.
- `npm test` runs Vitest unit and security-contract tests.
- `npm run test:db` runs pgTAP against the local Supabase stack.
- `npm run build` creates the production Cloudflare Sites bundle.
- `npm run check` runs the main pre-PR verification sequence.

## Coding Style & Naming Conventions

Use TypeScript, two-space indentation, single quotes, and an 88-column target. Name React components in PascalCase, functions and variables in camelCase, and route directories in kebab-case. Prefer small feature-focused modules, explicit public DTOs, Zod validation at request boundaries, and server-side authorization. Avoid `any`, duplicated validation, and raw database rows in public responses.

## Testing Guidelines

Name TypeScript tests `*.test.ts` and database tests `*.test.sql`. Add tests for every meaningful authorization, privacy, or state-transition change. Database changes require a timestamped migration plus RLS/grant coverage. Run `npm run check`; when Docker is available, also run `npm run test:db`.

## Security & Product Boundaries

Never expose creator contact details, booking data, calendars, payout data, or provider secrets. Consent must precede payment. Do not add discovery feeds, matching, swiping, or public calendar data. Browser code may use only Supabase publishable configuration.

## Commit & Pull Request Guidelines

The initial history does not yet establish a convention. Use Conventional Commits such as `feat(auth): add signup consent validation`. PRs should explain scope and risk, link issues, identify migrations or environment changes, include UI screenshots when relevant, and list verification commands run.
