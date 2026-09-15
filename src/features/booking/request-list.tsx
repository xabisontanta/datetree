'use client';
import { Button } from '@/components/ui/button';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { transitionRequest } from '@/app/requests/actions';
import { Notice, Select } from '@/components/editor-fields';
import { priceLabel } from '@/features/creators/page-schema';
import { requestStatusLabel, type RequestDTO } from './request-dto';
import { SlotPicker } from '@/features/requester/slot-picker';

export function RequestList({
  requests,
  creator,
  details = {},
  contacts = {},
}: {
  requests: RequestDTO[];
  creator: boolean;
  details?: Record<string, string>;
  contacts?: Record<string, string>;
}) {
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [busy, startTransition] = useTransition();
  const [counter, setCounter] = useState('');
  const [start, setStart] = useState('');
  const router = useRouter();
  function act(r: RequestDTO, operation: string, time?: string) {
    startTransition(async () => {
      const result = await transitionRequest({
        id: r.id,
        version: r.version,
        operation,
        ...(time ? { start: time } : {}),
      });
      setError(result.error);
      if (!result.error) {
        setCounter('');
        router.refresh();
      }
    });
  }
  return (
    <div className="dt-stack">
      <div className="dt-notice">
        Requests are saved here. Email and WhatsApp status notifications are not
        connected yet; check this inbox for updates.
      </div>
      {error && <Notice error>{error}</Notice>}
      <Select
        label="Show requests"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      >
        <option value="all">All requests</option>
        <option value="pending">Needs a response</option>
        <option value="active">Accepted</option>
        <option value="closed">Closed</option>
      </Select>
      {!requests.length && (
        <div className="dt-empty">
          <h2>
            {creator ? 'Your next opportunity starts with a link.' : 'No requests yet.'}
          </h2>
          <p>
            {creator
              ? 'Publish your page, share your link, and client requests will appear here.'
              : 'Visit a creator’s page to request a service.'}
          </p>
        </div>
      )}
      {requests
        .filter(
          (r) =>
            filter === 'all' ||
            (filter === 'pending'
              ? ['PENDING_CREATOR', 'COUNTER_PROPOSED'].includes(r.status)
              : filter === 'active'
                ? r.status === 'CONFIRMED'
                : ['DECLINED', 'CANCELLED', 'COMPLETED', 'EXPIRED'].includes(r.status)),
        )
        .map((r) => (
          <article key={r.id} className="dt-panel dt-stack">
            <div className="dt-between">
              <h2>{r.snapshot.title}</h2>
              <span className="dt-status">{requestStatusLabel(r)}</span>
            </div>
            <p className="dt-muted">
              {creator
                ? `Requested by ${r.requester_name}`
                : `Requested as ${r.requester_name}`}{' '}
              · {priceLabel(r.snapshot)}
            </p>
            {r.start_at && (
              <p>
                <strong>
                  {new Intl.DateTimeFormat('en', {
                    dateStyle: 'full',
                    timeStyle: 'short',
                    timeZone: r.visitor_timezone,
                  }).format(new Date(r.start_at))}
                </strong>
                <br />
                <small>
                  {r.visitor_timezone} · {r.snapshot.duration} minutes
                </small>
              </p>
            )}
            {creator && contacts[r.id] && (
              <p>
                Client email:{' '}
                <a className="dt-text-button" href={`mailto:${contacts[r.id]}`}>
                  {contacts[r.id]}
                </a>
              </p>
            )}
            {r.delivery_due_at && (
              <p>
                <strong>
                  Delivery due:{' '}
                  {new Intl.DateTimeFormat('en', {
                    dateStyle: 'full',
                    timeZone: r.visitor_timezone,
                  }).format(new Date(r.delivery_due_at))}
                </strong>
              </p>
            )}
            {r.snapshot.kind === 'deliverable' && (
              <p>
                Turnaround: {r.snapshot.turnaround} days after acceptance.
                {r.preferred_date &&
                  ` Preferred delivery: ${r.preferred_date} (not guaranteed).`}
              </p>
            )}
            {r.snapshot.kind === 'enquiry' && (
              <p>
                An enquiry is not an appointment or paid booking.
                {r.preferred_date && ` Preferred date: ${r.preferred_date}.`}
              </p>
            )}
            {r.notes && <p className="dt-pre-wrap">{r.notes}</p>}
            {r.snapshot.questions.map((q, i) => (
              <div key={i}>
                <strong>{q.label}</strong>
                <p className="dt-pre-wrap">{r.answers[i] || 'No answer provided'}</p>
              </div>
            ))}
            {details[r.id] && (
              <div className="dt-notice">
                <strong>Private meeting details</strong>
                <p className="dt-pre-wrap">{details[r.id]}</p>
              </div>
            )}
            {r.snapshot.pricing === 'fixed' && (
              <small>
                Date Tree has not collected this payment. Arrange payment directly with
                the client until online payments are connected.
              </small>
            )}
            <div className="dt-actions">
              {creator && r.status === 'PENDING_CREATOR' && (
                <Button
                  variant="ghost"
                  type="button"
                  className="dt-button"
                  disabled={busy}
                  onClick={() => act(r, 'accept')}
                >
                  Accept request
                </Button>
              )}
              {creator &&
                ['PENDING_CREATOR', 'COUNTER_PROPOSED'].includes(r.status) && (
                  <>
                    <Button
                      variant="ghost"
                      type="button"
                      className="dt-button-secondary"
                      disabled={busy}
                      onClick={() => act(r, 'decline')}
                    >
                      Decline
                    </Button>
                    {r.snapshot.kind === 'scheduled' && (
                      <Button
                        variant="ghost"
                        type="button"
                        className="dt-button-secondary"
                        disabled={busy}
                        onClick={() => {
                          setCounter(r.id);
                          setStart('');
                        }}
                      >
                        Propose another time
                      </Button>
                    )}
                  </>
                )}
              {!creator && r.status === 'COUNTER_PROPOSED' && (
                <Button
                  variant="ghost"
                  type="button"
                  className="dt-button"
                  disabled={busy}
                  onClick={() => act(r, 'accept_counter')}
                >
                  Accept proposed time
                </Button>
              )}
              {['PENDING_CREATOR', 'COUNTER_PROPOSED', 'CONFIRMED'].includes(
                r.status,
              ) && (
                <Button
                  variant="ghost"
                  type="button"
                  className="dt-text-button"
                  disabled={busy}
                  onClick={() => act(r, 'cancel')}
                >
                  Cancel request
                </Button>
              )}
              {creator &&
                r.status === 'CONFIRMED' &&
                (!r.end_at || new Date(r.end_at) <= new Date()) && (
                  <Button
                    variant="ghost"
                    type="button"
                    className="dt-button-secondary"
                    disabled={busy}
                    onClick={() => act(r, 'complete')}
                  >
                    Mark completed
                  </Button>
                )}
            </div>
            {counter === r.id && (
              <div className="dt-stack">
                <SlotPicker
                  serviceId={r.snapshot.id}
                  selected={start}
                  onChange={setStart}
                />
                <Button
                  variant="ghost"
                  type="button"
                  className="dt-button"
                  disabled={busy || !start}
                  onClick={() => act(r, 'counter', start)}
                >
                  Send time proposal
                </Button>
                <small>
                  This proposes a time; it does not reserve it until the requester
                  accepts.
                </small>
              </div>
            )}
            <small>
              Reference {r.id.slice(0, 8)} · submitted{' '}
              {new Date(r.created_at).toLocaleDateString('en-ZA')}
            </small>
          </article>
        ))}
    </div>
  );
}
