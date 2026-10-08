import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { Webhook } from 'svix';
import twilio from 'twilio';
let handler: (request: Request) => Promise<Response>;
let environment: Record<string, string>;
let channel = 'email';
let failProvider = false;
let providerCalls: RequestInit[];
let finish: Record<string, unknown>;
let providerStatus: number;
let providerResult: Record<string, unknown>;
let callbackCalls: Record<string, unknown>[];
const callbackToken = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
beforeEach(async () => {
  channel = 'email';
  failProvider = false;
  providerCalls = [];
  finish = {};
  providerStatus = 200;
  providerResult = { id: 'email-id', sid: 'SMtest' };
  callbackCalls = [];
  environment = {
    SUPABASE_URL: 'https://db.test',
    SUPABASE_SERVICE_ROLE_KEY: 'test-server-key',
    SUPABASE_ANON_KEY: 'test-public-key',
    RESEND_API_KEY: 'test-resend',
    NOTIFICATION_EMAIL_FROM: 'Date Tree <updates@example.test>',
    TWILIO_ACCOUNT_SID: 'test-account',
    TWILIO_AUTH_TOKEN: 'test-token',
    TWILIO_WHATSAPP_FROM: '+27656193535',
    TWILIO_CONTENT_SID_MAP:
      '{"NEW_BOOKING_REQUEST":"HXaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}',
  };
  vi.stubGlobal('Deno', {
    env: { get: (key: string) => environment[key] },
    serve: (h: typeof handler) => {
      handler = h;
    },
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/auth/v1/user')) return Response.json({ id: 'test-user' });
      if (url.endsWith('/dt_contact_settings')) return Response.json({});
      if (url.includes('dt_claim_notification'))
        return Response.json([
          {
            delivery_id: 1,
            claim_token: 'lease',
            idempotency_key: `dt_1_creator_${channel}`,
            channel,
            recipient_address:
              channel === 'email' ? 'creator@example.test' : '+27656193535',
            template_name: 'NEW_BOOKING_REQUEST',
            attempts: 1,
            payload: {
              creatorName: 'Creator',
              serviceName: 'Service',
              status: 'PENDING_CREATOR',
              recipientRole: 'creator',
              actionPath: '/dashboard/requests/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            },
          },
        ]);
      if (url.endsWith('/dt_prepare_notification')) {
        const b = JSON.parse(options?.body as string);
        // The database attaches correlation tags before freezing the provider body.
        return Response.json({
          body: {
            ...b.provider_request,
            ...(channel === 'email'
              ? {
                  tags: [
                    { name: 'dt_delivery', value: '1' },
                    { name: 'dt_token', value: callbackToken },
                  ],
                }
              : {}),
          },
          callbackToken,
        });
      }
      if (url.endsWith('/dt_finish_notification_delivery')) {
        finish = JSON.parse(options?.body as string);
        return Response.json(null);
      }
      if (url.endsWith('/dt_delivery_callback') || url.endsWith('/dt_whatsapp_stop')) {
        callbackCalls.push(JSON.parse(options?.body as string));
        return Response.json(null);
      }
      providerCalls.push(options ?? {});
      if (failProvider) throw new DOMException('unknown', 'TimeoutError');
      return Response.json(providerResult, { status: providerStatus });
    }),
  );
  vi.resetModules();
  await import('../supabase/functions/dt-notification-worker/index');
});
afterEach(() => vi.unstubAllGlobals());
const invoke = () =>
  handler(
    new Request('https://worker.test', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-user-token' },
      body: JSON.stringify({ requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }),
    }),
  );
it('sends branded HTML and text with Resend idempotency and persists provider acceptance separately', async () => {
  await invoke();
  expect(new Headers(providerCalls[0]!.headers).get('Idempotency-Key')).toBe(
    'dt_1_creator_email',
  );
  const body = JSON.parse(providerCalls[0]!.body as string);
  expect(body.html).toContain('Date Tree');
  expect(body.text).toContain('Date Tree');
  expect(body.tags).toEqual([
    { name: 'dt_delivery', value: '1' },
    { name: 'dt_token', value: callbackToken },
  ]);
  expect(finish.delivery_status).toBe('accepted');
});
it('requires an approved mapped template, never falling back to Body', async () => {
  channel = 'whatsapp';
  environment.TWILIO_CONTENT_SID_MAP = '{}';
  await invoke();
  expect(providerCalls).toHaveLength(0);
  expect(finish.delivery_status).toBe('permanent_failure');
  expect(finish.error_code).toBe('template_not_configured');
});
it('uses a stable callback correlation token and does not pretend Twilio supports idempotency headers', async () => {
  channel = 'whatsapp';
  await invoke();
  const params = providerCalls[0]!.body as URLSearchParams;
  expect(params.has('Body')).toBe(false);
  expect(params.get('ContentSid')).toMatch(/^HX/);
  expect(params.get('StatusCallback')).toContain(`token=${callbackToken}`);
  expect(new Headers(providerCalls[0]!.headers).has('Idempotency-Key')).toBe(false);
});
it('does not blindly retry an ambiguous WhatsApp timeout', async () => {
  channel = 'whatsapp';
  failProvider = true;
  await invoke();
  expect(finish.delivery_status).toBe('uncertain');
  expect(finish.retry_at).toBeNull();
});
it('retries email timeouts using the same delivery key', async () => {
  failProvider = true;
  await invoke();
  expect(finish.delivery_status).toBe('retry_scheduled');
  expect(finish.delivery_key).toBe('dt_1_creator_email');
});
it('rejects requests without an authenticated session or a configured worker secret', async () => {
  const fetchMock = vi.mocked(fetch);
  fetchMock.mockImplementationOnce(async () => new Response('', { status: 401 }));
  expect((await invoke()).status).toBe(401);
  expect(providerCalls).toHaveLength(0);
});
it('keeps email usable when optional Twilio template configuration is malformed', async () => {
  environment.TWILIO_CONTENT_SID_MAP = '{bad-json';
  const result = await invoke();
  expect(result.status).toBe(200);
  expect(providerCalls).toHaveLength(1);
  expect(finish.delivery_status).toBe('accepted');
  expect(await result.json()).toHaveProperty('configurationErrors', [
    'whatsapp_templates_invalid',
  ]);
});
it.each([
  ['concurrent_idempotent_requests', 'retry_scheduled'],
  ['invalid_idempotent_request', 'permanent_failure'],
  ['unrecognized_conflict', 'permanent_failure'],
])(
  'classifies Resend conflict %s without logging the provider response',
  async (name, expected) => {
    providerStatus = 409;
    providerResult = { name, message: 'PRIVATE PROVIDER RESPONSE' };
    const response = await invoke();
    expect(finish.delivery_status).toBe(expected);
    expect(finish.delivery_key).toBe('dt_1_creator_email');
    expect(JSON.stringify(finish) + (await response.text())).not.toContain('PRIVATE');
  },
);

