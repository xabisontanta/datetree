import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { activitySchema, preferredContactSchema } from './contact-dto';
import {
  REQUEST_COLUMNS,
  requestDtoSchema,
  notificationStatusDtoSchema,
  groupNotificationStatuses,
} from './request-dto';
import { RequestList } from './request-list';
import { ActivityRead } from './activity-read';

export async function RequestDetail({
  id,
  creator,
  intent,
}: {
  id: string;
  creator: boolean;
  intent?: string;
}) {
  if (!z.uuid().safeParse(id).success) notFound();
  const db = await createClient();
  const { data: auth } = await db.auth.getUser();
  const path = `${creator ? '/dashboard' : ''}/requests/${id}${intent === 'accept' || intent === 'decline' ? `?intent=${intent}` : ''}`;
  if (!auth.user)
    redirect(
      `${creator ? '/auth' : '/requests'}/sign-in?next=${encodeURIComponent(path)}`,
    );
  const { data } = await db
    .from('dt_requests')
    .select(REQUEST_COLUMNS)
    .eq('id', id)
    .eq(creator ? 'creator_id' : 'requester_id', auth.user.id)
    .maybeSingle();
  const parsed = requestDtoSchema.safeParse(data);
  if (!parsed.success) notFound();
  const [details, contacts, notifications, activity] = await Promise.all([
    db.rpc('dt_request_details'),
    creator ? db.rpc('dt_request_contacts') : Promise.resolve({ data: [] }),
    db.rpc('dt_notification_statuses'),
    db.rpc('dt_notification_feed', { rid: id }),
  ]);
  const contactRows = preferredContactSchema.array().safeParse(contacts.data);
  const statusRows = notificationStatusDtoSchema.array().safeParse(notifications.data);
  const events = activitySchema.array().safeParse(activity.data);
  const feed = events.success ? events.data : [];
  return (
    <main className="dt-app dt-narrow">
      <Link
        href={creator ? '/dashboard/requests' : '/requests'}
        className="dt-text-button"
      >
        Back to inbox
      </Link>
      <h1>Review request</h1>
      {(intent === 'accept' || intent === 'decline') && (
        <p className="dt-notice">
          Review the current details below, then confirm{' '}
          {intent === 'accept' ? 'acceptance' : 'decline'}. Opening this link does not
          change the request.
        </p>
      )}
      <RequestList
        requests={[parsed.data]}
        creator={creator}
        detail
        activity={feed}
        contacts={Object.fromEntries(
          (contactRows.success ? contactRows.data : [])
            .filter((r) => r.request_id === id)
            .map((r) => [r.request_id, r]),
        )}
        details={Object.fromEntries(
          (details.data ?? [])
            .filter((r) => r.request_id === id)
            .map((r) => [r.request_id, r.details]),
        )}
        notifications={groupNotificationStatuses(
          statusRows.success ? statusRows.data.filter((r) => r.request_id === id) : [],
        )}
      />
      {feed.length > 0 && (
        <ActivityRead id={id} through={Math.max(...feed.map((e) => e.event_id))} />
      )}
    </main>
  );
}
