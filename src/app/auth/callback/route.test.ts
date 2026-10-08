import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  hasConfig: vi.fn(() => true),
  provisionProfile: vi.fn(),
}));
vi.mock('next/server', () => ({
  NextResponse: {
    redirect: (url: URL) =>
      new Response(null, {
        status: 307,
        headers: { location: url.toString() },
      }),
  },
}));
vi.mock('@/lib/supabase/config', () => ({ hasSupabasePublicConfig: mocks.hasConfig }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/features/creators/provision-private-profile', () => ({
  provisionPrivateCreatorProfile: mocks.provisionProfile,
}));
import { GET } from './route';

function client() {
  return {
    auth: {
      exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
      verifyOtp: vi.fn().mockResolvedValue({ error: null }),
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null }),
    },
  };
}
function callback(next: string, code = 'test-code') {
  const url = new URL('https://date-tree.example/auth/callback');
  url.searchParams.set('next', next);
  if (code) url.searchParams.set('code', code);
  return new Request(url);
}
function location(response: Response) {
  return new URL(response.headers.get('location')!);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasConfig.mockReturnValue(true);
  mocks.provisionProfile.mockResolvedValue({ error: null });
  mocks.createClient.mockResolvedValue(client());
});

describe('exact destinations after email authentication', () => {
  it('returns the creator to the request review intent without performing its action', async () => {
    const next =
      '/dashboard/requests/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?intent=accept';
    const result = location(await GET(callback(next)));
    expect(result.pathname + result.search).toBe(next);
    expect(mocks.provisionProfile).toHaveBeenCalledOnce();
  });

  it.each([
    '/requests/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '/settings/notifications',
    '/test-creator?service=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '/dashboard-other',
    '/auth/update-password?next=%2Frequests',
  ])('does not create a creator profile for %s', async (next) => {
    expect(location(await GET(callback(next))).pathname).toBe(
      new URL(next, 'https://date-tree.example').pathname,
    );
    expect(mocks.provisionProfile).not.toHaveBeenCalled();
  });

  it.each(['configuration', 'invalid', 'expired', 'session', 'profile'])(
    'retains safe next when %s fails',
    async (reason) => {
      const db = client();
      mocks.createClient.mockResolvedValue(db);
      if (reason === 'configuration') mocks.hasConfig.mockReturnValue(false);
      if (reason === 'expired')
        db.auth.exchangeCodeForSession.mockResolvedValue({
          error: { message: 'expired' },
        });
      if (reason === 'session')
        db.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
      if (reason === 'profile')
        mocks.provisionProfile.mockResolvedValue({ error: { message: 'failed' } });
      const next =
        '/dashboard/requests/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?intent=decline';
      const result = location(
        await GET(callback(next, reason === 'invalid' ? '' : 'test-code')),
      );
      expect(result.pathname).toBe('/auth/error');
      expect(result.searchParams.get('reason')).toBe(reason);
      expect(result.searchParams.get('next')).toBe(next);
    },
  );

  it('does not carry an external next destination into an error retry', async () => {
    mocks.hasConfig.mockReturnValue(false);
    const result = location(await GET(callback('//attacker.test')));
    expect(result.origin).toBe('https://date-tree.example');
    expect(result.searchParams.get('next')).toBe('/dashboard');
  });
});