describe('provider webhook handlers', () => {
  const secret = `whsec_${Buffer.from('test-signing-secret-not-live').toString('base64')}`;
  const emailId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const signedEmail = (payload: unknown) => {
    const raw = JSON.stringify(payload);
    const now = new Date();
    return new Request('https://db.test/functions/v1/dt-resend-webhook', {
      method: 'POST',
      body: raw,
      headers: {
        'svix-id': 'msg_correlated',
        'svix-timestamp': String(Math.floor(now.getTime() / 1000)),
        'svix-signature': new Webhook(secret).sign('msg_correlated', now, raw),
      },
    });
  };
  it('reconciles a signed delivered email using immutable tags after a lost API response', async () => {
    environment.RESEND_WEBHOOK_SECRET = secret;
    await import('../supabase/functions/dt-resend-webhook/index');
    const response = await handler(
      signedEmail({
        type: 'email.delivered',
        created_at: new Date().toISOString(),
        data: {
          email_id: emailId,
          tags: { dt_delivery: '1', dt_token: callbackToken },
        },
      }),
    );
    expect(response.status).toBe(200);
    expect(callbackCalls[0]).toMatchObject({
      channel_name: 'email',
      provider_id: emailId,
      new_status: 'delivered',
      delivery_id: 1,
      callback_token: callbackToken,
    });
  });
  it('records signed provider suppression independently from request status', async () => {
    environment.RESEND_WEBHOOK_SECRET = secret;
    await import('../supabase/functions/dt-resend-webhook/index');
    expect(
      (
        await handler(
          signedEmail({
            type: 'email.suppressed',
            created_at: new Date().toISOString(),
            data: { email_id: emailId },
          }),
        )
      ).status,
    ).toBe(200);
    expect(callbackCalls[0]).toMatchObject({ new_status: 'suppressed' });
  });
  it('rejects malformed signed event shapes without invoking the database', async () => {
    environment.RESEND_WEBHOOK_SECRET = secret;
    await import('../supabase/functions/dt-resend-webhook/index');
    expect(
      (
        await handler(
          signedEmail({
            type: 'email.delivered',
            created_at: {},
            data: { email_id: emailId },
          }),
        )
      ).status,
    ).toBe(400);
    expect(callbackCalls).toHaveLength(0);
  });
  it('rejects an invalid Resend signature before any persistence', async () => {
    environment.RESEND_WEBHOOK_SECRET = secret;
    await import('../supabase/functions/dt-resend-webhook/index');
    expect(
      (
        await handler(
          new Request('https://db.test/functions/v1/dt-resend-webhook', {
            method: 'POST',
            body: '{}',
          }),
        )
      ).status,
    ).toBe(401);
    expect(callbackCalls).toHaveLength(0);
  });
  it('passes the signed inbound MessageSid to the transactional STOP deduplicator', async () => {
    await import('../supabase/functions/dt-twilio-webhook/index');
    const url = 'https://db.test/functions/v1/dt-twilio-webhook';
    const params = {
      AccountSid: 'test-account',
      Body: 'STOP',
      From: 'whatsapp:+27656193535',
      MessageSid: `SM${'a'.repeat(32)}`,
    };
    const request = new Request(url, {
      method: 'POST',
      body: new URLSearchParams(params),
      headers: {
        'x-twilio-signature': twilio.getExpectedTwilioSignature(
          'test-token',
          url,
          params,
        ),
      },
    });
    expect((await handler(request)).status).toBe(200);
    expect(callbackCalls[0]).toEqual({
      number: '+27656193535',
      event_id: params.MessageSid,
    });
  });
  it('rejects signed STOP events missing an inbound MessageSid', async () => {
    await import('../supabase/functions/dt-twilio-webhook/index');
    const url = 'https://db.test/functions/v1/dt-twilio-webhook';
    const params = {
      AccountSid: 'test-account',
      Body: 'STOP',
      From: 'whatsapp:+27656193535',
    };
    expect(
      (
        await handler(
          new Request(url, {
            method: 'POST',
            body: new URLSearchParams(params),
            headers: {
              'x-twilio-signature': twilio.getExpectedTwilioSignature(
                'test-token',
                url,
                params,
              ),
            },
          }),
        )
      ).status,
    ).toBe(400);
    expect(callbackCalls).toHaveLength(0);
  });
});
