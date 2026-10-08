import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { provisionPrivateCreatorProfile } from '@/features/creators/provision-private-profile';
import { hasSupabasePublicConfig } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import { safeAuthDestination } from '@/features/creators/auth-destination';

const otpTypes = new Set<EmailOtpType>([
  'email',
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeAuthDestination(url.searchParams.get('next'));
  const failure = (reason: string) =>
    NextResponse.redirect(
      new URL(
        `/auth/error?reason=${reason}&next=${encodeURIComponent(next)}`,
        url.origin,
      ),
    );

  if (!hasSupabasePublicConfig()) {
    return failure('configuration');
  }

  const supabase = await createClient();
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const rawType = url.searchParams.get('type');
  let authError = null;

  if (code) {
    ({ error: authError } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && rawType && otpTypes.has(rawType as EmailOtpType)) {
    ({ error: authError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: rawType as EmailOtpType,
    }));
  } else {
    return failure('invalid');
  }

  if (authError) {
    return failure('expired');
  }

  const { data, error: userError } = await supabase.auth.getUser();

  if (userError || !data.user) {
    return failure('session');
  }

  const { error: profileError } = /^\/dashboard(?:\/|\?|$)/.test(next)
    ? await provisionPrivateCreatorProfile(supabase, data.user)
    : { error: null };

  if (profileError) {
    return failure('profile');
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
