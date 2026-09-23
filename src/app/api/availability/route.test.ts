import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), createClient: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
import { GET } from './route';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
});
const service = '11000000-0000-4000-8000-000000000001';
describe('public date availability', () => {
  it('uses the selected visitor zone without exposing private settings', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ available_date: '2026-10-01' }], error: null });
    const response = await GET(new Request(`https://example.test/api/availability?service=${service}&month=2026-10&timezone=Pacific%2FKiritimati`));
    expect(mocks.rpc).toHaveBeenCalledWith('dt_available_dates_in_zone', { service, month_start: '2026-10-01', visitor_timezone: 'Pacific/Kiritimati' });
    expect(await response.json()).toEqual({ dates: ['2026-10-01'] });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
  it('rejects invalid month or zone before accessing the database', async () => {
    for (const query of ['month=2026-13&timezone=UTC', 'month=2026-10&timezone=Not%2FReal']) {
      expect((await GET(new Request(`https://example.test/api/availability?service=${service}&${query}`))).status).toBe(400);
    }
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it('redacts database failures', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'private SQL details' } });
    const response = await GET(new Request(`https://example.test/api/availability?service=${service}&month=2026-10&timezone=UTC`));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private SQL');
  });
});
