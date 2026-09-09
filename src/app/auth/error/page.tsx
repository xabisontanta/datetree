import Link from 'next/link';

import { AuthShell } from '@/components/auth/auth-shell';

export default function AuthErrorPage() {
  return (
    <AuthShell
      eyebrow="Link expired"
      title="We could not finish signing you in."
      description="Request a fresh sign-in link or try your email and password again."
    >
      <Link className="button-link button-link-primary" href="/auth/sign-in">
        Return to sign in
      </Link>
    </AuthShell>
  );
}
