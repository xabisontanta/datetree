'use client';
import { Button } from '@/components/ui/button';

import Link from 'next/link';

import { useEffect, useRef, useState, useTransition } from 'react';
import { PublicPageView, serviceSummary } from '@/components/public-page';
import { Field, Notice, Select, TextArea, Toggle } from '@/components/editor-fields';
import { loadContactSettings } from '@/app/settings/notifications/actions';
import type { ContactSettings } from '@/services/notifications/contact-settings';
import { type PublicPage, type PublicService } from '@/features/creators/page-schema';
import { sendRequesterLink, submitRequest } from '@/app/requests/actions';
import { SlotPicker } from './slot-picker';
import { contactProofChanged, whatsappPermissionRevoked } from './contact-selection';
import {
  freshServiceRequestDetails,
  isAmbiguousSubmissionResult,
  retainRequestSubmission,
  type RequestSubmission,
} from './request-submission';

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
  const [contactSharingConsent, setContactSharingConsent] = useState(false);
  const [preferredContact, setPreferredContact] = useState<'email' | 'whatsapp'>(
    'email',
  );
  const [whatsappNotificationConsent, setWhatsAppNotificationConsent] = useState(false);
  const [contactSettings, setContactSettings] = useState<ContactSettings | null>(null);
  const [review, setReview] = useState(false);
  const [receipt, setReceipt] = useState('');
  const [key, setKey] = useState('');
  const [timezone, setTimezone] = useState('');
  const [retryPending, setRetryPending] = useState(false);
  const pendingSubmission = useRef<RequestSubmission | null>(null);
  const previousContacts = useRef<ContactSettings | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (verified)
      void loadContactSettings()
        .then(setContactSettings)
        .catch(() => {});
  }, [verified]);
  useEffect(() => {
    if (contactProofChanged(previousContacts.current, contactSettings)) {
      setContactSharingConsent(false);
      setWhatsAppNotificationConsent(false);
    }
    if (!contactSettings?.whatsappVerified) {
      setPreferredContact('email');
      setWhatsAppNotificationConsent(false);
    } else if (whatsappPermissionRevoked(previousContacts.current, contactSettings)) {
      setWhatsAppNotificationConsent(false);
    }
    previousContacts.current = contactSettings;
  }, [contactSettings]);
  useEffect(() => {
    if (service && !dialog.current?.open) dialog.current?.showModal();
  }, [service]);
  function select(s: PublicService) {
    if (pendingSubmission.current) {
      setService(pendingSubmission.current.serviceSnapshot);
      setReview(true);
      return;
    }
    const details = freshServiceRequestDetails(s);
    setService(s);
    setNotes(details.notes);
    setStart(details.start);
    setDate(details.preferredDate);
    setAnswers(details.answers);
    setError('');
    setSent(false);
    setReview(false);
    setContactSharingConsent(false);
    setWhatsAppNotificationConsent(false);
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
          onCancel={(event) => {
            if (busy) event.preventDefault();
            else setService(null);
          }}
          className="dt-request-overlay"
          aria-label={`Request ${service.title}`}
        >
          <div className="dt-request-panel">
            <Button
              variant="ghost"
              className="dt-text-button"
              type="button"
              disabled={busy}
              onClick={() => setService(null)}
            >
              ← Back to profile
            </Button>
            <p className="eyebrow">{page.profile.displayName}</p>
            <h2>{receipt ? 'Request sent.' : service.title}</h2>
            <p className="dt-muted">{serviceSummary(service)}</p>
            {receipt ? (
              <div className="dt-stack">
                <Notice>
                  Your request for {service.title} has been sent to{' '}
                  {page.profile.displayName}. Awaiting their response. We’ll notify you
                  when they accept or decline.
                </Notice>
                <Link className="dt-button" href={`/requests/${receipt}`}>
                  View request status →
                </Link>
                <small>
                  Reference {receipt.slice(0, 8)}. Check your requests page for updates;
                  notification delivery is tracked separately there.
                </small>
              </div>
            ) : !verified ? (
              <form
                className="dt-stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  startTransition(async () => {
                    setError('');
                    try {
                      const result = await sendRequesterLink(
                        email,
                        page.profile.username,
                        service.id,
                      );
                      setError(result.error);
                      if (!result.error) setSent(true);
                    } catch {
                      setError(
                        'We could not confirm email delivery. Check your inbox before retrying.',
                      );
                    }
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
                <Link
                  className="dt-text-button"
                  href={`/auth/sign-in?next=${encodeURIComponent(`/${page.profile.username}?service=${service.id}`)}`}
                >
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
                  const submission = retainRequestSubmission(
                    pendingSubmission.current,
                    {
                      serviceId: service.id,
                      serviceSnapshot: service,
                      idempotencyKey,
                      name,
                      notes,
                      answers: service.questions.map((_, i) => answers[i] ?? ''),
                      start,
                      preferredDate: date,
                      timezone,
                      adult,
                      consent,
                      preferredContact,
                      contactSharingConsent,
                      whatsappNotificationConsent,
                    },
                  );
                  pendingSubmission.current = submission;
                  setRetryPending(true);
                  startTransition(async () => {
                    setError('');
                    try {
                      const result = await submitRequest(submission);
                      setError(result.error);
                      if (!isAmbiguousSubmissionResult(result)) {
                        pendingSubmission.current = null;
                        setRetryPending(false);
                      }
                      if (result.id) setReceipt(result.id);
                    } catch {
                      setError(
                        'We could not confirm whether your request was saved. Retry the original request safely, or check Your requests.',
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
                      <dd>{service.title}</dd>
                      <dt>Shared contact</dt>
                      <dd>
                        {preferredContact === 'email'
                          ? 'Verified email'
                          : 'Verified WhatsApp'}{' '}
                        · only this contact is shared.
                      </dd>
                      {start && (
                        <>
                          <dt>Requested time</dt>
                          <dd>
                            {new Intl.DateTimeFormat('en', {
                              dateStyle: 'full',
                              timeStyle: 'short',
                              timeZone: timezone,
                            }).format(new Date(start))}
                            <br />
                            {timezone}
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
                      disabled={busy || retryPending}
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
                        onTimezoneChange={setTimezone}
                        initialTimezone={timezone}
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
                      label={`Share my verified ${preferredContact === 'email' ? 'email' : 'WhatsApp number'} with this creator so they can contact me about this request.`}
                      checked={contactSharingConsent}
                      required
                      onChange={(e) => setContactSharingConsent(e.target.checked)}
                    />
                    <Select
                      label="Preferred shared contact"
                      value={preferredContact}
                      onChange={(e) => {
                        setPreferredContact(e.target.value as 'email' | 'whatsapp');
                        setContactSharingConsent(false);
                      }}
                    >
                      <option value="email">Verified email</option>
                      {contactSettings?.whatsappVerified && (
                        <option value="whatsapp">Verified WhatsApp</option>
                      )}
                    </Select>
                    {contactSettings && (
                      <small>
                        {preferredContact === 'email'
                          ? contactSettings.email
                          : contactSettings.whatsappNumber}
                      </small>
                    )}
                    {contactSettings?.whatsappVerified ? (
                      <Toggle
                        label="Also send updates about this request to my verified WhatsApp number. I can reply STOP."
                        checked={whatsappNotificationConsent}
                        onChange={(e) =>
                          setWhatsAppNotificationConsent(e.target.checked)
                        }
                      />
                    ) : (
                      <>
                        <Link href="/settings/notifications" target="_blank">
                          Optional: verify WhatsApp in notification settings
                        </Link>
                        <Button
                          variant="ghost"
                          type="button"
                          onClick={() => {
                            void loadContactSettings()
                              .then(setContactSettings)
                              .catch(() => {});
                          }}
                        >
                          Refresh verified contacts
                        </Button>
                      </>
                    )}
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
                {retryPending && !busy && (
                  <Notice>
                    The original details are kept unchanged until we can confirm the
                    result. Retrying will not create the same request twice. You can
                    also <Link href="/requests">check Your requests</Link> before
                    starting again.
                  </Notice>
                )}
                <p className="dt-muted">
                  Any fees or other arrangements are discussed privately. Date Tree does
                  not process payments.
                </p>
                <Button
                  variant="ghost"
                  className="dt-button"
                  type="submit"
                  disabled={busy || (service.kind === 'scheduled' && !start)}
                >
                  {busy
                    ? 'Sending your request…'
                    : retryPending
                      ? 'Retry original request'
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
