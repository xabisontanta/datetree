import { authenticatedUser, json, rpc } from '../_shared/runtime.ts';
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};
Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const publicKey = Deno.env.get('SUPABASE_ANON_KEY');
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  const verifyService = Deno.env.get('TWILIO_VERIFY_SERVICE_SID');
  if (!url || !key || !publicKey) return json({ error: 'not_configured' }, 503);
  const user = await authenticatedUser(request, url, publicKey);
  if (!user) return json({ error: 'unauthorized' }, 401);
  // Independently gated: verify can incur provider costs even if notifications are off.
  if (
    Deno.env.get('DT_WHATSAPP_VERIFY_ENABLED') !== 'true' ||
    !sid ||
    !token ||
    !verifyService
  )
    return json(
      { error: 'WhatsApp verification is not enabled yet. Email remains available.' },
      503,
    );
  const body = (await request.json().catch(() => null)) as {
    number?: string;
    challenge?: string;
    code?: string;
  } | null;
  if (
    !body?.number ||
    !/^\+[1-9]\d{7,14}$/.test(body.number) ||
    (body.challenge &&
      (!/^[0-9a-f-]{36}$/.test(body.challenge) || !/^\d{4,10}$/.test(body.code ?? '')))
  )
    return json({ error: 'Check the number and verification code.' }, 400);
  let challenge: { id: string; number: string; providerId: string | null };
  try {
    challenge = await rpc(url, key, 'dt_reserve_whatsapp_verification', {
      uid: user,
      number: body.number,
      challenge: body.challenge ?? null,
    });
  } catch {
    return json(
      { error: 'Verification limit reached or code expired. Wait before retrying.' },
      429,
    );
  }
  try {
    const checking = Boolean(body.challenge);
    const params = new URLSearchParams(
      checking
        ? { VerificationSid: challenge.providerId!, Code: body.code! }
        : { To: challenge.number, Channel: 'whatsapp' },
    );
    const response = await fetch(
      `https://verify.twilio.com/v2/Services/${verifyService}/${checking ? 'VerificationCheck' : 'Verifications'}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
        signal: AbortSignal.timeout(10_000),
      },
    );
    const result = (await response.json()) as { sid?: string; status?: string };
    if (!response.ok || !result.sid)
      return json({ error: 'Could not verify. Wait before trying again.' }, 400);
    const approved = checking && result.status === 'approved';
    if (!checking || approved)
      await rpc(url, key, 'dt_finish_whatsapp_verification', {
        challenge: challenge.id,
        uid: user,
        provider_id: result.sid,
        approved,
      });
    return json(
      checking
        ? { verified: approved, error: approved ? '' : 'Incorrect or expired code.' }
        : { challenge: challenge.id },
    );
  } catch {
    return json(
      { error: 'Could not confirm verification. Wait before retrying.' },
      503,
    );
  }
});
