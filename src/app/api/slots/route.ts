import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const input = z
    .object({
      service: z.uuid(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .safeParse(Object.fromEntries(url.searchParams));
  if (!input.success) return Response.json({ error: 'Invalid date.' }, { status: 400 });
  const db = await createClient();
  const { data, error } = await db.rpc('dt_available_slots', {
    service: input.data.service,
    from_date: input.data.date,
  });
  return Response.json(
    error
      ? { error: 'Could not load availability.' }
      : { slots: (data ?? []).map((s) => ({ start: s.start_at, end: s.end_at })) },
    { status: error ? 503 : 200, headers: { 'Cache-Control': 'no-store' } },
  );
}
