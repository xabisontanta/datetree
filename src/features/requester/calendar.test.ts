import { describe, expect, it } from 'vitest';
import { localDateKey, monthCells, shiftMonth } from './calendar';

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
});
