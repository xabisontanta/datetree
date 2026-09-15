'use client';
import { Button } from '@/components/ui/button';

import { Field, Select, TextArea, Toggle } from '@/components/editor-fields';
import { ImageUpload } from './image-upload';
import { newService, type Service } from './page-schema';

const presets = [
  ['Fitness session', 'scheduled'],
  ['Life coaching', 'scheduled'],
  ['Business consultation', 'scheduled'],
  ['Birthday shout-out', 'deliverable'],
  ['Personalised review', 'deliverable'],
  ['Brand collaboration', 'enquiry'],
] as const;
export function ServiceEditor({
  services,
  onChange,
}: {
  services: Service[];
  onChange: (services: Service[]) => void;
}) {
  function patch(index: number, value: Partial<Service>) {
    onChange(services.map((s, i) => (i === index ? { ...s, ...value } : s)));
  }
  function move(index: number, direction: number) {
    const next = [...services];
    [next[index], next[index + direction]] = [next[index + direction]!, next[index]!];
    onChange(next);
  }
  return (
    <div className="dt-stack">
      <p className="dt-muted">
        Appointments, personalised deliveries, or project enquiries. Start with one; add
        more anytime.
      </p>
      {services.length < 20 && (
        <div className="dt-preset-grid">
          {presets.map(([title, kind]) => (
            <Button
              variant="ghost"
              key={title}
              type="button"
              className="dt-option"
              onClick={() => onChange([...services, newService(kind, title)])}
            >
              {title}
              <span>
                {kind === 'scheduled'
                  ? 'Appointment'
                  : kind === 'deliverable'
                    ? 'Delivered remotely'
                    : 'Enquiry'}
              </span>
            </Button>
          ))}
          <Button
            variant="ghost"
            type="button"
            className="dt-option"
            onClick={() =>
              onChange([...services, newService('enquiry', 'My custom service')])
            }
          >
            ＋ Custom service<span>Make it your own</span>
          </Button>
        </div>
      )}
      {!services.length && (
        <div className="dt-empty">
          Choose a starting point above. You can edit every detail.
        </div>
      )}
      {services.map((s, i) => (
        <details
          key={s.id}
          className="dt-panel"
          open={services.length === 1 ? true : undefined}
        >
          <summary>
            <span>
              {i + 1}. {s.title || 'Untitled service'}
            </span>
            <small>{s.active ? 'Active' : 'Archived'}</small>
          </summary>
          <div className="dt-stack dt-detail-body">
            <Field
              label="Service title"
              value={s.title}
              maxLength={80}
              onChange={(e) => patch(i, { title: e.target.value })}
            />
            <Select
              label="How do you offer this?"
              value={s.kind}
              onChange={(e) => {
                const kind = e.target.value as Service['kind'];
                patch(i, {
                  kind,
                  pricing:
                    kind === 'enquiry'
                      ? 'quote'
                      : s.pricing === 'quote'
                        ? 'free'
                        : s.pricing,
                });
              }}
            >
              <option value="scheduled">Appointment — choose a date and time</option>
              <option value="deliverable">Deliverable — no appointment needed</option>
              <option value="enquiry">Enquiry — discuss a project or quote</option>
            </Select>
            <TextArea
              label="Description and what’s included"
              value={s.description}
              maxLength={1000}
              onChange={(e) => patch(i, { description: e.target.value })}
            />
            <div className="dt-row">
              <Select
                label="Pricing"
                value={s.pricing}
                onChange={(e) =>
                  patch(i, { pricing: e.target.value as Service['pricing'] })
                }
              >
                <option value="free">Free</option>
                <option value="fixed">Fixed price</option>
                {s.kind === 'enquiry' && <option value="quote">Request a quote</option>}
              </Select>
              {s.pricing === 'fixed' && (
                <>
                  <Field
                    label="Price"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={s.amount / 100}
                    onChange={(e) =>
                      patch(i, { amount: Math.round(Number(e.target.value) * 100) })
                    }
                  />
                  <Select
                    label="Currency"
                    value={s.currency}
                    onChange={(e) =>
                      patch(i, { currency: e.target.value as Service['currency'] })
                    }
                  >
                    {['ZAR', 'USD', 'GBP', 'EUR'].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </Select>
                </>
              )}
            </div>
            {s.pricing === 'fixed' && (
              <p className="dt-notice">
                You can showcase prices and receive requests. Paid acceptance is
                unavailable until the payment provider is connected. No payment is
                collected here.
              </p>
            )}
            {s.kind === 'scheduled' && (
              <>
                <div className="dt-row">
                  <Select
                    label="Duration"
                    value={s.duration}
                    onChange={(e) => patch(i, { duration: Number(e.target.value) })}
                  >
                    {Array.from({ length: 16 }, (_, n) => (n + 1) * 15).map((n) => (
                      <option key={n} value={n}>
                        {n} minutes
                      </option>
                    ))}
                  </Select>
                  <Select
                    label="Meeting type"
                    value={s.mode}
                    onChange={(e) =>
                      patch(i, { mode: e.target.value as Service['mode'] })
                    }
                  >
                    <option value="online">Online</option>
                    <option value="in-person">In person</option>
                  </Select>
                </div>
                {s.mode === 'in-person' && (
                  <Field
                    label="Public area or city (not your address)"
                    value={s.location}
                    maxLength={100}
                    onChange={(e) => patch(i, { location: e.target.value })}
                  />
                )}
                <TextArea
                  label="Private meeting details"
                  value={s.privateDetails}
                  maxLength={500}
                  placeholder="Video link or meeting instructions — shown only after acceptance"
                  onChange={(e) => patch(i, { privateDetails: e.target.value })}
                />
              </>
            )}
            {s.kind === 'deliverable' && (
              <div className="dt-row">
                <Field
                  label="Delivery turnaround (days)"
                  type="number"
                  min="1"
                  max="90"
                  value={s.turnaround}
                  onChange={(e) => patch(i, { turnaround: Number(e.target.value) })}
                />
                <Field
                  label="Maximum active deliveries"
                  type="number"
                  min="1"
                  max="100"
                  value={s.capacity}
                  onChange={(e) => patch(i, { capacity: Number(e.target.value) })}
                />
              </div>
            )}
            {s.kind !== 'scheduled' && (
              <TextArea
                label="Next steps after acceptance (private)"
                value={s.privateDetails}
                maxLength={500}
                placeholder="How you will follow up or deliver the finished work"
                onChange={(e) => patch(i, { privateDetails: e.target.value })}
              />
            )}
            <TextArea
              label="Instructions for your client (optional)"
              value={s.instructions}
              maxLength={1000}
              onChange={(e) => patch(i, { instructions: e.target.value })}
            />
            <details>
              <summary>
                Image and questions <small>Optional</small>
              </summary>
              <div className="dt-stack dt-detail-body">
                <ImageUpload
                  label="Service image"
                  value={s.image}
                  onChange={(image) => patch(i, { image })}
                />
                {s.questions.map((q, n) => (
                  <div key={n} className="dt-panel">
                    <Field
                      label={`Question ${n + 1}`}
                      value={q.label}
                      maxLength={120}
                      onChange={(e) =>
                        patch(i, {
                          questions: s.questions.map((v, j) =>
                            j === n ? { ...v, label: e.target.value } : v,
                          ),
                        })
                      }
                    />
                    <Toggle
                      label="Answer required"
                      checked={q.required}
                      onChange={(e) =>
                        patch(i, {
                          questions: s.questions.map((v, j) =>
                            j === n ? { ...v, required: e.target.checked } : v,
                          ),
                        })
                      }
                    />
                    <Button
                      variant="ghost"
                      type="button"
                      className="dt-text-button"
                      onClick={() =>
                        patch(i, { questions: s.questions.filter((_, j) => j !== n) })
                      }
                    >
                      Remove question
                    </Button>
                  </div>
                ))}
                {s.questions.length < 3 && (
                  <Button
                    variant="ghost"
                    type="button"
                    className="dt-button-secondary"
                    onClick={() =>
                      patch(i, {
                        questions: [
                          ...s.questions,
                          { label: 'What would you like to achieve?', required: false },
                        ],
                      })
                    }
                  >
                    ＋ Add a question
                  </Button>
                )}
                <small>
                  Ask only what you need. Don’t request health records, identity
                  documents or home addresses.
                </small>
              </div>
            </details>
            <div className="dt-actions">
              <Toggle
                label="Active on my page"
                checked={s.active}
                onChange={(e) => patch(i, { active: e.target.checked })}
              />
              <Button
                variant="ghost"
                type="button"
                className="dt-text-button"
                disabled={i === 0}
                onClick={() => move(i, -1)}
                aria-label={`Move ${s.title} up`}
              >
                ↑ Up
              </Button>
              <Button
                variant="ghost"
                type="button"
                className="dt-text-button"
                disabled={i === services.length - 1}
                onClick={() => move(i, 1)}
                aria-label={`Move ${s.title} down`}
              >
                ↓ Down
              </Button>
            </div>
            <small>
              Archiving hides the service after you publish changes. Existing requests
              remain in your inbox.
            </small>
          </div>
        </details>
      ))}
    </div>
  );
}
