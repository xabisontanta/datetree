export const TWILIO_WHATSAPP_TEMPLATE_NAMES = {
  REQUEST_RECEIVED: 'dt_request_received',
  NEW_BOOKING_REQUEST: 'dt_new_booking_request',
  COUNTER_OFFER: 'dt_counter_offer',
  BOOKING_CONFIRMED: 'dt_booking_confirmed',
  BOOKING_DECLINED: 'dt_booking_declined',
  BOOKING_CANCELLED: 'dt_booking_cancelled',
  BOOKING_COMPLETED: 'dt_booking_completed',
  BOOKING_STATUS_UPDATED: 'dt_booking_status_updated',
} as const;

const E164_PATTERN = /^\+\d{8,15}$/;
const CONTENT_SID_PATTERN = /^HX[A-Za-z0-9]{32}$/;

export function normalizeWhatsAppAddress(value: string) {
  const trimmed = value.trim();
  const raw = trimmed.toLowerCase().startsWith('whatsapp:')
    ? trimmed.slice('whatsapp:'.length).trim()
    : trimmed;
  return `whatsapp:${normalizeE164(raw)}`;
}

function normalizeE164(value: string) {
  if (E164_PATTERN.test(value)) return value;
  const digits = value.replace(/\D/g, '');
  return `+${digits}`;
}

export function parseTwilioContentSidMap(raw: string | undefined) {
  if (!raw?.trim()) return {} as Record<string, string>;
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError('invalid_template_configuration');
  }
  return Object.fromEntries(
    Object.entries(parsed).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === 'string' && CONTENT_SID_PATTERN.test(entry[1]),
    ),
  );
}
