import { redirect } from 'next/navigation';

import { updatePassword } from '@/app/auth/actions';
import { AuthMessage } from '@/components/auth/auth-message';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { hasSupabasePublicConfig } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import { safeAuthDestination } from '@/features/creators/auth-destination';

type UpdatePasswordPageProps = {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
};

export default async function UpdatePasswordPage({
  searchParams,
}: UpdatePasswordPageProps) {
  const { error, message, next: destination } = await searchParams;
  const next = safeAuthDestination(destination);
  const recoveryPath = `/auth/forgot-password?next=${encodeURIComponent(next)}&error=`;
  if (!hasSupabasePublicConfig()) {
    redirect(
      `${recoveryPath}Password%20recovery%20is%20not%20configured%20in%20this%20environment.`,
    );
  }

  const supabase = await createClient();
  const { data, error: userError } = await supabase.auth.getUser();

  if (userError || !data.user) {
    redirect(
      `${recoveryPath}Your%20reset%20link%20is%20invalid%20or%20expired.%20Request%20a%20new%20one.`,
    );
  }

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Choose a new password."
      description="Use at least 10 characters, including a letter and a number."
    >
      <AuthMessage error={error} message={message} />
      <form className="auth-form" action={updatePassword}>
        <input type="hidden" name="next" value={next} />
        <div className="field-stack">
          <Label htmlFor="password">New password</Label>
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
        <div className="field-stack">
          <Label htmlFor="passwordConfirmation">Confirm new password</Label>
          <Input
            id="passwordConfirmation"
            name="passwordConfirmation"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat your new password"
            minLength={10}
            required
          />
        </div>
        <Button type="submit" size="lg" className="w-full">
          Update password
        </Button>
      </form>
    </AuthShell>
  );
}
