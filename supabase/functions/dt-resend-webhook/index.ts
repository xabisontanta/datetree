import { verifyEmailWebhook, parseEmailCallback } from '../_shared/webhooks.ts';
import { json, rpc } from '../_shared/runtime.ts';
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};
Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const secret = Deno.env.get('RESEND_WEBHOOK_SECRET');
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret || !url || !key) return json({ error: 'not_configured' }, 503);
  const raw = await request.text();
  if (raw.length > 65536) return json({ error: 'payload_too_large' }, 413);
  let event: unknown;
  try {
    event = verifyEmailWebhook(raw, request.headers, secret);
  } catch {
    return json({ error: 'invalid_signature' }, 401);
  }
  let callback: ReturnType<typeof parseEmailCallback>;
  try {
    callback = parseEmailCallback(event, request.headers.get('svix-id'));
  } catch {
    return json({ error: 'invalid_event' }, 400);
  }
  if (!callback) return json({ received: true });
  try {
    await rpc(url, key, 'dt_delivery_callback', {
      channel_name: 'email',
      event_key: callback.eventKey,
      provider_id: callback.providerId,
      new_status: callback.status,
      occurred_at: callback.occurredAt,
      ...(callback.deliveryId !== undefined
        ? { delivery_id: callback.deliveryId, callback_token: callback.callbackToken }
        : {}),
    });
  } catch {
    return json({ error: 'persistence_failed' }, 503);
  }
  return json({ received: true });
});
