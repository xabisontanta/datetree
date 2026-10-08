import Link from 'next/link';

import { AuthShell } from '@/components/auth/auth-shell';
import { safeAuthDestination } from '@/features/creators/auth-destination';

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeAuthDestination((await searchParams).next);
  const recovery = new URL(next, 'https://date-tree.invalid');
  const requester =
    /^\/requests(?:\/|\?|$)/.test(next) || next === '/settings/notifications';
  const creator = /^\/dashboard(?:\/|\?|$)/.test(next);
  const isRecovery = recovery.pathname === '/auth/update-password';
  const destination = isRecovery
    ? `/auth/forgot-password?next=${encodeURIComponent(safeAuthDestination(recovery.searchParams.get('next')))}`
    : requester
      ? `/requests/sign-in?next=${encodeURIComponent(next)}`
      : creator
        ? `/auth/sign-in?next=${encodeURIComponent(next)}`
        : next;
  return (
    <AuthShell
      eyebrow="Link expired"
      title="We could not finish signing you in."
      description="Request a fresh sign-in link or try your email and password again."
    >
      <Link className="button-link button-link-primary" href={destination}>
        {isRecovery
          ? 'Request a new reset link'
          : requester || creator
            ? 'Return to sign in'
            : 'Return to the service'}
      </Link>
    </AuthShell>
  );
}
