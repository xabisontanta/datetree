const dayMs = 86_400_000;

export function localDateKey(date: Date, zone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function restoreCalendarSelection(selected: string, zone: string, now: Date) {
  const today = localDateKey(now, zone);
  const instant = new Date(selected);
  const date = Number.isFinite(instant.getTime()) ? localDateKey(instant, zone) : '';
  return { today, date, month: (date || today).slice(0, 7) };
}

export function shiftMonth(month: string, amount: number) {
  const [year, value] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year!, value! - 1 + amount, 1));
  return date.toISOString().slice(0, 7);
}

export function monthCells(month: string) {
  const [year, value] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year!, value! - 1, 1));
  const count = new Date(Date.UTC(year!, value!, 0)).getUTCDate();
  return [
    ...Array.from({ length: first.getUTCDay() }, () => null),
    ...Array.from({ length: count }, (_, index) => {
      const date = new Date(first.getTime() + index * dayMs);
      return date.toISOString().slice(0, 10);
    }),
  ];
}
