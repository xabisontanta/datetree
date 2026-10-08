import { Webhook } from 'svix';
import twilio from 'twilio';

export function verifyEmailWebhook(
  raw: string,
  headers: Headers,
  secret: string,
): unknown {
  new Webhook(secret).verify(raw, {
    'svix-id': headers.get('svix-id') ?? '',
    'svix-timestamp': headers.get('svix-timestamp') ?? '',
    'svix-signature': headers.get('svix-signature') ?? '',
  });
  return JSON.parse(raw) as unknown;
}
export function verifyWhatsAppWebhook(
  raw: string,
  headers: Headers,
  externalUrl: string,
  token: string,
) {
  const params = Object.fromEntries(new URLSearchParams(raw));
  if (
    !twilio.validateRequest(
      token,
      headers.get('x-twilio-signature') ?? '',
      externalUrl,
      params,
    )
  ) {
    throw new Error('invalid_signature');
  }
  return params;
}
export function emailCallbackStatus(type: string) {
  switch (type) {
    case 'email.sent':
      return 'accepted';
    case 'email.delivered':
      return 'delivered';
    case 'email.bounced':
    case 'email.complained':
      return 'bounced';
    case 'email.failed':
      return 'permanent_failure';
    case 'email.suppressed':
      return 'suppressed';
    default:
      return null;
  }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

// Signatures authenticate raw bytes; they do not replace runtime shape validation.
// Resend accepts a tags array when sending, but emits a tags object in webhooks.
export function parseEmailCallback(event: unknown, eventKey: string | null) {
  if (!record(event) || typeof event.type !== 'string')
    throw new Error('invalid_event');
  const status = emailCallbackStatus(event.type);
  if (!status) return null;
  if (
    !eventKey ||
    eventKey.length > 250 ||
    !record(event.data) ||
    typeof event.data.email_id !== 'string' ||
    !uuid.test(event.data.email_id) ||
    typeof event.created_at !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      event.created_at,
    ) ||
    !Number.isFinite(Date.parse(event.created_at))
  )
    throw new Error('invalid_event');
  let deliveryId: number | undefined;
  let callbackToken: string | undefined;
  if (event.data.tags !== undefined) {
    if (!record(event.data.tags)) throw new Error('invalid_event');
    const id = event.data.tags.dt_delivery;
    const token = event.data.tags.dt_token;
    if (id !== undefined || token !== undefined) {
      if (
        typeof id !== 'string' ||
        !/^[1-9]\d*$/.test(id) ||
        !Number.isSafeInteger(Number(id)) ||
        typeof token !== 'string' ||
        !uuid.test(token)
      )
        throw new Error('invalid_event');
      deliveryId = Number(id);
      callbackToken = token;
    }
  }
  return {
    eventKey,
    providerId: event.data.email_id,
    status,
    occurredAt: event.created_at,
    deliveryId,
    callbackToken,
  };
}
export function whatsappCallbackStatus(status: string) {
  switch (status) {
    case 'queued':
    case 'sending':
    case 'sent':
      return 'accepted';
    case 'delivered':
    case 'read':
      return 'delivered';
    case 'failed':
    case 'undelivered':
      return 'permanent_failure';
    default:
      return null;
  }
}
