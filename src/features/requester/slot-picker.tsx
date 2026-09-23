'use client';
import { Button } from '@/components/ui/button';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Notice, Select } from '@/components/editor-fields';
import { timezoneOptions } from '@/services/availability/timezone';
import { localDateKey, monthCells, restoreCalendarSelection, shiftMonth } from './calendar';

type Slot = { start: string; end: string };
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function SlotPicker({
  serviceId,
  selected,
  onChange,
  onTimezoneChange,
  initialTimezone,
}: {
  serviceId: string;
  selected: string;
  onChange: (value: string) => void;
  onTimezoneChange?: (zone: string) => void;
  initialTimezone?: string;
}) {
  const initialSelection = useRef({ selected, timezone: initialTimezone });
  const [date, setDate] = useState('');
  const [zone, setZone] = useState('UTC');
  const [month, setMonth] = useState('');
  const [today, setToday] = useState('');
  const [available, setAvailable] = useState<string[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingDates, setLoadingDates] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const visitorZone =
      initialSelection.current.timezone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone;
    const restored = restoreCalendarSelection(
      initialSelection.current.selected,
      visitorZone,
      new Date(),
    );
    setZone(visitorZone);
    onTimezoneChange?.(visitorZone);
    setToday(restored.today);
    setDate(restored.date);
    setMonth(restored.month);
  }, [onTimezoneChange]);

  useEffect(() => {
    if (!month || !today) return;
    const abort = new AbortController();
    setLoadingDates(true);
    setError('');
    setAvailable([]);
    fetch(
      `/api/availability?service=${serviceId}&month=${month}&timezone=${encodeURIComponent(zone)}`,
      { signal: abort.signal, cache: 'no-store' },
    )
      .then(async (response) => {
        const data = (await response.json()) as { dates?: string[]; error?: string };
        if (abort.signal.aborted) return;
        if (!response.ok)
          throw new Error(data.error || 'Available dates could not be loaded.');
        setAvailable(data.dates ?? []);
        if (date && !(data.dates ?? []).includes(date)) {
          setDate('');
          onChange('');
        }
      })
      .catch((reason) => {
        if (!abort.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : 'Could not load available dates.',
          );
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoadingDates(false);
      });
    return () => abort.abort();
  }, [date, month, onChange, serviceId, today, zone]);

  useEffect(() => {
    if (!date) {
      setSlots([]);
      setLoading(false);
      return;
    }
    const abort = new AbortController();
    setLoading(true);
    setError('');
    setSlots([]);
    const base = new Date(`${date}T12:00:00Z`);
    const dates = [-1, 0, 1].map((n) =>
      new Date(base.getTime() + n * 86_400_000).toISOString().slice(0, 10),
    );
    Promise.all(
      dates.map(async (day) => {
        const response = await fetch(`/api/slots?service=${serviceId}&date=${day}`, {
          signal: abort.signal,
          cache: 'no-store',
        });
        const data = (await response.json()) as { slots?: Slot[]; error?: string };
        if (!response.ok)
          throw new Error(data.error || 'Availability could not be loaded.');
        return data.slots ?? [];
      }),
    )
      .then((groups) => {
        if (abort.signal.aborted) return;
        const unique = new Map(
          groups
            .flat()
            .filter((slot) => localDateKey(new Date(slot.start), zone) === date)
            .map((slot) => [slot.start, slot]),
        );
        setSlots([...unique.values()].sort((a, b) => a.start.localeCompare(b.start)));
      })
      .catch((reason) => {
        if (!abort.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : 'Could not load available times.',
          );
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [date, serviceId, zone]);

  const availableSet = useMemo(() => new Set(available), [available]);
  const zones = useMemo(() => timezoneOptions(zone), [zone]);
  const cells = useMemo(() => (month ? monthCells(month) : []), [month]);
  const monthTitle = month
    ? new Intl.DateTimeFormat('en', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(`${month}-01T12:00:00Z`))
    : '';
  const lastMonth = today
    ? localDateKey(new Date(Date.now() + 90 * 86_400_000), zone).slice(0, 7)
    : month;

  return (
    <div className="dt-stack">
      <Select
        label="Your timezone"
        value={zone}
        onChange={(e) => {
          const next = e.target.value;
          const current = localDateKey(new Date(), next);
          setZone(next);
          setToday(current);
          setMonth(current.slice(0, 7));
          setDate('');
          onChange('');
          onTimezoneChange?.(next);
        }}
      >
        {zones.map((value) => (
          <option key={value} value={value}>
            {value.replaceAll('_', ' ')}
          </option>
        ))}
      </Select>
      <div className="dt-calendar" aria-label="Choose an available date">
        <div className="dt-calendar-header">
          <Button
            variant="ghost"
            type="button"
            aria-label="Previous month"
            disabled={!month || month <= today.slice(0, 7)}
            onClick={() => setMonth(shiftMonth(month, -1))}
          >
            ←
          </Button>
          <strong>{monthTitle}</strong>
          <Button
            variant="ghost"
            type="button"
            aria-label="Next month"
            disabled={!month || month >= lastMonth}
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            →
          </Button>
        </div>
        <div className="dt-calendar-weekdays" aria-hidden="true">
          {weekdays.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="dt-calendar-grid">
          {cells.map((value, index) =>
            value ? (
              <button
                key={value}
                type="button"
                className="dt-calendar-day"
                disabled={loadingDates || !availableSet.has(value)}
                aria-pressed={date === value}
                aria-label={`${value}${availableSet.has(value) ? ', available' : ', unavailable'}`}
                onClick={() => {
                  setDate(value);
                  onChange('');
                }}
              >
                {Number(value.slice(-2))}
              </button>
            ) : (
              <span className="dt-calendar-blank" key={`blank-${index}`} />
            ),
          )}
        </div>
      </div>
      <small>
        Available dates are selectable. Crossed-out dates cannot be requested. Times are
        shown in {zone}.
      </small>
      {loadingDates && <output>Finding available dates…</output>}
      {loading && <output>Finding available times…</output>}
      {error && <Notice error>{error}</Notice>}
      {!loadingDates && !error && !available.length && (
        <p className="dt-empty">
          No dates available in this month. Try the next month.
        </p>
      )}
      {!loading && !error && date && !slots.length && (
        <p className="dt-empty">That date just became unavailable. Choose another.</p>
      )}
      <div className="dt-slot-grid">
        {slots.map((slot) => (
          <Button
            variant="ghost"
            key={slot.start}
            type="button"
            aria-pressed={selected === slot.start}
            onClick={() => onChange(slot.start)}
          >
            {new Intl.DateTimeFormat('en', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: zone,
              timeZoneName: 'shortOffset',
            }).format(new Date(slot.start))}
          </Button>
        ))}
      </div>
    </div>
  );
}
