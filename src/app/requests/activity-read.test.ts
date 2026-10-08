import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
vi.mock('@/services/notifications/dispatch', () => ({
  dispatchRequestNotifications: vi.fn(),
}));
import { markRequestActivityRead } from './actions';

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ error: null });
});
describe('read activity cache invalidation', () => {
  it('marks only the rendered watermark and refreshes both inbox/detail routes', async () => {
    await markRequestActivityRead(id, 42);
    expect(mocks.rpc).toHaveBeenCalledWith('dt_mark_activity_read', {
      rid: id,
      through_event: 42,
    });
    expect(mocks.revalidate.mock.calls.map(([path]) => path)).toEqual([
      '/dashboard/requests',
      '/requests',
      `/dashboard/requests/${id}`,
      `/requests/${id}`,
    ]);
  });
  it('does not report changed read state after authorization or persistence fails', async () => {
    mocks.rpc.mockResolvedValue({ error: { message: 'Request not found' } });
    await markRequestActivityRead(id, 42);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it('rejects malformed identifiers and unsafe watermarks before calling the database', async () => {
    await markRequestActivityRead('wrong', 42);
    await markRequestActivityRead(id, Number.MAX_SAFE_INTEGER + 1);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
