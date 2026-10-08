export type Delivery = {
  delivery_id: number;
  claim_token: string;
  idempotency_key: string;
  channel: 'email' | 'whatsapp';
  recipient_address: string;
  template_name: string;
  payload: Record<string, unknown>;
  attempts: number;
};
const text = (v: unknown, fallback = '') =>
  typeof v === 'string'
    ? v
        .trim()
        .replace(/[\r\n]/g, ' ')
        .slice(0, 500)
    : fallback;
const html = (v: string) =>
  v.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function notificationMessage(d: Delivery, origin: string) {
  const p = d.payload;
  const creator = text(p.creatorName, 'Your creator');
  const service = text(p.serviceName, 'Service request');
  const path = text(p.actionPath);
  if (!/^\/(dashboard\/)?requests\/[0-9a-f-]{36}$/.test(path))
    throw new Error('invalid_action_path');
  const actionUrl = new URL(path, new URL(origin).origin).href;
  const creatorRecipient = p.recipientRole === 'creator';
  const states: Record<string, string> = {
    PENDING_CREATOR: creatorRecipient
      ? 'A new request is awaiting your response.'
      : 'Awaiting their response. We’ll notify you when they accept or decline.',
    COUNTER_PROPOSED: 'A new time has been proposed. Review it in Date Tree.',
    CONFIRMED: 'The request has been accepted.',
    DECLINED: 'The request has been declined.',
    CANCELLED: 'The request has been cancelled.',
    COMPLETED: 'The request has been marked complete.',
  };
  const intro =
    d.template_name === 'REQUEST_RECEIVED'
      ? `Your request for ${service} has been sent to ${creator}.`
      : creatorRecipient
        ? `${service} · request from ${text(p.requesterName, 'a client')}`
        : `${creator} · ${service}`;
  const lines = [
    intro,
    states[text(p.status)] ?? 'Review the latest status in Date Tree.',
    `Reference: ${text(p.requestReference)}`,
  ];
  for (const [key, label] of [
    ['startAt', 'Appointment'],
    ['deliveryDueAt', 'Delivery deadline'],
  ] as const) {
    const date = text(p[key]);
    if (date && Number.isFinite(Date.parse(date))) {
      lines.push(
        `${label}: ${new Intl.DateTimeFormat('en', { dateStyle: 'full', timeStyle: 'short', timeZone: text(p.timezone, 'UTC') }).format(new Date(date))} (${text(p.timezone, 'UTC')})`,
      );
    }
  }
  const contact =
    creatorRecipient &&
    typeof p.preferredContact === 'object' &&
    p.preferredContact !== null
      ? (p.preferredContact as Record<string, unknown>)
      : null;
  const address = text(contact?.address);
  const email =
    contact?.kind === 'email' && /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(address)
      ? address
      : undefined;
  const contactUrl = email
    ? `mailto:${email}`
    : contact?.kind === 'whatsapp' && /^\+[1-9]\d{7,14}$/.test(address)
      ? `https://wa.me/${address.slice(1)}`
      : null;
  if (contactUrl) lines.push(`Preferred contact: ${address}`, contactUrl);
  lines.push(
    'Full notes and private instructions are available only in your authenticated inbox.',
    'Any fees are arranged privately. Date Tree does not process payments.',
  );
  const buttons = [{ label: 'Review request', url: actionUrl }];
  if (creatorRecipient && p.status === 'PENDING_CREATOR')
    buttons.push(
      { label: 'Review and accept', url: `${actionUrl}?intent=accept` },
      { label: 'Review and decline', url: `${actionUrl}?intent=decline` },
    );
  return {
    subject: `${service}: ${d.template_name === 'REQUEST_RECEIVED' ? 'request received' : text(p.status).replaceAll('_', ' ').toLowerCase()}`,
    text: [...lines, ...buttons.map((b) => `${b.label}: ${b.url}`)].join('\n\n'),
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;color:#171426"><h1 style="font-size:24px">Date Tree</h1>${lines.map((l) => `<p>${html(l)}</p>`).join('')}${contactUrl ? `<p><a href="${html(contactUrl)}">Contact requester</a></p>` : ''}${buttons.map((b) => `<p><a style="display:inline-block;background:#ff6058;color:#171426;padding:12px 18px;border-radius:12px" href="${html(b.url)}">${b.label}</a></p>`).join('')}</div>`,
    actionUrl,
    replyTo: email,
  };
}
export function retryDelay(
  attempt: number,
  retryAfter: string | null,
  now = Date.now(),
  random = Math.random(),
) {
  let providerDelay = 0;
  if (retryAfter?.trim()) {
    const seconds = /^\d+(\.\d+)?$/.test(retryAfter.trim()) ? Number(retryAfter) : NaN;
    const date = Date.parse(retryAfter);
    providerDelay = Number.isFinite(seconds)
      ? seconds * 1000
      : Number.isFinite(date)
        ? Math.max(0, date - now)
        : 0;
  }
  const backoff = Math.min(60_000 * 2 ** Math.max(0, attempt - 1), 3_600_000);
  return Math.max(
    providerDelay,
    Math.round(backoff * (0.75 + Math.min(1, Math.max(0, random)) * 0.5)),
  );
}
export function providerOutcome(
  channel: Delivery['channel'],
  status: number | null,
  providerError?: string,
) {
  if (status !== null && status >= 200 && status < 300) return 'accepted';
  // The other Resend 409 (different payload for the same key) is permanent.
  if (
    channel === 'email' &&
    status === 409 &&
    providerError === 'concurrent_idempotent_requests'
  )
    return 'retry_scheduled';
  if (channel === 'whatsapp' && (status === null || status >= 500)) return 'uncertain';
  if (status === null || status === 429 || status >= 500) return 'retry_scheduled';
  return 'permanent_failure';
}
