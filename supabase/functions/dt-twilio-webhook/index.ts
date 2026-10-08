import { verifyWhatsAppWebhook, whatsappCallbackStatus } from '../_shared/webhooks.ts';
import { json, rpc } from '../_shared/runtime.ts';
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};
Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  const account = Deno.env.get('TWILIO_ACCOUNT_SID');
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!token || !account || !url || !key) return json({ error: 'not_configured' }, 503);
  const raw = await request.text();
  if (raw.length > 65536) return json({ error: 'payload_too_large' }, 413);
  const requestUrl = new URL(request.url);
  // Never trust forwarded Host headers; this is the configured provider URL.
  const externalUrl = `${url}/functions/v1/dt-twilio-webhook${requestUrl.search}`;
  let params: Record<string, string>;
  try {
    params = verifyWhatsAppWebhook(raw, request.headers, externalUrl, token);
  } catch {
    return json({ error: 'invalid_signature' }, 401);
  }
  if (params.AccountSid !== account) return json({ error: 'invalid_account' }, 401);
  try {
    if (
      params.Body &&
      /^(STOP|STOPALL|UNSUBSCRIBE|CANCEL|END|QUIT)$/i.test(params.Body.trim())
    ) {
      const number = params.From?.replace(/^whatsapp:/, '');
      if (
        !number ||
        !/^\+[1-9]\d{7,14}$/.test(number) ||
        !/^SM[a-zA-Z0-9]{32}$/.test(params.MessageSid ?? '')
      )
        return json({ error: 'invalid_event' }, 400);
      await rpc(url, key, 'dt_whatsapp_stop', { number, event_id: params.MessageSid });
      return new Response('<Response/>', { headers: { 'Content-Type': 'text/xml' } });
    }
    const status = whatsappCallbackStatus(
      params.MessageStatus ?? params.SmsStatus ?? '',
    );
    if (!status) return json({ received: true });
    const id = requestUrl.searchParams.get('delivery');
    const callbackToken = requestUrl.searchParams.get('token');
    if (
      !id ||
      !/^\d+$/.test(id) ||
      !callbackToken ||
      !/^[0-9a-f-]{36}$/.test(callbackToken) ||
      !/^SM[a-zA-Z0-9]{32}$/.test(params.MessageSid ?? '')
    )
      return json({ error: 'invalid_event' }, 400);
    await rpc(url, key, 'dt_delivery_callback', {
      channel_name: 'whatsapp',
      event_key: `${params.MessageSid}_${params.MessageStatus ?? params.SmsStatus}`,
      provider_id: params.MessageSid,
      new_status: status,
      occurred_at: new Date().toISOString(),
      delivery_id: Number(id),
      callback_token: callbackToken,
    });
  } catch {
    return json({ error: 'persistence_failed' }, 503);
  }
  return json({ received: true });
});
