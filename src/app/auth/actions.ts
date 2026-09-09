'use server';

import { redirect } from 'next/navigation';

import { signInSchema, signUpSchema } from '@/features/creators/auth-schema';
import { provisionPrivateCreatorProfile } from '@/features/creators/provision-private-profile';
import { hasSupabasePublicConfig } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

function firstIssueMessage(issues: Array<{ message: string }>) {
  return issues[0]?.message ?? 'Check the form and try again.';
}

function authPath(path: string, kind: 'error' | 'message', message: string) {
  return `${path}?${kind}=${encodeURIComponent(message)}`;
}

function getAppOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();

  try {
    return configured ? new URL(configured).origin : 'http://localhost:3000';
  } catch {
    return 'http://localhost:3000';
  }
}

export async function signIn(formData: FormData) {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    redirect(
      authPath('/auth/sign-in', 'error', firstIssueMessage(parsed.error.issues)),
    );
  }

  if (!hasSupabasePublicConfig()) {
    redirect(
      authPath(
        '/auth/sign-in',
        'error',
        'Authentication is not configured in this environment.',
      ),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    redirect(
      authPath(
        '/auth/sign-in',
        'error',
        'We could not sign you in with those details.',
      ),
    );
  }

  redirect('/dashboard');
}

export async function signUp(formData: FormData) {
  const parsed = signUpSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    whatsappNumber: formData.get('whatsappNumber'),
    isAdult: formData.get('isAdult'),
    acceptsTerms: formData.get('acceptsTerms'),
    acceptsPrivacy: formData.get('acceptsPrivacy'),
    whatsappConsent: formData.get('whatsappConsent'),
  });

  if (!parsed.success) {
    redirect(
      authPath('/auth/sign-up', 'error', firstIssueMessage(parsed.error.issues)),
    );
  }

  if (!hasSupabasePublicConfig()) {
    redirect(
      authPath(
        '/auth/sign-up',
        'error',
        'Account creation is not configured in this environment.',
      ),
    );
  }

  const supabase = await createClient();
  const { email, password, whatsappNumber } = parsed.data;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${getAppOrigin()}/auth/callback?next=/dashboard`,
      data: {
        whatsapp_number: whatsappNumber,
        is_adult: true,
        terms_accepted: true,
        privacy_accepted: true,
        whatsapp_notifications_consent: true,
      },
    },
  });

  if (error) {
    redirect(
      authPath(
        '/auth/sign-up',
        'error',
        'We could not create your account. Please try again.',
      ),
    );
  }

  if (data.session && data.user) {
    const { error: profileError } = await provisionPrivateCreatorProfile(
      supabase,
      data.user,
    );

    if (profileError) {
      redirect(
        authPath(
          '/auth/sign-in',
          'message',
          'Your account was created. Sign in to continue setup.',
        ),
      );
    }

    redirect('/dashboard');
  }

  redirect(
    authPath(
      '/auth/sign-in',
      'message',
      'Check your email to confirm your account, then sign in.',
    ),
  );
}

export async function signOut() {
  if (hasSupabasePublicConfig()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  redirect('/');
}
