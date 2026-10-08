export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
export async function rpc<T>(
  url: string,
  key: string,
  name: string,
  body: Record<string, unknown>,
) {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`database_${response.status}`);
  return (await response.json()) as T;
}
export async function authenticatedUser(request: Request, url: string, key: string) {
  const authorization = request.headers.get('Authorization');
  if (!authorization) return null;
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: authorization },
  });
  if (!response.ok) return null;
  const user = (await response.json()) as { id?: string };
  const session = await fetch(`${url}/rest/v1/rpc/dt_contact_settings`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: authorization,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  return session.ok ? (user.id ?? null) : null;
}
export async function secureEqual(a: string, b: string) {
  const digest = async (value: string) =>
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    );
  const [x, y] = await Promise.all([digest(a), digest(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!;
  return diff === 0;
}
