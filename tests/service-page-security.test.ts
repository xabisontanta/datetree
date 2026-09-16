import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const sql = readFileSync(
  'supabase/migrations/20260914132005_service_pages_and_requests.sql',
  'utf8',
);
const bookingFixSql = readFileSync(
  'supabase/migrations/20260915151736_improve_booking_calendar_and_manual_payments.sql',
  'utf8',
);
const socialAndNotificationSql = readFileSync(
  'supabase/migrations/20260915203808_creator_social_links_and_notifications.sql',
  'utf8',
);
const notificationHardeningSql = readFileSync(
  'supabase/migrations/20260916014755_harden_notification_delivery.sql',
  'utf8',
);
describe('service-page migration contracts', () => {
  it('enforces overlap with a database exclusion constraint', () => {
    expect(sql).toContain('exclude using gist');
    expect(sql).toContain('reserved_from is not null');
  });
  it('keeps new data tables behind RLS and denies direct mutations', () => {
    for (const table of [
      'dt_page_drafts',
      'dt_services',
      'dt_requests',
      'dt_request_events',
      'dt_notification_outbox',
    ])
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    expect(sql).not.toMatch(/grant (insert|update|all)[^;]*dt_requests/i);
  });
  it('uses the private published schedule, not the working draft for slots', () => {
    const slots = sql.slice(
      sql.indexOf('create function dt_private.slots'),
      sql.indexOf('create function dt_private.submit_request'),
    );
    expect(slots).toContain('dt_private.published_settings');
    expect(slots).not.toContain('dt_page_drafts');
  });
  it('checks actual consent and complete terms instead of trusting null comparisons', () => {
    expect(sql).toContain("(payload->'adult') is distinct from 'true'::jsonb");
    expect(sql).toContain("s is distinct from payload->'serviceSnapshot'");
    expect(sql).toContain('dt_private.valid_document(d)');
  });
  it('keeps media private and public RPCs invoker-only', () => {
    expect(sql).toContain("'date-tree-media','date-tree-media',false");
    const exposed = sql.match(/create function public\.[\s\S]+?\$\$;/g) ?? [];
    expect(exposed.length).toBeGreaterThan(4);
    for (const fn of exposed) expect(fn).toContain('security invoker');
  });
  it('publishes only bookable dates and blocks an accepted local day', () => {
    expect(bookingFixSql).toContain('create function public.dt_available_dates');
    expect(bookingFixSql).toContain(
      '(r.start_at at time zone tz)::date=(t at time zone tz)::date',
    );
    expect(bookingFixSql).toContain(
      'revoke all on function dt_private.available_dates(uuid,date)',
    );
  });
  it('allows fixed-price acceptance without claiming payment was collected', () => {
    expect(bookingFixSql).not.toContain('Paid requests cannot be accepted yet.');
    expect(bookingFixSql).toContain("target:='CONFIRMED'");
  });
  it('keeps notification destinations private and delivery writes service-only', () => {
    expect(socialAndNotificationSql).toContain(
      'alter table dt_private.notification_deliveries enable row level security',
    );
    expect(socialAndNotificationSql).toContain(
      'unique(event_id, recipient_role, channel)',
    );
    expect(socialAndNotificationSql).toContain('to service_role');
    const statusProjection = socialAndNotificationSql.slice(
      socialAndNotificationSql.indexOf(
        'create function dt_private.notification_statuses',
      ),
      socialAndNotificationSql.indexOf(
        'create function public.dt_notification_statuses',
      ),
    );
    expect(statusProjection).not.toContain('recipient_address');
  });
  it('validates custom icons as owned media and publishes only referenced icons', () => {
    expect(socialAndNotificationSql).toContain(
      "union all select value ->> 'icon' from jsonb_array_elements(p -> 'links')",
    );
    expect(socialAndNotificationSql).toContain("link ->> 'icon' = name");
    expect(socialAndNotificationSql).toContain(
      'valid_document_without_custom_link_icons',
    );
  });
  it('protects WhatsApp verification behind a service-only boundary', () => {
    expect(notificationHardeningSql).toContain(
      'revoke insert, update on table public.profiles_private from authenticated',
    );
    expect(notificationHardeningSql).toContain(
      'grant execute on function dt_private.mark_whatsapp_verified(uuid, text)',
    );
    expect(notificationHardeningSql).toContain('to service_role');
    expect(notificationHardeningSql).not.toMatch(
      /grant execute on function dt_private\.mark_whatsapp_verified\([\s\S]+?to authenticated/i,
    );
  });
  it('uses provider-safe idempotency keys and fenced reclaimable leases', () => {
    expect(notificationHardeningSql).toContain(
      "check (idempotency_key ~ '^[A-Za-z0-9_-]{1,255}$')",
    );
    expect(notificationHardeningSql).toContain('claim_token uuid');
    expect(notificationHardeningSql).toContain('for update skip locked');
    expect(notificationHardeningSql).toContain(
      "statement_timestamp() - interval '5 minutes'",
    );
    expect(notificationHardeningSql).toContain(
      'and result.claim_token = delivery_claim',
    );
  });
});
