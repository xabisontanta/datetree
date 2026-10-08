import { z } from 'zod';

export const preferredContactSchema = z.object({
  request_id: z.uuid(),
  kind: z.enum(['email', 'whatsapp']),
  address: z.string().min(3).max(320),
});
export type PreferredContactDTO = z.infer<typeof preferredContactSchema>;

export function contactHref(contact: PreferredContactDTO) {
  return contact.kind === 'whatsapp'
    ? /^\+[1-9]\d{7,14}$/.test(contact.address)
      ? `https://wa.me/${contact.address.slice(1)}`
      : null
    : /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(contact.address)
      ? `mailto:${contact.address}`
      : null;
}

export const activitySchema = z.object({
  request_id: z.uuid(),
  event_id: z.number(),
  status: z.string(),
  created_at: z.string(),
  unread: z.boolean(),
});
export type ActivityDTO = z.infer<typeof activitySchema>;
