'use client';
import { Button } from '@/components/ui/button';

import Link from 'next/link';

import { useEffect, useRef, useState, useTransition } from 'react';
import { PublicPageView, serviceSummary } from '@/components/public-page';
import { Field, Notice, TextArea, Toggle } from '@/components/editor-fields';
import {
  priceLabel,
  type PublicPage,
  type PublicService,
} from '@/features/creators/page-schema';
import { sendRequesterLink, submitRequest } from '@/app/requests/actions';
import { SlotPicker } from './slot-picker';

export function ServiceRequest({
  page,
  verified,
  initialService,
}: {
  page: PublicPage;
  verified: boolean;
  initialService?: string;
}) {
  const [service, setService] = useState<PublicService | null>(
    page.services.find((s) => s.id === initialService) ?? null,
  );
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [answers, setAnswers] = useState<string[]>([]);
  const [start, setStart] = useState('');
  const [date, setDate] = useState('');
  const [adult, setAdult] = useState(false);
  const [consent, setConsent] = useState(false);
  const [review, setReview] = useState(false);
  const [receipt, setReceipt] = useState('');
  const [key, setKey] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (service && !dialog.current?.open) dialog.current?.showModal();
  }, [service]);
  function select(s: PublicService) {
    setService(s);
    setStart('');
    setDate('');
    setAnswers(s.questions.map(() => ''));
    setError('');
    setReview(false);
    setKey(crypto.randomUUID());
    setReceipt('');
  }
  return (
    <>
      <PublicPageView page={page} onSelect={select}>
        <Link className="dt-powered" href="/requests">
          View your requests
        </Link>
      </PublicPageView>
      {service && (
        <dialog
          ref={dialog}
          onCancel={() => setService(null)}
          className="dt-request-overlay"
          aria-label={`Request ${service.title}`}
        >
          <div className="dt-request-panel">
            <Button
              variant="ghost"
              className="dt-text-button"
              type="button"
              onClick={() => setService(null)}
            >
              ← Back to profile
            </Button>
            <p className="eyebrow">{page.profile.displayName}</p>
            <h2>{receipt ? 'Request sent.' : service.title}</h2>
            <p className="dt-muted">
              {serviceSummary(service)} · {priceLabel(service)}
            </p>
            {receipt ? (
              <div className="dt-stack">
                <Notice>
                  Your request is saved. The creator must accept before anything is
                  confirmed. No payment has been taken.
                </Notice>
                <Link className="dt-button" href="/requests">
                  View request status →
                </Link>
                <small>
                  Reference {receipt.slice(0, 8)}. Check your requests page for updates;
                  status notifications are not connected yet.
                </small>
              </div>
            ) : !verified ? (
              <form
                className="dt-stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  startTransition(async () => {
                    const result = await sendRequesterLink(
                      email,
                      page.profile.username,
                      service.id,
                    );
                    setError(result.error);
                    if (!result.error) setSent(true);
                  });
                }}
              >
                <p>
                  No creator account or password needed. Verify your email to send a
                  request and check its status privately.
                </p>
                <Field
                  label="Email address"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Button
                  variant="ghost"
                  type="submit"
                  className="dt-button"
                  disabled={busy || sent}
                >
                  {busy
                    ? 'Sending…'
                    : sent
                      ? 'Check your email'
                      : 'Send me a verification link'}
                </Button>
                {sent && (
                  <Notice>
                    Open the link in your email to return to this service. You’ll enter
                    your request details next. Use this browser to complete
                    verification.
                  </Notice>
                )}
                <Link className="dt-text-button" href="/auth/sign-in">
                  Already have an account? Sign in
                </Link>
              </form>
            ) : (
              <form
                className="dt-stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!review) {
                    setReview(true);
                    return;
                  }
                  const idempotencyKey = key || crypto.randomUUID();
                  setKey(idempotencyKey);
                  startTransition(async () => {
                    setError('');
                    try {
                      const result = await submitRequest({
                        serviceId: service.id,
                        serviceSnapshot: service,
                        idempotencyKey,
                        name,
                        notes,
                        answers: service.questions.map((_, i) => answers[i] ?? ''),
                        start,
                        preferredDate: date,
                        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                        adult,
                        consent,
                      });
                      setError(result.error);
                      if (result.id) setReceipt(result.id);
                    } catch {
                      setError(
                        'The request could not reach Date Tree. Your details are still here—please try again.',
                      );
                    }
                  });
                }}
              >
                {review ? (
                  <>
                    <h3>Review your request</h3>
                    <dl className="dt-review">
                      <dt>Your name</dt>
                      <dd>{name}</dd>
                      <dt>Service</dt>
                      <dd>
                        {service.title} · {priceLabel(service)}
                      </dd>
                      {start && (
                        <>
                          <dt>Requested time</dt>
                          <dd>
                            {new Intl.DateTimeFormat('en', {
                              dateStyle: 'full',
                              timeStyle: 'short',
                            }).format(new Date(start))}
                            <br />
                            {Intl.DateTimeFormat().resolvedOptions().timeZone}
                          </dd>
                        </>
                      )}
                      {date && (
                        <>
                          <dt>Preferred date</dt>
                          <dd>{date} (not guaranteed)</dd>
                        </>
                      )}
                      {notes && (
                        <>
                          <dt>Your note</dt>
                          <dd className="dt-pre-wrap">{notes}</dd>
                        </>
                      )}
                      {service.questions.map((q, i) => (
                        <div key={i}>
                          <dt>{q.label}</dt>
                          <dd>{answers[i] || 'No answer'}</dd>
                        </div>
                      ))}
                    </dl>
                    <Button
                      variant="ghost"
                      type="button"
                      className="dt-text-button"
                      disabled={busy}
                      onClick={() => setReview(false)}
                    >
                      Edit details
                    </Button>
                    <Notice>
                      {service.kind === 'scheduled'
                        ? 'This is a request, not a confirmed appointment. The creator will review it.'
                        : service.kind === 'deliverable'
                          ? 'Turnaround starts after the creator accepts. Your preferred date is not guaranteed.'
                          : 'The creator will review your brief. This does not create an appointment or agree a price.'}
                    </Notice>
                  </>
                ) : (
                  <>
                    {service.kind === 'scheduled' ? (
                      <SlotPicker
                        serviceId={service.id}
                        selected={start}
                        onChange={setStart}
                      />
                    ) : (
                      <Field
                        label={
                          service.kind === 'deliverable'
                            ? 'Preferred delivery date (optional)'
                            : 'Preferred project date (optional)'
                        }
                        type="date"
                        value={date}
                        min={new Date().toLocaleDateString('en-CA')}
                        onChange={(e) => setDate(e.target.value)}
                      />
                    )}
                    {service.instructions && (
                      <p className="dt-notice dt-pre-wrap">{service.instructions}</p>
                    )}
                    <Field
                      label="Your name"
                      required
                      value={name}
                      autoComplete="name"
                      maxLength={80}
                      onChange={(e) => setName(e.target.value)}
                    />
                    <TextArea
                      label={
                        service.kind === 'enquiry'
                          ? 'Your project brief'
                          : 'Notes or requests (optional)'
                      }
                      value={notes}
                      maxLength={2000}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                    {service.questions.map((q, i) => (
                      <TextArea
                        key={i}
                        label={q.label + (q.required ? ' *' : ' (optional)')}
                        required={q.required}
                        maxLength={1000}
                        value={answers[i] ?? ''}
                        onChange={(e) =>
                          setAnswers(
                            service.questions.map((_, n) =>
                              n === i ? e.target.value : (answers[n] ?? ''),
                            ),
                          )
                        }
                      />
                    ))}
                    <small>
                      Share only what’s needed. Don’t include medical records, identity
                      documents or payment details.
                    </small>
                    <Toggle
                      label="I confirm that I am 18 or older."
                      checked={adult}
                      required
                      onChange={(e) => setAdult(e.target.checked)}
                    />
                    <Toggle
                      label="I agree to share these request details with this creator so they can respond."
                      checked={consent}
                      required
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                  </>
                )}
                {service.pricing === 'fixed' && (
                  <p className="dt-notice">
                    Date Tree will not charge you. The creator may arrange payment with
                    you directly until online payments are connected.
                  </p>
                )}
                <Button
                  variant="ghost"
                  className="dt-button"
                  type="submit"
                  disabled={busy || (service.kind === 'scheduled' && !start)}
                >
                  {busy
                    ? 'Sending your request…'
                    : review
                      ? 'Send request'
                      : 'Review request →'}
                </Button>
              </form>
            )}
            {error && <Notice error>{error}</Notice>}
          </div>
        </dialog>
      )}
    </>
  );
}
