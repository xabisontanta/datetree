import { z } from 'zod';
import { publicServiceSchema } from '@/features/creators/page-schema';
export const REQUEST_COLUMNS =
  'id,snapshot,requester_name,notes,answers,preferred_date,start_at,end_at,visitor_timezone,status,version,created_at,accepted_at,delivery_due_at' as const;
export const requestDtoSchema = z.object({
  id: z.uuid(),
  snapshot: publicServiceSchema,
  requester_name: z.string(),
  notes: z.string(),
  answers: z.array(z.string()),
  preferred_date: z.string().nullable(),
  start_at: z.string().nullable(),
  end_at: z.string().nullable(),
  visitor_timezone: z.string(),
  status: z.string(),
  version: z.number(),
  created_at: z.string(),
  accepted_at: z.string().nullable(),
  delivery_due_at: z.string().nullable(),
});
export type RequestDTO = z.infer<typeof requestDtoSchema>;
export const notificationStatusDtoSchema = z.object({
  request_id: z.uuid(),
  event_id: z.number(),
  recipient_role: z.enum(['creator', 'requester']),
  channel: z.enum(['email', 'whatsapp']),
  template_name: z.string(),
  status: z.string(),
  attempts: z.number(),
  updated_at: z.string(),
});
export type NotificationStatusDTO = z.infer<typeof notificationStatusDtoSchema>;

/** RSC props must be plain objects; Object.groupBy returns a null prototype. */
export function groupNotificationStatuses(statuses: NotificationStatusDTO[]) {
  const groups = new Map<string, NotificationStatusDTO[]>();
  for (const status of statuses) {
    const group = groups.get(status.request_id) ?? [];
    group.push(status);
    groups.set(status.request_id, group);
  }
  return Object.fromEntries(groups);
}

export function latestNotificationStatusesByChannel(statuses: NotificationStatusDTO[]) {
  const latest = new Map<NotificationStatusDTO['channel'], NotificationStatusDTO>();

  // dt_notification_statuses returns newest events first, so preserve the first
  // status encountered for each channel instead of overwriting it with an older one.
  for (const status of statuses) {
    if (!latest.has(status.channel)) latest.set(status.channel, status);
  }

  return [...latest.values()];
}

export function notificationStatusLabel(status: NotificationStatusDTO) {
  const channel = status.channel === 'email' ? 'Email' : 'WhatsApp';
  const state: Record<string, string> = {
    provider_not_configured: 'waiting for provider setup',
    queued: 'queued',
    processing: 'sending',
    accepted: 'accepted by provider',
    delivered: 'delivered',
    retry_scheduled: 'retry scheduled',
    permanent_failure: 'could not be delivered',
  };
  return `${channel}: ${state[status.status] ?? 'status unavailable'}`;
}
export function requestStatusLabel(r: RequestDTO) {
  if (r.status === 'CONFIRMED')
    return r.snapshot.kind === 'scheduled'
      ? 'Appointment confirmed'
      : r.snapshot.kind === 'deliverable'
        ? 'Delivery in progress'
        : 'Enquiry accepted';
  const labels: Record<string, string> = {
    PENDING_CREATOR: 'Awaiting creator response',
    COUNTER_PROPOSED: 'New time proposed',
    DECLINED: 'Declined',
    CANCELLED: 'Cancelled',
    COMPLETED: 'Completed',
    EXPIRED: 'Expired',
    ACCEPTED_AWAITING_PAYMENT: 'Awaiting payment',
  };
  return labels[r.status] ?? r.status;
}
