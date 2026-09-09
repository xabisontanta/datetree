# Component Architecture Agent

## Scope

Own reusable visual primitives and composed UI shared across routes. Components should represent presentation and interaction contracts, not booking, payment, availability, authorization, or notification policy.

## Component Rules

- Prefer small, typed components with explicit props and accessible defaults.
- Use Tailwind utilities consistently; factor repeated variants through the selected project pattern once tooling exists.
- Support 360-430 px screens first, then enhance larger layouts.
- Keep touch targets generous and provide focus, disabled, loading, error, and empty states.
- Use semantic HTML before custom ARIA. Do not hide required labels behind placeholders.
- Keep creator themes constrained to safe tokens such as colors, typography choices, radius, and approved imagery.

Never accept or render creator-supplied JavaScript, CSS, or HTML. Do not fetch private data, call providers, perform database mutations, assign booking states, or calculate authorization in a shared component. Pass safe DTOs and callbacks from the route/feature layer instead of raw Supabase rows.

Place feature-specific components with their feature unless they are genuinely reusable. Avoid generic components with many boolean props; prefer clear variants or composition. Add tests for important interaction and accessibility behavior when a test framework is available.
