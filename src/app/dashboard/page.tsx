import { redirect } from 'next/navigation';

import { signOut } from '@/app/auth/actions';
import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/ui/button';
import { hasSupabasePublicConfig } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  if (!hasSupabasePublicConfig()) {
    redirect(
      '/auth/sign-in?error=Authentication%20is%20not%20configured%20in%20this%20environment.',
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect('/auth/sign-in');
  }

  const email =
    typeof data.claims.email === 'string' ? data.claims.email : 'Creator account';

  return (
    <main className="dashboard-page">
      <nav className="dashboard-nav" aria-label="Creator dashboard">
        <BrandMark />
        <form action={signOut}>
          <Button type="submit" variant="secondary" size="sm">
            Sign out
          </Button>
        </form>
      </nav>
      <section className="dashboard-empty">
        <p className="eyebrow">Phase 1 foundation</p>
        <h1>Your creator space is ready.</h1>
        <p>
          Signed in as {email}. Profile onboarding will be implemented in the next
          product phase.
        </p>
        <div className="privacy-chip">
          Private account data is protected by server authorization and RLS.
        </div>
      </section>
    </main>
  );
}
