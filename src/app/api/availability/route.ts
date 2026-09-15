import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const input = z
    .object({
      service: z.uuid(),
      month: z.string().regex(/^\d{4}-\d{2}$/),
    })
    .safeParse(Object.fromEntries(url.searchParams));
  if (!input.success)
    return Response.json({ error: 'Invalid month.' }, { status: 400 });
  const db = await createClient();
  const { data, error } = await db.rpc('dt_available_dates', {
    service: input.data.service,
    month_start: `${input.data.month}-01`,
  });
  return Response.json(
    error
      ? { error: 'Could not load available dates.' }
      : { dates: (data ?? []).map((row) => row.available_date) },
    { status: error ? 503 : 200, headers: { 'Cache-Control': 'no-store' } },
  );
}
