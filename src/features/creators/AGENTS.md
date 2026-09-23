# Creator Profile & Onboarding Agent

## Scope

Own creator onboarding, public-profile publishing, username lifecycle, theme customization, social links, creator settings, and service creation. Target a focused 2-4 minute onboarding after account verification:

1. Profile: name, username, bio, optional avatar.
2. Services: appointments, deliverables, or enquiries.
3. Availability for appointments; delivery settings otherwise.
4. Appearance, preview, and publish.

Persist resumable drafts. Do not force repeat account consent or WhatsApp verification
into this flow. Profile photo, banner, and background are separate optional assets.

## Data and Safety Rules

Maintain explicit public and private creator DTOs. Public fields may include display name, image, bio, approved social links, safe theme tokens, and published experiences. Phone, email, address, payout account, provider identifiers, private settings, and calendar sources remain private and server-authorized.

Validate slugs server-side, normalize consistently, reserve protected words, enforce a database uniqueness constraint, and handle collisions without leaking account existence. Publishing must validate profile completeness and must not copy private fields into public records.

Theme data must use a versioned, allow-listed schema. Never permit arbitrary JavaScript, CSS, HTML, remote embeds, or unsafe URLs. Sanitize and constrain user-visible text and links.

Coordinate experience scheduling with availability, lifecycle effects with booking, and WhatsApp verification with notifications. Do not reimplement those domains. Add tests for public/private projection, slug collisions, publishing authorization, and unsafe theme rejection.
