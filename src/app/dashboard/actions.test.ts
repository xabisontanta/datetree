import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyPage, newService } from '@/features/creators/page-schema';
function validPage() {
  const d = emptyPage();
  d.profile.username = 'test-coach';
  d.profile.displayName = 'Coach';
  d.services = [newService('enquiry')];
  return d;
}
const mocks = vi.hoisted(() => ({ createClient: vi.fn(), revalidate: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
import { savePage } from './actions';
beforeEach(() => vi.clearAllMocks());
describe('savePage boundary', () => {
  it('rejects malformed input before database calls', async () => {
    expect((await savePage({}, 0)).error).toBeTruthy();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it('requires server-verified identity', async () => {
    const rpc = vi.fn();
    mocks.createClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null } }) },
      rpc,
    });
    expect((await savePage(validPage(), 0)).error).toContain('session');
    expect(rpc).not.toHaveBeenCalled();
  });
  it('uses revision guarded RPC and handles collisions safely', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ error: { code: '23505', message: 'private raw details' } });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) },
      rpc,
    });
    const result = await savePage(validPage(), 3);
    expect(result.error).toContain('username');
    expect(result.error).not.toContain('private raw');
    expect(rpc).toHaveBeenCalledWith(
      'dt_save_page',
      expect.objectContaining({ expected_revision: 3 }),
    );
  });
});
