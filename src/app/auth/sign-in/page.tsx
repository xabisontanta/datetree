import Link from 'next/link';

import { signIn } from '@/app/auth/actions';
import { AuthMessage } from '@/components/auth/auth-message';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { safeAuthDestination } from '@/features/creators/auth-destination';

type SignInPageProps = {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { error, message, next: destination } = await searchParams;
  const next = safeAuthDestination(destination);

  return (
    <AuthShell
      eyebrow="Creator access"
      title="Welcome back."
      description="Sign in to manage your page. Your private details stay private."
    >
      <AuthMessage error={error} message={message} />
      <form className="auth-form" action={signIn}>
        <input type="hidden" name="next" value={next} />
        <div className="field-stack">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
        </div>
        <div className="field-stack">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            required
          />
        </div>
        <p className="auth-field-link">
          <Link href={`/auth/forgot-password?next=${encodeURIComponent(next)}`}>
            Forgot password?
          </Link>
        </p>
        <Button type="submit" size="lg" className="w-full">
          Sign in
        </Button>
      </form>
      <p className="auth-switch">
        New here? <Link href="/auth/sign-up">Create your link</Link>
      </p>
    </AuthShell>
  );
}
