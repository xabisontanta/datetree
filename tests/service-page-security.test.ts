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
});
