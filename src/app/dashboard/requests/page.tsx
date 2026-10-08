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
import { activitySchema, preferredContactSchema } from '@/features/booking/contact-dto';
export const dynamic = 'force-dynamic';
export default async function CreatorRequestsPage() {
  const db = await createClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) redirect('/auth/sign-in?next=%2Fdashboard%2Frequests');
  const { data, error } = await db
    .from('dt_requests')
    .select(REQUEST_COLUMNS)
    .eq('creator_id', auth.user.id)
    .order('created_at', { ascending: false })
    .limit(100);
  const parsed = requestDtoSchema.array().safeParse(data);
  const { data: meetingDetails } = await db.rpc('dt_request_details');
  const { data: contactRows } = await db.rpc('dt_request_contacts');
  const { data: notificationRows } = await db.rpc('dt_notification_statuses');
  const { data: activityRows } = await db.rpc('dt_notification_feed');
  const activity = activitySchema.array().safeParse(activityRows);
  const parsedContacts = preferredContactSchema.array().safeParse(contactRows);
  const contacts = Object.fromEntries(
    (parsedContacts.success ? parsedContacts.data : []).map((d) => [d.request_id, d]),
  );
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
        <Link className="dt-text-button" href="/dashboard">
          ← Edit my page
        </Link>
      </nav>
      <div className="dt-workspace-heading">
        <div>
          <p className="eyebrow">Your client inbox</p>
          <h1>New possibilities.</h1>
          <p>Review requests, accept the right fit, and keep your time yours.</p>
        </div>
      </div>
      {error || !parsed.success ? (
        <p className="dt-notice dt-error" role="alert">
          Could not load your client requests. Please reload.
        </p>
      ) : (
        <RequestList
          requests={parsed.data}
          creator
          details={details}
          contacts={contacts}
          notifications={notifications}
          activity={activity.success ? activity.data : []}
        />
      )}
      <p className="dt-muted">Showing your latest 100 requests.</p>
    </main>
  );
}
