'use server';

import { redirect } from 'next/navigation';

import {
  authFailureDetails,
  resetPasswordFailureMessage,
  signInFailureMessage,
  signUpFailureMessage,
  updatePasswordFailureMessage,
} from '@/features/creators/auth-errors';
import {
  requestPasswordResetSchema,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
} from '@/features/creators/auth-schema';
import { provisionPrivateCreatorProfile } from '@/features/creators/provision-private-profile';
import { hasSupabasePublicConfig } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import { safeAuthDestination } from '@/features/creators/auth-destination';

function firstIssueMessage(issues: Array<{ message: string }>) {
  return issues[0]?.message ?? 'Check the form and try again.';
}

function authPath(
  path: string,
  kind: 'error' | 'message',
  message: string,
  next?: string,
) {
  return `${path}?${kind}=${encodeURIComponent(message)}${
    next ? `&next=${encodeURIComponent(next)}` : ''
  }`;
}

function getAppOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();

  try {
    return configured ? new URL(configured).origin : 'http://localhost:3000';
  } catch {
    return 'http://localhost:3000';
  }
}

function logAuthFailure(operation: string, error: { code?: string; status?: number }) {
  console.error('Authentication operation failed.', {
    operation,
    ...authFailureDetails(error),
  });
}

export async function signIn(formData: FormData) {
  const next = safeAuthDestination(formData.get('next'));
  const signInPath = `/auth/sign-in?next=${encodeURIComponent(next)}&`;
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    redirect(
      `${signInPath}error=${encodeURIComponent(firstIssueMessage(parsed.error.issues))}`,
    );
  }

  if (!hasSupabasePublicConfig()) {
    redirect(
      authPath(
        '/auth/sign-in',
        'error',
        'Authentication is not configured in this environment.',
        next,
      ),
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    logAuthFailure('sign_in', error);
    redirect(`${signInPath}error=${encodeURIComponent(signInFailureMessage(error))}`);
  }

  const { error: profileError } = /^\/dashboard(?:\/|\?|$)/.test(next)
    ? await provisionPrivateCreatorProfile(supabase, data.user)
    : { error: null };

  if (profileError) {
    redirect(
      authPath(
        '/auth/sign-in',
        'error',
        'We signed you in, but could not prepare your profile. Please try again.',
        next,
      ),
    );
  }

  redirect(next);
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
  const { email, password, whatsappNumber, whatsappConsent } = parsed.data;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${getAppOrigin()}/auth/callback?next=/dashboard`,
      data: {
        whatsapp_number: whatsappNumber || null,
        is_adult: true,
        terms_accepted: true,
        privacy_accepted: true,
        // This initial preference is not verification or delivery activation.
        // The notification worker requires verified contact settings and opt-in.
        whatsapp_notifications_consent: Boolean(whatsappNumber && whatsappConsent),
      },
    },
  });

  if (error) {
    logAuthFailure('sign_up', error);
    redirect(authPath('/auth/sign-up', 'error', signUpFailureMessage(error)));
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
      'Check your email to finish signup. If no email arrives, sign in or reset your password.',
    ),
  );
}

export async function requestPasswordReset(formData: FormData) {
  const next = safeAuthDestination(formData.get('next'));
  const parsed = requestPasswordResetSchema.safeParse({
    email: formData.get('email'),
  });

  if (!parsed.success) {
    redirect(
      authPath(
        '/auth/forgot-password',
        'error',
        firstIssueMessage(parsed.error.issues),
        next,
      ),
    );
  }

  if (!hasSupabasePublicConfig()) {
    redirect(
      authPath(
        '/auth/forgot-password',
        'error',
        'Password recovery is not configured in this environment.',
        next,
      ),
    );
  }

  const supabase = await createClient();
  const recoveryPath = `/auth/update-password?next=${encodeURIComponent(next)}`;
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${getAppOrigin()}/auth/callback?next=${encodeURIComponent(recoveryPath)}`,
  });

  if (error) {
    logAuthFailure('request_password_reset', error);
    redirect(
      authPath(
        '/auth/forgot-password',
        'error',
        resetPasswordFailureMessage(error),
        next,
      ),
    );
  }

  redirect(
    authPath(
      '/auth/forgot-password',
      'message',
      'If an account exists for that email, a password reset link is on its way.',
      next,
    ),
  );
}

export async function updatePassword(formData: FormData) {
  const next = safeAuthDestination(formData.get('next'));
  const parsed = updatePasswordSchema.safeParse({
    password: formData.get('password'),
    passwordConfirmation: formData.get('passwordConfirmation'),
  });

  if (!parsed.success) {
    redirect(
      authPath(
        '/auth/update-password',
        'error',
        firstIssueMessage(parsed.error.issues),
        next,
      ),
    );
  }

  if (!hasSupabasePublicConfig()) {
    redirect(
      authPath(
        '/auth/update-password',
        'error',
        'Password recovery is not configured in this environment.',
        next,
      ),
    );
  }

  const supabase = await createClient();
  const { data, error: userError } = await supabase.auth.getUser();

  if (userError || !data.user) {
    if (userError) logAuthFailure('verify_password_reset_session', userError);
    redirect(
      authPath(
        '/auth/forgot-password',
        'error',
        'Your reset link is invalid or expired. Request a new one.',
        next,
      ),
    );
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    logAuthFailure('update_password', error);
    redirect(
      authPath(
        '/auth/update-password',
        'error',
        updatePasswordFailureMessage(error),
        next,
      ),
    );
  }

  const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' });

  if (signOutError) logAuthFailure('sign_out_after_password_update', signOutError);

  redirect(
    authPath(
      '/auth/sign-in',
      'message',
      'Password updated. Sign in with your new password.',
      next,
    ),
  );
}

export async function signOut() {
  if (hasSupabasePublicConfig()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) logAuthFailure('sign_out', error);
  }

  redirect('/');
}
