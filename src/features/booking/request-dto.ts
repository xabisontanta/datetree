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
