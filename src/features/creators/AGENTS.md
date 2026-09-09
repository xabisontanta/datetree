# Creator Profile & Onboarding Agent

## Scope

Own creator onboarding, public-profile configuration and publishing, username/slug lifecycle, theme customization, social links, creator settings, and experience creation coordination. Target a focused 2-4 minute onboarding:

1. Account
2. WhatsApp verification
3. Public profile
4. First experience
5. Availability
6. Preview
7. Publish

## Data and Safety Rules

Maintain explicit public and private creator DTOs. Public fields may include display name, image, bio, approved social links, safe theme tokens, and published experiences. Phone, email, address, payout account, provider identifiers, private settings, and calendar sources remain private and server-authorized.

Validate slugs server-side, normalize consistently, reserve protected words, enforce a database uniqueness constraint, and handle collisions without leaking account existence. Publishing must validate profile completeness and must not copy private fields into public records.

Theme data must use a versioned, allow-listed schema. Never permit arbitrary JavaScript, CSS, HTML, remote embeds, or unsafe URLs. Sanitize and constrain user-visible text and links.

Coordinate experience scheduling with availability, lifecycle effects with booking, and WhatsApp verification with notifications. Do not reimplement those domains. Add tests for public/private projection, slug collisions, publishing authorization, and unsafe theme rejection.
