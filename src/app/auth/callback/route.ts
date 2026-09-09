import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { provisionPrivateCreatorProfile } from '@/features/creators/provision-private-profile';
import { hasSupabasePublicConfig } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

const otpTypes = new Set<EmailOtpType>([
  'email',
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
]);

function safeNextPath(value: string | null) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/dashboard';
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNextPath(url.searchParams.get('next'));

  if (!hasSupabasePublicConfig()) {
    return NextResponse.redirect(
      new URL('/auth/error?reason=configuration', url.origin),
    );
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
    return NextResponse.redirect(new URL('/auth/error?reason=invalid', url.origin));
  }

  if (authError) {
    return NextResponse.redirect(new URL('/auth/error?reason=expired', url.origin));
  }

  const { data, error: userError } = await supabase.auth.getUser();

  if (userError || !data.user) {
    return NextResponse.redirect(new URL('/auth/error?reason=session', url.origin));
  }

  const { error: profileError } = await provisionPrivateCreatorProfile(
    supabase,
    data.user,
  );

  if (profileError) {
    return NextResponse.redirect(new URL('/auth/error?reason=profile', url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
