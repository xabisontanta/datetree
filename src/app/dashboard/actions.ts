'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { pageDocumentSchema, publicationIssues } from '@/features/creators/page-schema';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/supabase/database.types';

export async function savePage(input: unknown, revision: number) {
  const parsed = pageDocumentSchema.safeParse(input);
  if (!parsed.success)
    return {
      error: parsed.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join(' '),
      revision,
    };
  const db = await createClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user)
    return {
      error: 'Your session expired. Sign in again; your saved work is safe.',
      revision,
    };
  const { data, error } = await db.rpc('dt_save_page', {
    document: parsed.data as Json,
    expected_revision: revision,
  });
  if (error)
    return {
      error:
        error.code === '23505'
          ? 'That username is taken. Try adding your profession or a number.'
          : error.code === 'P0001'
            ? error.message
            : 'Could not save your page. Please try again.',
      revision,
    };
  revalidatePath('/dashboard');
  return { error: '', revision: data };
}
export async function publishPage(publish: boolean, revision: number) {
  const db = await createClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return { error: 'Sign in again to publish.' };
  if (publish) {
    const { data } = await db
      .from('dt_page_drafts')
      .select('document')
      .eq('creator_id', auth.user.id)
      .single();
    const d = pageDocumentSchema.safeParse(data?.document);
    if (!d.success) return { error: 'Save your complete profile first.' };
    const issues = publicationIssues(d.data);
    if (issues.length) return { error: issues.join(' ') };
  }
  const { error } = await db.rpc('dt_publish_page', {
    publish,
    expected_revision: revision,
  });
  if (error)
    return {
      error:
        error.code === 'P0001'
          ? error.message
          : 'Could not update publication. Please retry.',
    };
  revalidatePath('/', 'layout');
  return { error: '' };
}
export async function pauseRequests(paused: boolean) {
  const db = await createClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return { error: 'Please sign in again.' };
  const { error } = await db
    .from('profiles_private')
    .update({ requests_paused_at: paused ? new Date().toISOString() : null })
    .eq('id', auth.user.id);
  revalidatePath('/dashboard');
  return { error: error ? 'Could not update request availability.' : '' };
}
export async function recordCreatorConsent(form: FormData) {
  if (
    !z.literal('on').safeParse(form.get('adult')).success ||
    form.get('terms') !== 'on' ||
    form.get('privacy') !== 'on'
  )
    return;
  const db = await createClient();
  const { data } = await db.auth.getUser();
  if (!data.user) return;
  const { data: current } = await db
    .from('profiles_private')
    .select('terms_accepted_at,privacy_accepted_at')
    .eq('id', data.user.id)
    .single();
  await db
    .from('profiles_private')
    .update({
      is_adult: true,
      terms_accepted_at: current?.terms_accepted_at ?? new Date().toISOString(),
      privacy_accepted_at: current?.privacy_accepted_at ?? new Date().toISOString(),
    })
    .eq('id', data.user.id);
  revalidatePath('/dashboard');
}
