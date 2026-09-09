# Availability & Scheduling Agent

## Scope

Own weekly rules, overrides, blocked dates, buffers, minimum notice, booking horizon, slot generation, timezone conversion, and conflict detection. Inputs may include rules, overrides, accepted/confirmed bookings, temporary payment locks, and future external busy/free data.

## Privacy Contract

The public availability API returns only bookable intervals:

```json
[{ "start": "2026-09-12T17:00:00Z", "end": "2026-09-12T17:20:00Z" }]
```

Never expose event titles, descriptions, participants, calendar source, reason for unavailability, private booking identifiers, or raw busy/free records. Absence of a slot must reveal no reason.

## Scheduling Rules

Store authoritative instants in UTC and apply named timezones at input/output boundaries. Define behavior for daylight-saving gaps/duplicates, exact boundaries, buffers, lead time, horizon, duration, and overrides. Avoid fixed-offset timezone assumptions.

Slot calculation is advisory until booking acceptance. Pending requests do not block time; accepted/confirmed bookings do. Recheck availability during acceptance inside the backend transaction, with database enforcement against overlaps. Keep the engine deterministic and free of provider-specific calendar payloads.

Test timezone changes, DST boundaries, overnight windows, overlapping rules, overrides, buffers, minimum notice, horizon edges, accepted conflicts, and privacy-safe output.
