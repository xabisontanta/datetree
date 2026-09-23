import { describe, expect, it } from 'vitest';
import {
  localDateKey,
  monthCells,
  restoreCalendarSelection,
  shiftMonth,
} from './calendar';

describe('availability calendar helpers', () => {
  it('builds a correctly aligned month', () => {
    const cells = monthCells('2026-09');
    expect(cells.slice(0, 2)).toEqual([null, null]);
    expect(cells[2]).toBe('2026-09-01');
    expect(cells.at(-1)).toBe('2026-09-30');
  });

  it('moves safely across year boundaries', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });

  it('uses the visitor timezone for date keys', () => {
    expect(localDateKey(new Date('2026-09-15T22:30:00Z'), 'Africa/Johannesburg')).toBe(
      '2026-09-16',
    );
  });

  it('restores the selected visitor-local day and month after Review/Edit', () => {
    expect(
      restoreCalendarSelection(
        '2026-09-30T22:30:00Z',
        'Africa/Johannesburg',
        new Date('2026-09-23T10:00:00Z'),
      ),
    ).toEqual({ today: '2026-09-23', date: '2026-10-01', month: '2026-10' });
  });

  it('restores the same chosen day across a daylight-saving fallback', () => {
    const now = new Date('2026-10-20T12:00:00Z');
    const early = restoreCalendarSelection(
      '2026-11-01T05:30:00Z',
      'America/New_York',
      now,
    );
    const late = restoreCalendarSelection(
      '2026-11-01T06:30:00Z',
      'America/New_York',
      now,
    );
    expect(early).toEqual(late);
    expect(early).toEqual({ today: '2026-10-20', date: '2026-11-01', month: '2026-11' });
  });

  it.each(['', 'not-an-instant'])('uses local today without a valid selection: %s', (value) => {
    expect(
      restoreCalendarSelection(
        value,
        'Pacific/Honolulu',
        new Date('2026-10-01T03:00:00Z'),
      ),
    ).toEqual({ today: '2026-09-30', date: '', month: '2026-09' });
  });
});
