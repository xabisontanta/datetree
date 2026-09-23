import { availabilityQuerySchema } from '@/services/availability/timezone';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const input = availabilityQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!input.success)
    return Response.json(
      { error: 'Choose a valid month and timezone.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  const db = await createClient();
  const { data, error } = await db.rpc('dt_available_dates_in_zone', {
    service: input.data.service,
    month_start: `${input.data.month}-01`,
    visitor_timezone: input.data.timezone,
  });
  return Response.json(
    error
      ? { error: 'Could not load available dates.' }
      : { dates: (data ?? []).map((row) => row.available_date) },
    { status: error ? 503 : 200, headers: { 'Cache-Control': 'no-store' } },
  );
}
