import Link from 'next/link';

import { requestPasswordReset } from '@/app/auth/actions';
import { AuthMessage } from '@/components/auth/auth-message';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type ForgotPasswordPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const { error, message } = await searchParams;

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Reset your password."
      description="We will email a secure link to the address on your account."
    >
      <AuthMessage error={error} message={message} />
      <form className="auth-form" action={requestPasswordReset}>
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
        <Button type="submit" size="lg" className="w-full">
          Send reset link
        </Button>
      </form>
      <p className="auth-switch">
        Remembered it? <Link href="/auth/sign-in">Return to sign in</Link>
      </p>
    </AuthShell>
  );
}
