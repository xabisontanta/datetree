import {
  notificationMessage,
  providerOutcome,
  retryDelay,
  type Delivery,
} from '../_shared/notification.ts';
import { authenticatedUser, json, rpc, secureEqual } from '../_shared/runtime.ts';
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};
const variable = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback;

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const publicKey =
    Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SB_PUBLISHABLE_KEY');
  if (!url || !serviceKey || !publicKey)
    return json({ error: 'worker_not_configured' }, 503);
  const workerSecret = Deno.env.get('DT_NOTIFICATION_WORKER_SECRET');
  const background = Boolean(
    workerSecret &&
    (await secureEqual(
      request.headers.get('x-date-tree-worker-auth') ?? '',
      workerSecret,
    )),
  );
  const user = background ? null : await authenticatedUser(request, url, publicKey);
  if (!background && !user) return json({ error: 'unauthorized' }, 401);
  const body = (await request.json().catch(() => null)) as {
    requestId?: string;
  } | null;
  if (!background && (!body?.requestId || !/^[0-9a-f-]{36}$/i.test(body.requestId)))
    return json({ error: 'invalid_request' }, 400);
  const appUrl =
    Deno.env.get('DATE_TREE_APP_URL') ??
    'https://date-tree-social-booking.xabison.chatgpt.site';
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('NOTIFICATION_EMAIL_FROM');
  const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const twilioFrom = Deno.env
    .get('TWILIO_WHATSAPP_FROM')
    ?.replace(/^whatsapp:/i, '')
    .trim();
  let templates: Record<string, string> = {};
  let templateConfigurationValid = true;
  try {
    const raw: unknown = JSON.parse(Deno.env.get('TWILIO_CONTENT_SID_MAP') ?? '{}');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error();
    templates = Object.fromEntries(
      Object.entries(raw).filter(
        (v): v is [string, string] =>
          typeof v[1] === 'string' && /^HX[a-zA-Z0-9]{32}$/.test(v[1]),
      ),
    );
  } catch {
    templateConfigurationValid = false;
  }
  const channels = [
    ...(resendKey && from ? ['email'] : []),
    ...(templateConfigurationValid &&
    twilioSid &&
    twilioToken &&
    twilioFrom &&
    /^\+[1-9]\d{7,14}$/.test(twilioFrom)
      ? ['whatsapp']
      : []),
  ];
  if (!channels.length)
    return json({
      processed: 0,
      providerConfigured: false,
      ...(!templateConfigurationValid
        ? { configurationErrors: ['whatsapp_templates_invalid'] }
        : {}),
    });
  let deliveries: Delivery[];
  try {
    deliveries = await rpc(
      url,
      serviceKey,
      background ? 'dt_claim_notification_batch' : 'dt_claim_notification_deliveries',
      {
        ...(background ? {} : { rid: body!.requestId, requested_by: user }),
        allowed_channels: channels,
        batch_size: 10,
      },
    );
  } catch {
    return json({ error: 'claim_failed' }, 403);
  }
  const results: { id: number; status: string }[] = [];
  for (const d of deliveries) {
    let status = 'permanent_failure';
    let providerId: string | null = null;
    let errorCode: string | null = null;
    let retryAt: string | null = null;
    let sending = false;
    try {
      if (!/^[A-Za-z0-9_-]{1,255}$/.test(d.idempotency_key))
        throw new Error('invalid_idempotency_key');
      const message = notificationMessage(d, appUrl);
      if (d.channel === 'whatsapp' && !templates[d.template_name])
        throw new Error('template_not_configured');
      if (d.channel === 'whatsapp' && !/^\+[1-9]\d{7,14}$/.test(d.recipient_address))
        throw new Error('invalid_destination');
      const providerRequest =
        d.channel === 'email'
          ? {
              from,
              to: d.recipient_address,
              subject: message.subject,
              text: message.text,
              html: message.html,
              ...(message.replyTo ? { reply_to: message.replyTo } : {}),
            }
          : {
              From: `whatsapp:${twilioFrom}`,
              To: `whatsapp:${d.recipient_address}`,
              ContentSid: templates[d.template_name],
              ContentVariables: JSON.stringify({
                '1': variable(d.payload.creatorName, 'Your creator'),
                '2': variable(d.payload.serviceName, 'Service request'),
                '3': variable(d.payload.requestReference),
                '4': variable(d.payload.status),
                '5': message.actionUrl,
              }),
              StatusCallback: `${url}/functions/v1/dt-twilio-webhook?delivery=${d.delivery_id}`,
            };
      const prepared = await rpc<{
        body: Record<string, unknown>;
        callbackToken: string;
      } | null>(url, serviceKey, 'dt_prepare_notification', {
        delivery: d.delivery_id,
        lease: d.claim_token,
        provider_request: providerRequest,
      });
      if (!prepared) {
        results.push({ id: d.delivery_id, status: 'suppressed' });
        continue;
      }
      const callbackUrl = prepared.body.StatusCallback;
      if (d.channel === 'whatsapp' && typeof callbackUrl !== 'string') {
        throw new Error('prepare_failed');
      }
      sending = true;
      let response: Response;
      if (d.channel === 'email') {
        response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resendKey}`,
            'Idempotency-Key': d.idempotency_key,
          },
          body: JSON.stringify(prepared.body),
          signal: AbortSignal.timeout(10_000),
        });
      } else {
        const params = new URLSearchParams(prepared.body as Record<string, string>);
        params.set(
          'StatusCallback',
          `${typeof callbackUrl === 'string' ? callbackUrl : ''}&token=${prepared.callbackToken}`,
        );
        response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params,
            signal: AbortSignal.timeout(10_000),
          },
        );
      }
      const rawResult: unknown = await response.json().catch(() => ({}));
      const result =
        rawResult && typeof rawResult === 'object' && !Array.isArray(rawResult)
          ? (rawResult as Record<string, unknown>)
          : {};
      const providerError =
        typeof result.name === 'string' &&
        ['concurrent_idempotent_requests', 'invalid_idempotent_request'].includes(
          result.name,
        )
          ? result.name
          : undefined;
      providerId =
        typeof result.id === 'string'
          ? result.id
          : typeof result.sid === 'string'
            ? result.sid
            : null;
      status = providerOutcome(d.channel, response.status, providerError);
      if (status === 'accepted' && !providerId)
        status = d.channel === 'whatsapp' ? 'uncertain' : 'retry_scheduled';
      if (!response.ok) errorCode = providerError ?? `provider_${response.status}`;
      if (status === 'retry_scheduled')
        retryAt = new Date(
          Date.now() + retryDelay(d.attempts, response.headers.get('retry-after')),
        ).toISOString();
    } catch (error) {
      if (sending) {
        status = providerOutcome(d.channel, null);
        errorCode = 'provider_response_unknown';
        if (status === 'retry_scheduled')
          retryAt = new Date(Date.now() + retryDelay(d.attempts, null)).toISOString();
      } else
        errorCode =
          error instanceof Error &&
          [
            'template_not_configured',
            'invalid_destination',
            'invalid_idempotency_key',
            'invalid_action_path',
          ].includes(error.message)
            ? error.message
            : 'prepare_failed';
    }
    try {
      await rpc(url, serviceKey, 'dt_finish_notification_delivery', {
        delivery: d.delivery_id,
        delivery_claim: d.claim_token,
        delivery_key: d.idempotency_key,
        delivery_status: status,
        provider_id: providerId,
        error_code: errorCode,
        retry_at: retryAt,
      });
      results.push({ id: d.delivery_id, status });
    } catch {
      results.push({ id: d.delivery_id, status: 'result_persist_failed' });
    }
  }
  return json({
    processed: results.length,
    results,
    ...(!templateConfigurationValid
      ? { configurationErrors: ['whatsapp_templates_invalid'] }
      : {}),
  });
});
