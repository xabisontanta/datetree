declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

type NotificationDelivery = {
  delivery_id: number;
  claim_token: string;
  idempotency_key: string;
  channel: 'email' | 'whatsapp';
  recipient_address: string;
  template_name: string;
  payload: {
    creatorName?: string;
    serviceName?: string;
    requestReference?: string;
    status?: string;
    nextStep?: string;
    actionPath?: string;
  };
  attempts: number;
};

const jsonHeaders = { 'Content-Type': 'application/json' };
const e164Pattern = /^\+\d{8,15}$/;
const contentSidPattern = /^HX[A-Za-z0-9]{32}$/;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function safeText(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeE164(value: string) {
  if (e164Pattern.test(value)) return value;
  return `+${value.replace(/\D/g, '')}`;
}

function normalizeWhatsAppAddress(value: string) {
  const trimmed = value.trim();
  const raw = trimmed.toLowerCase().startsWith('whatsapp:')
    ? trimmed.slice('whatsapp:'.length).trim()
    : trimmed;
  return `whatsapp:${normalizeE164(raw)}`;
}

function parseTwilioContentSidMap(raw: string | undefined) {
  if (!raw?.trim()) return {} as Record<string, string>;
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError('invalid_template_configuration');
  }
  return Object.fromEntries(
    Object.entries(parsed).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === 'string' && contentSidPattern.test(entry[1]),
    ),
  );
}

function notificationText(delivery: NotificationDelivery, appUrl: string) {
  const creator = safeText(delivery.payload.creatorName, 'Your creator');
  const service = safeText(delivery.payload.serviceName, 'Service request');
  const reference = safeText(delivery.payload.requestReference, 'unknown');
  const nextStep = safeText(
    delivery.payload.nextStep,
    'Open Date Tree to review the latest status.',
  );
  const path = safeText(delivery.payload.actionPath, '/requests');
  const actionUrl = new URL(path, appUrl).toString();
  return {
    subject: `${service}: ${delivery.template_name.replaceAll('_', ' ').toLowerCase()}`,
    text: `${creator} - ${service}\nReference: ${reference}\n${nextStep}\n${actionUrl}`,
    actionUrl,
  };
}

async function rpc<T>(
  supabaseUrl: string,
  serviceKey: string,
  name: string,
  body: Record<string, unknown>,
) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      ...jsonHeaders,
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`database_${response.status}`);
  return (await response.json()) as T;
}

