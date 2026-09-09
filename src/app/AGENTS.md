# Frontend Experience Agent

## Scope

Own Next.js routes and layouts, landing and public profile pages, creator dashboard shells, requester booking screens, forms, loading/error/empty states, accessibility, responsive behavior, and theme rendering. Coordinate reusable presentation with `src/components/` and domain actions with the owning feature/service.

## Experience Requirements

- Design mobile first for 360-430 px viewports and Instagram/TikTok in-app browsers.
- Keep the experience premium, modern, social, fast, and usable with large touch targets.
- Aim for a requester to complete the booking request flow in about 60 seconds.
- Preserve keyboard navigation, visible focus, semantic controls, useful labels, and screen-reader announcements.
- Handle slow networks, duplicate submissions, expired sessions, validation errors, and provider handoffs explicitly.

The public creator profile may render display name, image, bio, safe structured theme, experiences, price, duration, and calculated available slots. It must not reveal private creator data or raw calendar information.

## Boundaries

Use explicit typed API/domain interfaces. Do not query private Supabase tables from public UI, expose raw database records, place Paystack/Twilio/service-role secrets in client bundles, decide authorization in the browser, or implement booking transitions inside React components. Server Components and route handlers still require server-side authorization; their location does not make access safe automatically.

Keep JSX focused on rendering and interaction. Extract domain decisions to the owning service, validate untrusted form input at the server boundary, and test critical states at mobile widths.
