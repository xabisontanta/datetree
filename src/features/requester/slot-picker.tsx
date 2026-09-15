'use client';
import { Button } from '@/components/ui/button';

import { useEffect, useState } from 'react';
import { Field, Notice } from '@/components/editor-fields';
type Slot = { start: string; end: string };
export function SlotPicker({
  serviceId,
  selected,
  onChange,
}: {
  serviceId: string;
  selected: string;
  onChange: (value: string) => void;
}) {
  const [date, setDate] = useState('');
  const [zone, setZone] = useState('UTC');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    setDate(new Date().toLocaleDateString('en-CA'));
  }, []);
  useEffect(() => {
    if (!date) return;
    const abort = new AbortController();
    setLoading(true);
    setError('');
    setSlots([]);
    // A visitor's calendar date can straddle two UTC dates. Fetch surrounding
    // UTC days, then filter using the visitor's named timezone.
    const base = new Date(`${date}T12:00:00Z`);
    const dates = [-1, 0, 1].map((n) =>
      new Date(base.getTime() + n * 86400000).toISOString().slice(0, 10),
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
        const format = new Intl.DateTimeFormat('en-CA', {
          timeZone: zone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
        const unique = new Map(
          groups
            .flat()
            .filter((s) => format.format(new Date(s.start)) === date)
            .map((s) => [s.start, s]),
        );
        setSlots([...unique.values()].sort((a, b) => a.start.localeCompare(b.start)));
      })
      .catch((e) => {
        if (!abort.signal.aborted)
          setError(e instanceof Error ? e.message : 'Could not load times.');
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [date, serviceId, zone]);
  return (
    <div className="dt-stack">
      <Field
        label="Choose a date"
        type="date"
        value={date}
        min={new Date().toLocaleDateString('en-CA')}
        max={new Date(Date.now() + 90 * 86400000).toLocaleDateString('en-CA')}
        onChange={(e) => {
          setDate(e.target.value);
          onChange('');
        }}
      />
      <small>
        Times shown in {zone}. Availability may change until your request is accepted.
      </small>
      {loading && <output>Finding available times…</output>}
      {error && <Notice error>{error}</Notice>}
      {!loading && !error && date && !slots.length && (
        <p className="dt-empty">No times available on this date. Try another day.</p>
      )}
      <div className="dt-slot-grid">
        {slots.map((s) => (
          <Button
            variant="ghost"
            key={s.start}
            type="button"
            aria-pressed={selected === s.start}
            onClick={() => onChange(s.start)}
          >
            {new Intl.DateTimeFormat('en', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: zone,
              timeZoneName: 'shortOffset',
            }).format(new Date(s.start))}
          </Button>
        ))}
      </div>
    </div>
  );
}
