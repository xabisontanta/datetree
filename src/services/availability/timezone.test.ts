import { describe, expect, it } from 'vitest';
import { availabilityQuerySchema, timezoneOptions, timezoneSchema } from './timezone';

describe('visitor timezone validation', () => {
  it('accepts named zones and rejects unknown zones', () => {
    for (const zone of ['UTC', 'Africa/Johannesburg', 'Pacific/Kiritimati', 'America/Los_Angeles']) expect(timezoneSchema.safeParse(zone).success).toBe(true);
    expect(timezoneSchema.safeParse('Not/AZone').success).toBe(false);
  });
  it('requires an explicit valid month and visitor timezone', () => {
    const query = { service: '11000000-0000-4000-8000-000000000001', month: '2026-09', timezone: 'UTC' };
    expect(availabilityQuerySchema.safeParse(query).success).toBe(true);
    expect(availabilityQuerySchema.safeParse({ ...query, month: '2026-13' }).success).toBe(false);
    expect(availabilityQuerySchema.safeParse({ service: query.service, month: query.month }).success).toBe(false);
  });
  it('includes the detected timezone even when it is an alias', () => {
    expect(timezoneOptions('Asia/Calcutta')).toContain('Asia/Calcutta');
    expect(new Set(timezoneOptions('UTC')).size).toBe(timezoneOptions('UTC').length);
  });
});
