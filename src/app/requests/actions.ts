'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requestSchema, transitionSchema } from '@/features/booking/request-schema';
import type { Json } from '@/lib/supabase/database.types';

export async function sendRequesterLink(
  email: string,
  username: string,
  serviceId: string,
) {
  const parsed = z.email().max(254).safeParse(email.trim().toLowerCase());
  if (
    !parsed.success ||
    !/^[a-z0-9][a-z0-9_-]{2,29}$/.test(username) ||
    !z.uuid().safeParse(serviceId).success
  )
    return { error: 'Enter a valid email address.' };
  const db = await createClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL;
  if (!origin) return { error: 'Email verification is not configured.' };
  const next = encodeURIComponent(`/${username}?service=${serviceId}`);
  const { error } = await db.auth.signInWithOtp({
    email: parsed.data,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${next}` },
  });
  return {
    error: error
      ? 'Unable to send verification email. Please wait before retrying, or sign in with an existing account.'
      : '',
  };
}
export async function submitRequest(input: unknown) {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success)
    return { error: 'Check your name, answers, and consent.', id: '' };
  const db = await createClient();
  const { data } = await db.auth.getUser();
  if (!data.user?.email_confirmed_at)
    return { error: 'Verify your email before submitting.', id: '' };
  const { data: id, error } = await db.rpc('dt_submit_request', {
    payload: parsed.data as Json,
  });
  return {
    error: error
      ? error.code === 'P0001'
        ? error.message
        : 'Could not send your request. Please retry.'
      : '',
    id: id ?? '',
  };
}
export async function transitionRequest(input: unknown) {
  const p = transitionSchema.safeParse(input);
  if (!p.success) return { error: 'Invalid request action.' };
  const db = await createClient();
  const { data } = await db.auth.getUser();
  if (!data.user) return { error: 'Your session expired. Sign in again.' };
  const { error } = await db.rpc('dt_transition_request', {
    rid: p.data.id,
    operation: p.data.operation,
    expected_version: p.data.version,
    ...(p.data.start ? { proposed_start: p.data.start } : {}),
  });
  revalidatePath('/dashboard');
  revalidatePath('/requests');
  return {
    error: error
      ? error.code === 'P0001'
        ? error.message
        : 'Could not update the request.'
      : '',
  };
}