async function sendEmail(
  delivery: NotificationDelivery,
  message: ReturnType<typeof notificationText>,
  apiKey: string,
  from: string,
) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      ...jsonHeaders,
      Authorization: `Bearer ${apiKey}`,
      'Idempotency-Key': delivery.idempotency_key,
      'User-Agent': 'Date-Tree-Notifications/1.0',
    },
    body: JSON.stringify({
      from,
      to: delivery.recipient_address,
      subject: message.subject,
      text: message.text,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const result = (await response.json().catch(() => ({}))) as {
    id?: string;
  };
  return { response, providerId: result.id ?? null };
}

async function sendWhatsApp(
  delivery: NotificationDelivery,
  message: ReturnType<typeof notificationText>,
  accountSid: string,
  authToken: string,
  fromNumber: string,
  contentSidMap: Record<string, string>,
) {
  const params = new URLSearchParams({
    From: normalizeWhatsAppAddress(fromNumber),
    To: normalizeWhatsAppAddress(delivery.recipient_address),
  });
  const contentSid = contentSidMap[delivery.template_name];
  if (contentSid) {
    params.set('ContentSid', contentSid);
    params.set(
      'ContentVariables',
      JSON.stringify({
        '1': safeText(delivery.payload.creatorName, 'Your creator'),
        '2': safeText(delivery.payload.serviceName, 'Service request'),
        '3': safeText(delivery.payload.requestReference, 'unknown'),
        '4': safeText(delivery.payload.nextStep, message.actionUrl),
        '5': message.actionUrl,
      }),
    );
  } else {
    params.set('Body', message.text);
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': delivery.idempotency_key,
        'User-Agent': 'Date-Tree-Notifications/1.0',
      },
      body: params,
      signal: AbortSignal.timeout(10_000),
    },
  );
  const result = (await response.json().catch(() => ({}))) as {
    sid?: string;
  };
  return { response, providerId: result.sid ?? null };
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey =
    Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SB_PUBLISHABLE_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const appUrl =
    Deno.env.get('DATE_TREE_APP_URL') ??
    Deno.env.get('NEXT_PUBLIC_APP_URL') ??
    'https://date-tree-social-booking.xabison.chatgpt.site';
  const authorization = request.headers.get('Authorization');
  if (!supabaseUrl || !publishableKey || !serviceKey || !appUrl || !authorization)
    return json({ error: 'worker_not_configured' }, 503);

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: publishableKey, Authorization: authorization },
  });
  if (!userResponse.ok) return json({ error: 'unauthorized' }, 401);
  const user = (await userResponse.json()) as { id?: string };
  if (!user.id) return json({ error: 'unauthorized' }, 401);

  const body = (await request.json().catch(() => null)) as {
    requestId?: string;
  } | null;
  if (!body?.requestId || !/^[0-9a-f-]{36}$/i.test(body.requestId))
    return json({ error: 'invalid_request' }, 400);

  const resendKey = Deno.env.get('RESEND_API_KEY');
  const emailFrom = Deno.env.get('NOTIFICATION_EMAIL_FROM');
  const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const twilioFrom = Deno.env.get('TWILIO_WHATSAPP_FROM');
  let contentSidMap: Record<string, string> = {};
  try {
    contentSidMap = parseTwilioContentSidMap(Deno.env.get('TWILIO_CONTENT_SID_MAP'));
  } catch {
    return json({ error: 'invalid_template_configuration' }, 503);
  }
  const whatsappReady = Boolean(twilioSid && twilioToken && twilioFrom);
  const channels = [
    ...(resendKey && emailFrom ? ['email'] : []),
    ...(whatsappReady ? ['whatsapp'] : []),
  ];
  if (!channels.length) return json({ processed: 0, providerConfigured: false });

  let deliveries: NotificationDelivery[];
  try {
    deliveries = await rpc<NotificationDelivery[]>(
      supabaseUrl,
      serviceKey,
      'dt_claim_notification_deliveries',
      {
        rid: body.requestId,
        requested_by: user.id,
        allowed_channels: channels,
        batch_size: 10,
      },
    );
  } catch {
    return json({ error: 'claim_failed' }, 403);
  }

  const results = [];
  for (const delivery of deliveries) {
    let status = 'retry_scheduled';
    let providerId: string | null = null;
    let errorCode: string | null = null;
    let retryAt: string | null = new Date(Date.now() + 5 * 60_000).toISOString();
    try {
      if (!/^[A-Za-z0-9_-]{1,255}$/.test(delivery.idempotency_key)) {
        status = 'permanent_failure';
        errorCode = 'invalid_idempotency_key';
        retryAt = null;
        throw new TypeError('invalid_idempotency_key');
      }
      const message = notificationText(delivery, appUrl);
      const result =
        delivery.channel === 'email' && resendKey && emailFrom
          ? await sendEmail(delivery, message, resendKey, emailFrom)
          : delivery.channel === 'whatsapp' && twilioSid && twilioToken && twilioFrom
            ? await sendWhatsApp(
                delivery,
                message,
                twilioSid,
                twilioToken,
                twilioFrom,
                contentSidMap,
              )
            : null;
      if (!result) {
        status = 'provider_not_configured';
        errorCode = 'template_not_configured';
        retryAt = null;
      } else {
        providerId = result.providerId;
        if (result.response.ok) {
          status = 'accepted';
          retryAt = null;
        } else if (result.response.status === 429 || result.response.status >= 500) {
          errorCode = `provider_${result.response.status}`;
          const retryAfter = Number(result.response.headers.get('retry-after'));
          retryAt = new Date(
            Date.now() + (Number.isFinite(retryAfter) ? retryAfter * 1000 : 300_000),
          ).toISOString();
        } else {
          status = 'permanent_failure';
          errorCode = `provider_${result.response.status}`;
          retryAt = null;
        }
      }
    } catch (error) {
      if (errorCode !== 'invalid_idempotency_key') {
        errorCode =
          error instanceof DOMException ? 'provider_timeout' : 'provider_error';
      }
    }

    try {
      await rpc<null>(supabaseUrl, serviceKey, 'dt_finish_notification_delivery', {
        delivery: delivery.delivery_id,
        delivery_claim: delivery.claim_token,
        delivery_key: delivery.idempotency_key,
        delivery_status: status,
        provider_id: providerId,
        error_code: errorCode,
        retry_at: retryAt,
      });
      results.push({ id: delivery.delivery_id, status });
    } catch {
      results.push({ id: delivery.delivery_id, status: 'result_persist_failed' });
    }
  }

  return json({ processed: results.length, results });
});
