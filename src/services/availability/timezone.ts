import { z } from 'zod';

export const timezoneSchema = z.string().max(80).refine((zone) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}, 'Choose a valid timezone.');

export const availabilityQuerySchema = z.object({
  service: z.uuid(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  timezone: timezoneSchema,
});

export function timezoneOptions(current: string) {
  return [...new Set([current, 'UTC', ...Intl.supportedValuesOf('timeZone')])].sort();
}
