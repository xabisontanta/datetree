import { z } from 'zod';
import { publicServiceSchema } from '@/features/creators/page-schema';
export const requestSchema = z.object({
  serviceId: z.uuid(),
  idempotencyKey: z.uuid(),
  serviceSnapshot: publicServiceSchema,
  name: z.string().trim().min(1).max(80),
  notes: z.string().trim().max(2000),
  answers: z.array(z.string().trim().max(1000)).max(3),
  start: z.iso.datetime({ offset: true }).or(z.literal('')),
  preferredDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .or(z.literal('')),
  timezone: z.string().max(80),
  adult: z.literal(true),
  consent: z.literal(true),
});
export type RequestInput = z.infer<typeof requestSchema>;
export const transitionSchema = z.object({
  id: z.uuid(),
  operation: z.enum([
    'accept',
    'decline',
    'counter',
    'accept_counter',
    'cancel',
    'complete',
  ]),
  version: z.number().int().positive(),
  start: z.iso.datetime({ offset: true }).optional(),
});
export const statusLabels: Record<string, string> = {
  PENDING_CREATOR: 'Awaiting creator response',
  COUNTER_PROPOSED: 'New time proposed',
  CONFIRMED: 'Appointment confirmed',
  IN_PROGRESS: 'Deliverable in progress',
  ENQUIRY_ACCEPTED: 'Enquiry accepted — discuss your quote',
  DECLINED: 'Declined',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
  EXPIRED: 'Expired',
  ACCEPTED_AWAITING_PAYMENT: 'Awaiting payment',
};
