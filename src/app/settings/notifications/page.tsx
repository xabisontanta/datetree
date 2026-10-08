import Link from 'next/link';
import { redirect } from 'next/navigation';
import { loadContactSettings } from './actions';
import { ContactSettingsView } from '@/features/requester/notification-settings';
import { createClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const db = await createClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user?.email_confirmed_at)
    redirect('/requests/sign-in?next=%2Fsettings%2Fnotifications');
  const settings = await loadContactSettings();
  if (!settings)
    return (
      <main className="dt-app dt-narrow">
        <p role="alert">Could not load your notification settings. Please reload.</p>
      </main>
    );
  return (
    <main className="dt-app dt-narrow">
      <Link href="/requests">Your requests</Link>
      <h1>Notification settings</h1>
      <ContactSettingsView initial={settings} />
    </main>
  );
}
