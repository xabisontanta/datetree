import { describe, it, expect } from 'vitest';
import { Webhook } from 'svix';
import twilio from 'twilio';
import {
  notificationMessage,
  providerOutcome,
  retryDelay,
  type Delivery,
} from '../supabase/functions/_shared/notification';
import {
  verifyEmailWebhook,
  verifyWhatsAppWebhook,
  emailCallbackStatus,
  whatsappCallbackStatus,
  parseEmailCallback,
} from '../supabase/functions/_shared/webhooks';
import { contactHref } from '@/features/booking/contact-dto';
import { safeAuthDestination } from '@/features/creators/auth-destination';
import {
  emptyPage,
  newService,
  toPublicPage,
  publicServiceSchema,
} from '@/features/creators/page-schema';

const delivery = (overrides: Partial<Delivery> = {}): Delivery => ({
  delivery_id: 1,
  claim_token: 'test-lease',
  idempotency_key: 'dt_1_creator_email',
  channel: 'email',
  recipient_address: 'creator@example.test',
  template_name: 'NEW_BOOKING_REQUEST',
  attempts: 1,
  payload: {
    creatorName: 'Creator',
    requesterName: 'Fan',
    serviceName: 'Birthday shout-out',
    status: 'PENDING_CREATOR',
    recipientRole: 'creator',
    requestReference: 'aaaaaaaa',
    actionPath: '/dashboard/requests/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    preferredContact: { kind: 'whatsapp', address: '+27656193535' },
    notes: 'SECRET BRIEF',
    answers: ['SECRET ANSWER'],
    privateDetails: 'SECRET LOCATION',
  },
  ...overrides,
});
describe('notification content and privacy', () => {
  it('includes only the preferred contact, with a working link and no private brief', () => {
    const m = notificationMessage(delivery(), 'https://example.test');
    expect(m.text).toContain('https://wa.me/27656193535');
    expect(m.replyTo).toBeUndefined();
    expect(m.text + m.html).not.toContain('SECRET');
    expect(m.html).toContain('?intent=accept');
    expect(m.html).toContain('?intent=decline');
  });
  it('uses Reply-To only for the consented verified email payload', () => {
    const d = delivery();
    d.payload.preferredContact = { kind: 'email', address: 'fan@example.test' };
    expect(notificationMessage(d, 'https://example.test').replyTo).toBe(
      'fan@example.test',
    );
    d.payload.recipientRole = 'requester';
    expect(notificationMessage(d, 'https://example.test').replyTo).toBeUndefined();
  });
  it('identifies the receipt and distinguishes pending from acceptance', () => {
    const d = delivery({ template_name: 'REQUEST_RECEIVED' });
    d.payload.recipientRole = 'requester';
    const m = notificationMessage(d, 'https://example.test');
    expect(m.text).toContain(
      'Your request for Birthday shout-out has been sent to Creator.',
    );
    expect(m.text).toContain('Awaiting their response.');
  });
  it('escapes creator supplied text and rejects external action links', () => {
    const d = delivery();
    d.payload.creatorName = '<img src=x onerror=alert(1)>';
    expect(notificationMessage(d, 'https://example.test').html).not.toContain('<img');
    d.payload.actionPath = '//attacker.test';
    expect(() => notificationMessage(d, 'https://example.test')).toThrow();
  });
  it('does not project draft prices publicly, including old drafts', () => {
    const d = emptyPage();
    d.services = [newService('enquiry', 'Project enquiry')];
    d.services[0]!.pricing = 'fixed';
    d.services[0]!.amount = 2500;
    const projected = toPublicPage(d);
    expect(JSON.stringify(projected)).not.toMatch(/pricing|amount|currency/);
    expect(publicServiceSchema.parse(d.services[0])).not.toHaveProperty('pricing');
  });
  it('rejects unsafe preferred contact destinations', () => {
    const c = {
      request_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      kind: 'email' as const,
      address: 'fan@example.test?bcc=bad@test.com',
    };
    expect(contactHref(c)).toBeNull();
    expect(contactHref({ ...c, kind: 'whatsapp', address: '+27656193535' })).toBe(
      'https://wa.me/27656193535',
    );
  });
});
describe('bounded retries and ambiguity', () => {
  it('uses bounded exponential backoff with jitter rather than immediate retry for missing headers', () => {
    expect(retryDelay(1, null, 0, 0.5)).toBe(60000);
    expect(retryDelay(6, '', 0, 0.5)).toBe(1920000);
    expect(retryDelay(20, 'invalid', 0, 0.5)).toBe(3600000);
  });
  it('respects valid rate limit seconds and HTTP dates', () => {
    expect(retryDelay(1, '120', 0, 0.5)).toBe(120000);
    expect(retryDelay(1, 'Thu, 01 Jan 1970 00:02:00 GMT', 0, 0.5)).toBe(120000);
    expect(retryDelay(1, '0', 0, 0.5)).toBe(60000);
  });
  it('retries email with idempotency but holds ambiguous WhatsApp sends', () => {
    expect(providerOutcome('email', null)).toBe('retry_scheduled');
    expect(providerOutcome('email', 503)).toBe('retry_scheduled');
    expect(providerOutcome('whatsapp', null)).toBe('uncertain');
    expect(providerOutcome('whatsapp', 503)).toBe('uncertain');
    expect(providerOutcome('whatsapp', 429)).toBe('retry_scheduled');
    expect(providerOutcome('whatsapp', 400)).toBe('permanent_failure');
    expect(providerOutcome('email', 409, 'concurrent_idempotent_requests')).toBe(
      'retry_scheduled',
    );
    expect(providerOutcome('email', 409, 'invalid_idempotent_request')).toBe(
      'permanent_failure',
    );
  });
});
describe('signed delivery callbacks', () => {
  const secret = `whsec_${Buffer.from('test-signing-secret-not-live').toString('base64')}`;
  const payload = '{"type":"email.delivered","data":{"email_id":"test"}}';
  it('verifies the exact raw Resend payload, rejecting modified and expired signatures', () => {
    const date = new Date();
    const wh = new Webhook(secret);
    const headers = new Headers({
      'svix-id': 'msg_test',
      'svix-timestamp': String(Math.floor(date.getTime() / 1000)),
      'svix-signature': wh.sign('msg_test', date, payload),
    });
    expect(verifyEmailWebhook(payload, headers, secret)).toHaveProperty(
      'type',
      'email.delivered',
    );
    expect(() => verifyEmailWebhook(payload + ' ', headers, secret)).toThrow();
    headers.set('svix-timestamp', '1');
    expect(() => verifyEmailWebhook(payload, headers, secret)).toThrow();
  });
  it('uses Twilio SDK verification with the exact URL and all parameters', () => {
    const url = 'https://example.test/callback?delivery=1&token=test';
    const params = {
      MessageSid: 'SMtest',
      MessageStatus: 'delivered',
      FutureParameter: 'safe',
    };
    const headers = new Headers({
      'x-twilio-signature': twilio.getExpectedTwilioSignature(
        'test-token',
        url,
        params,
      ),
    });
    const raw = new URLSearchParams(params).toString();
    expect(verifyWhatsAppWebhook(raw, headers, url, 'test-token')).toEqual(params);
    expect(() =>
      verifyWhatsAppWebhook(raw, headers, url + 'bad', 'test-token'),
    ).toThrow();
    expect(() =>
      verifyWhatsAppWebhook(raw + '&Other=changed', headers, url, 'test-token'),
    ).toThrow();
  });
  it('maps delivery only; opens/read callbacks never mark business activity read', () => {
    expect(emailCallbackStatus('email.opened')).toBeNull();
    expect(emailCallbackStatus('email.bounced')).toBe('bounced');
    expect(emailCallbackStatus('email.suppressed')).toBe('suppressed');
    expect(emailCallbackStatus('toString')).toBeNull();
    expect(whatsappCallbackStatus('read')).toBe('delivered');
    expect(whatsappCallbackStatus('accepted')).toBeNull();
    expect(whatsappCallbackStatus('toString')).toBeNull();
  });
  it('extracts only valid documented tag-object correlation from a signed event', () => {
    const event = {
      type: 'email.delivered',
      created_at: '2026-10-07T12:00:00.000Z',
      data: {
        email_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tags: { dt_delivery: '42', dt_token: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
      },
    };
    expect(parseEmailCallback(event, 'msg_example')).toMatchObject({
      deliveryId: 42,
      callbackToken: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      status: 'delivered',
    });
    expect(
      parseEmailCallback(
        { ...event, data: { email_id: event.data.email_id } },
        'msg_legacy',
      ),
    ).toMatchObject({
      providerId: event.data.email_id,
      deliveryId: undefined,
    });
  });
  it.each([
    null,
    [],
    'event',
    { type: 'email.delivered', data: null },
    { type: 'email.delivered', created_at: {}, data: { email_id: 'bad' } },
    {
      type: 'email.delivered',
      created_at: '2026-10-07T12:00:00.000Z',
      data: { email_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tags: [] },
    },
    {
      type: 'email.delivered',
      created_at: '2026-10-07T12:00:00.000Z',
      data: {
        email_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tags: { dt_delivery: '42' },
      },
    },
    {
      type: 'email.delivered',
      created_at: '2026-10-07T12:00:00.000Z',
      data: {
        email_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tags: {
          dt_delivery: '9007199254740992',
          dt_token: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        },
      },
    },
  ])('rejects malformed signed callback shape %#', (event) => {
    expect(() => parseEmailCallback(event, 'msg_example')).toThrow('invalid_event');
  });
});
describe('safe authentication destinations', () => {
  it.each([
    '//evil.test',
    '/\\evil.test',
    '/%5cevil.test',
    '/%2f%2fevil.test',
    'https://evil.test',
    '/%0d%0aevil',
  ])('rejects %s', (path) => {
    expect(safeAuthDestination(path)).toBe('/dashboard');
  });
  it('preserves exact requests and non-mutating intent across authentication', () => {
    const path =
      '/dashboard/requests/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?intent=accept';
    expect(safeAuthDestination(path)).toBe(path);
  });
});
