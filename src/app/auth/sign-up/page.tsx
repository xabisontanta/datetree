import Link from 'next/link';

import { signUp } from '@/app/auth/actions';
import { AuthMessage } from '@/components/auth/auth-message';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { E164_PHONE_INPUT_PATTERN } from '@/features/creators/auth-schema';

type SignUpPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const { error, message } = await searchParams;

  return (
    <AuthShell
      eyebrow="About two minutes"
      title="Create your link."
      description="Start with the essentials. Profile setup comes next."
    >
      <AuthMessage error={error} message={message} />
      <form className="auth-form" action={signUp}>
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
          <Label htmlFor="whatsappNumber">WhatsApp number</Label>
          <Input
            id="whatsappNumber"
            name="whatsappNumber"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+27821234567"
            pattern={E164_PHONE_INPUT_PATTERN}
            maxLength={16}
            title="Use international format, for example +27821234567."
            required
          />
          <p className="field-help">
            Use international format without spaces, for example +27821234567.
            Verification comes later.
          </p>
        </div>
        <div className="field-stack">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="10+ characters with a number"
            minLength={10}
            required
          />
        </div>
        <div className="consent-list">
          <label className="consent-row" htmlFor="isAdult">
            <Checkbox id="isAdult" name="isAdult" required />
            <span>I confirm that I am 18 or older.</span>
          </label>
          <label className="consent-row" htmlFor="acceptsTerms">
            <Checkbox id="acceptsTerms" name="acceptsTerms" required />
            <span>I accept the Terms of Service.</span>
          </label>
          <label className="consent-row" htmlFor="acceptsPrivacy">
            <Checkbox id="acceptsPrivacy" name="acceptsPrivacy" required />
            <span>I accept the Privacy Policy.</span>
          </label>
          <label className="consent-row" htmlFor="whatsappConsent">
            <Checkbox id="whatsappConsent" name="whatsappConsent" required />
            <span>I agree to receive booking notifications on WhatsApp.</span>
          </label>
        </div>
        <Button type="submit" size="lg" className="w-full">
          Create my account
        </Button>
      </form>
      <p className="auth-switch">
        Already have an account? <Link href="/auth/sign-in">Sign in</Link>
      </p>
    </AuthShell>
  );
}
