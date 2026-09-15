import { createClient } from '@/lib/supabase/server';
import { validateImagePixels } from '@/features/creators/image-validation';
const headers = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
};
export async function GET(request: Request) {
  const path = new URL(request.url).searchParams.get('path') ?? '';
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.png$/.test(path))
    return new Response('Not found', { status: 404, headers });
  const db = await createClient();
  const { data, error } = await db.storage.from('date-tree-media').download(path);
  if (error || !data) return new Response('Not found', { status: 404, headers });
  try {
    await validateImagePixels(new Uint8Array(await data.arrayBuffer()));
  } catch {
    return new Response('Invalid image', { status: 422, headers });
  }
  return new Response(data, {
    headers: {
      ...headers,
      'Content-Type': 'image/png',
      'Content-Disposition': 'inline; filename="image.png"',
    },
  });
}
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return new Response('Forbidden', { status: 403 });
  const db = await createClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user?.email_confirmed_at)
    return Response.json({ error: 'Sign in again before uploading.' }, { status: 401 });
  if (Number(request.headers.get('content-length')) > 5242880)
    return Response.json({ error: 'Image must be under 5 MB.' }, { status: 413 });
  const reader = request.body?.getReader();
  if (!reader) return new Response('Missing image', { status: 400 });
  let length = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 5242880) {
      await reader.cancel();
      return new Response('Image too large', { status: 413 });
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    await validateImagePixels(bytes);
  } catch {
    return Response.json(
      { error: 'Could not validate this image. Choose another JPG, PNG or WebP.' },
      { status: 400 },
    );
  }
  const path = `${auth.user.id}/${crypto.randomUUID()}.png`;
  const { error } = await db.storage.from('date-tree-media').upload(path, bytes, {
    contentType: 'image/png',
    upsert: false,
    cacheControl: '0',
  });
  return Response.json(
    error ? { error: 'Upload failed. Try again or sign in again.' } : { path },
    { status: error ? 503 : 201, headers },
  );
}
