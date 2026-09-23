import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { RequestList } from '@/features/booking/request-list';
import {
  groupNotificationStatuses,
  notificationStatusDtoSchema,
  REQUEST_COLUMNS,
  requestDtoSchema,
} from '@/features/booking/request-dto';
import { BrandMark } from '@/components/brand-mark';
export const dynamic = 'force-dynamic';
export default async function RequestsPage() {
  const db = await createClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) redirect('/auth/sign-in');
  const { data, error } = await db
    .from('dt_requests')
    .select(REQUEST_COLUMNS)
    .eq('requester_id', auth.user.id)
    .order('created_at', { ascending: false })
    .limit(100);
  const parsed = requestDtoSchema.array().safeParse(data);
  const { data: meetingDetails } = await db.rpc('dt_request_details');
  const { data: notificationRows } = await db.rpc('dt_notification_statuses');
  const details = Object.fromEntries(
    (meetingDetails ?? []).map((d) => [d.request_id, d.details]),
  );
  const parsedNotifications = notificationStatusDtoSchema
    .array()
    .safeParse(notificationRows);
  const notifications = groupNotificationStatuses(
    parsedNotifications.success ? parsedNotifications.data : [],
  );
  return (
    <main className="dt-app dt-narrow">
      <nav className="dashboard-nav">
        <BrandMark />
        <Link href="/dashboard">My studio</Link>
      </nav>
      <div className="dt-workspace-heading">
        <div>
          <p className="eyebrow">Private to you</p>
          <h1>Your requests.</h1>
          <p>Track responses and manage your next step.</p>
        </div>
      </div>
      {error || !parsed.success ? (
        <p className="dt-notice dt-error" role="alert">
          Could not load your requests. Please reload.
        </p>
      ) : (
        <RequestList
          requests={parsed.data}
          creator={false}
          details={details}
          notifications={notifications}
        />
      )}
      <p className="dt-muted">Showing your latest 100 requests.</p>
    </main>
  );
}
