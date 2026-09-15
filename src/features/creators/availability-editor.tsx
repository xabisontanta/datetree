'use client';
import { Button } from '@/components/ui/button';

import { Field, Select } from '@/components/editor-fields';
import type { Availability } from './page-schema';
const days = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
export function AvailabilityEditor({
  value: a,
  scheduled,
  onChange,
}: {
  value: Availability;
  scheduled: boolean;
  onChange: (a: Availability) => void;
}) {
  const zones = Intl.supportedValuesOf('timeZone');
  return (
    <div className="dt-stack">
      <p className="dt-muted">
        {scheduled
          ? 'Set times when clients can request an appointment. Pending requests don’t reserve time.'
          : 'Your services don’t need appointments. You can skip this step or prepare availability for later.'}
      </p>
      <Select
        label="Your timezone"
        value={a.timezone}
        onChange={(e) => onChange({ ...a, timezone: e.target.value })}
      >
        {Array.from(new Set([a.timezone, 'UTC', ...zones])).map((zone) => (
          <option key={zone}>{zone}</option>
        ))}
      </Select>
      <h3>Weekly availability</h3>
      {a.windows.length === 0 && (
        <div className="dt-empty">
          No weekly hours yet.
          <Button
            variant="ghost"
            type="button"
            className="dt-text-button"
            onClick={() =>
              onChange({
                ...a,
                windows: [1, 2, 3, 4, 5].map((day) => ({
                  day,
                  start: '09:00',
                  end: '17:00',
                })),
              })
            }
          >
            Use Monday–Friday, 09:00–17:00
          </Button>
        </div>
      )}
      {a.windows.map((w, i) => (
        <div className="dt-panel dt-row" key={i}>
          <Select
            label="Day"
            value={w.day}
            onChange={(e) =>
              onChange({
                ...a,
                windows: a.windows.map((v, n) =>
                  n === i ? { ...v, day: Number(e.target.value) } : v,
                ),
              })
            }
          >
            {days.map((day, n) => (
              <option value={n} key={day}>
                {day}
              </option>
            ))}
          </Select>
          {(['start', 'end'] as const).map((key) => (
            <Field
              key={key}
              label={key === 'start' ? 'From' : 'Until'}
              type="time"
              value={w[key]}
              onChange={(e) =>
                onChange({
                  ...a,
                  windows: a.windows.map((v, n) =>
                    n === i ? { ...v, [key]: e.target.value } : v,
                  ),
                })
              }
            />
          ))}
          <Button
            variant="ghost"
            type="button"
            className="dt-text-button"
            onClick={() =>
              onChange({ ...a, windows: a.windows.filter((_, n) => n !== i) })
            }
            aria-label={`Remove ${days[w.day]} window`}
          >
            Remove
          </Button>
        </div>
      ))}
      {a.windows.length < 28 && (
        <Button
          variant="ghost"
          type="button"
          className="dt-button-secondary"
          onClick={() =>
            onChange({
              ...a,
              windows: [...a.windows, { day: 1, start: '09:00', end: '17:00' }],
            })
          }
        >
          ＋ Add hours
        </Button>
      )}
      <small>
        End earlier than start means overnight. Repeated daylight-saving hours are shown
        with their UTC offset; a window whose boundary falls in a skipped hour is
        omitted.
      </small>
      <details>
        <summary>Booking preferences and days off</summary>
        <div className="dt-stack dt-detail-body">
          <div className="dt-row">
            <Field
              label="Minimum notice (hours)"
              type="number"
              min="0"
              max="168"
              value={a.notice}
              onChange={(e) => onChange({ ...a, notice: Number(e.target.value) })}
            />
            <Field
              label="Book ahead (days)"
              type="number"
              min="1"
              max="90"
              value={a.horizon}
              onChange={(e) => onChange({ ...a, horizon: Number(e.target.value) })}
            />
            <Field
              label="Buffer per appointment side (minutes)"
              type="number"
              min="0"
              max="120"
              value={a.buffer}
              onChange={(e) => onChange({ ...a, buffer: Number(e.target.value) })}
            />
          </div>
          <h3>Date overrides</h3>
          <p>
            Replace weekly hours for one date, or leave its hours empty to take the day
            off. Overrides also stop overnight hours spilling into that date.
          </p>
          {a.exceptions.map((ex, i) => (
            <div key={i} className="dt-panel dt-stack">
              <Field
                label="Date"
                type="date"
                value={ex.date}
                onChange={(e) =>
                  onChange({
                    ...a,
                    exceptions: a.exceptions.map((v, n) =>
                      n === i ? { ...v, date: e.target.value } : v,
                    ),
                  })
                }
              />
              {ex.windows.map((w, wi) => (
                <div className="dt-row" key={wi}>
                  {(['start', 'end'] as const).map((key) => (
                    <Field
                      key={key}
                      label={key === 'start' ? 'From' : 'Until'}
                      type="time"
                      value={w[key]}
                      onChange={(e) =>
                        onChange({
                          ...a,
                          exceptions: a.exceptions.map((v, n) =>
                            n === i
                              ? {
                                  ...v,
                                  windows: v.windows.map((vv, nn) =>
                                    nn === wi ? { ...vv, [key]: e.target.value } : vv,
                                  ),
                                }
                              : v,
                          ),
                        })
                      }
                    />
                  ))}
                  <Button
                    variant="ghost"
                    type="button"
                    className="dt-text-button"
                    onClick={() =>
                      onChange({
                        ...a,
                        exceptions: a.exceptions.map((v, n) =>
                          n === i
                            ? { ...v, windows: v.windows.filter((_, nn) => nn !== wi) }
                            : v,
                        ),
                      })
                    }
                  >
                    Remove hours
                  </Button>
                </div>
              ))}
              {ex.windows.length === 0 && <small>Day off — no appointments.</small>}
              {ex.windows.length < 4 && (
                <Button
                  variant="ghost"
                  type="button"
                  className="dt-text-button"
                  onClick={() =>
                    onChange({
                      ...a,
                      exceptions: a.exceptions.map((v, n) =>
                        n === i
                          ? {
                              ...v,
                              windows: [
                                ...v.windows,
                                { day: 0, start: '09:00', end: '17:00' },
                              ],
                            }
                          : v,
                      ),
                    })
                  }
                >
                  ＋ Add override hours
                </Button>
              )}
              <Button
                variant="ghost"
                type="button"
                className="dt-text-button"
                onClick={() =>
                  onChange({ ...a, exceptions: a.exceptions.filter((_, n) => n !== i) })
                }
              >
                Remove override
              </Button>
            </div>
          ))}
          {a.exceptions.length < 90 && (
            <Button
              variant="ghost"
              type="button"
              className="dt-button-secondary"
              onClick={() =>
                onChange({
                  ...a,
                  exceptions: [
                    ...a.exceptions,
                    { date: new Date().toISOString().slice(0, 10), windows: [] },
                  ],
                })
              }
            >
              ＋ Add a day off or override
            </Button>
          )}
        </div>
      </details>
    </div>
  );
}
