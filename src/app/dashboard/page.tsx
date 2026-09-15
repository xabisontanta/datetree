import Link from 'next/link';
import { redirect } from 'next/navigation';

import { signOut } from '@/app/auth/actions';
import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/ui/button';
import { hasSupabasePublicConfig } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import { PageBuilder } from '@/features/creators/page-builder';
import { emptyPage, pageDocumentSchema } from '@/features/creators/page-schema';
import { recordCreatorConsent } from './actions';
import { provisionPrivateCreatorProfile } from '@/features/creators/provision-private-profile';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  if (!hasSupabasePublicConfig()) {
    redirect(
      '/auth/sign-in?error=Authentication%20is%20not%20configured%20in%20this%20environment.',
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect('/auth/sign-in');
  }

  await provisionPrivateCreatorProfile(supabase, data.user);
  const [draft, publication, settings] = await Promise.all([
    supabase
      .from('dt_page_drafts')
      .select('document,revision')
      .eq('creator_id', data.user.id)
      .maybeSingle(),
    supabase
      .from('profiles_public')
      .select('is_published,username_locked')
      .eq('creator_id', data.user.id)
      .maybeSingle(),
    supabase
      .from('profiles_private')
      .select('is_adult,terms_accepted_at,privacy_accepted_at,requests_paused_at')
      .eq('id', data.user.id)
      .single(),
  ]);
  const parsed = pageDocumentSchema.safeParse(draft.data?.document);
  const ready =
    settings.data?.is_adult &&
    settings.data.terms_accepted_at &&
    settings.data.privacy_accepted_at;

  return (
    <main className="dt-app">
      <nav className="dashboard-nav" aria-label="Creator dashboard">
        <BrandMark />
        <Link className="dt-text-button" href="/dashboard/requests">
          Client requests
        </Link>
        <form action={signOut}>
          <Button type="submit" variant="secondary" size="sm">
            Sign out
          </Button>
        </form>
      </nav>
      {draft.error || settings.error || publication.error ? (
        <div className="dt-notice dt-error" role="alert">
          We couldn’t load your studio. Please reload; your saved profile has not been
          changed.
        </div>
      ) : (
        <>
          {!ready && (
            <form action={recordCreatorConsent} className="dt-panel dt-stack">
              <h2>Before you publish</h2>
              <p>Confirm the essentials once, then your page is ready to go.</p>
              <label className="dt-toggle">
                <input name="adult" type="checkbox" required />I am 18 or older.
              </label>
              <label className="dt-toggle">
                <input name="terms" type="checkbox" required />I accept the Terms of
                Service.
              </label>
              <label className="dt-toggle">
                <input name="privacy" type="checkbox" required />I accept the Privacy
                Policy.
              </label>
              <button type="submit" className="dt-button">
                Save confirmations
              </button>
            </form>
          )}
          {draft.data && !parsed.success ? (
            <p className="dt-notice dt-error" role="alert">
              Your saved page needs attention before editing. Contact support; we have
              not overwritten it.
            </p>
          ) : (
            <PageBuilder
              initial={parsed.success ? parsed.data : emptyPage()}
              initialRevision={draft.data?.revision ?? 0}
              published={publication.data?.is_published ?? false}
              locked={publication.data?.username_locked ?? false}
              paused={Boolean(settings.data?.requests_paused_at)}
              origin={process.env.NEXT_PUBLIC_APP_URL ?? ''}
            />
          )}
        </>
      )}
    </main>
  );
}
