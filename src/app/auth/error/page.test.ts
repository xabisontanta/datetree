import { describe, expect, it, vi } from 'vitest';
vi.mock('next/link', () => ({ default: () => null }));
vi.mock('@/components/auth/auth-shell', () => ({ AuthShell: () => null }));
import AuthErrorPage from './page';

async function retryLink(next: string) {
  const view = await AuthErrorPage({ searchParams: Promise.resolve({ next }) });
  return view.props.children.props.href as string;
}

describe('retrying an expired authentication link', () => {
  it.each([
    '/requests/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '/settings/notifications',
  ])(
    'returns %s to requester verification rather than creator onboarding',
    async (next) => {
      expect(await retryLink(next)).toBe(
        `/requests/sign-in?next=${encodeURIComponent(next)}`,
      );
    },
  );

  it('retains the creator request and action intent', async () => {
    const next =
      '/dashboard/requests/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?intent=accept';
    expect(await retryLink(next)).toBe(
      `/auth/sign-in?next=${encodeURIComponent(next)}`,
    );
  });

  it('returns a public-service link to its existing verification form', async () => {
    const next = '/test-creator?service=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    expect(await retryLink(next)).toBe(next);
  });

  it('restarts recovery while preserving the private request destination', async () => {
    const destination = '/requests/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    expect(
      await retryLink(`/auth/update-password?next=${encodeURIComponent(destination)}`),
    ).toBe(`/auth/forgot-password?next=${encodeURIComponent(destination)}`);
  });

  it('rejects external retry destinations', async () => {
    expect(await retryLink('//attacker.test')).toBe('/auth/sign-in?next=%2Fdashboard');
  });
});
