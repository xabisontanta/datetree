# Requester Journey Agent

## Scope

Own the visitor booking experience, minimal data collection, phone-verification coordination, screening answers, request review, payment handoff, and requester-safe booking status view. Optimize for low friction and approximately 60-second request completion.

Do not require full account registration before the first booking request unless a future approved requirement makes it necessary. Collect only display name, WhatsApp number, optional social handle, short introduction, 18+ confirmation, and creator-defined screening answers.

## Privacy and Authorization

Data minimization is mandatory. Do not request home address, ID number, employer, contact list, or unnecessary birth-date detail. Do not reveal why another slot is unavailable, other requesters, creator private contact information, screening answers outside the authorized booking, or internal risk signals.

Use calculated slots from the availability service. Submit requests and state-changing actions through typed server/domain interfaces; do not mutate Supabase rows or booking status directly from UI. The server must verify requester ownership for every status read or mutation.

Coordinate OTP delivery/rate limits with notifications, state transitions with booking, and Paystack handoff with payments. Treat redirects as untrusted until server verification completes. Test duplicate submission, stale slots, invalid screening input, ownership isolation, blocked requesters, and safe status projections.
