'use client';
import { Button } from '@/components/ui/button';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { savePage, publishPage, pauseRequests } from '@/app/dashboard/actions';
import { Notice } from '@/components/editor-fields';
import { PublicPageView } from '@/components/public-page';
import { ProfileEditor, AppearanceEditor } from './profile-editor';
import { ServiceEditor } from './service-editor';
import { AvailabilityEditor } from './availability-editor';
import { toPublicPage, type PageDocument } from './page-schema';

const steps = ['Profile', 'Services', 'Availability', 'Appearance'];
export function PageBuilder({
  initial,
  initialRevision,
  published,
  locked,
  paused,
  origin,
}: {
  initial: PageDocument;
  initialRevision: number;
  published: boolean;
  locked: boolean;
  paused: boolean;
  origin: string;
}) {
  const [document, setDocument] = useState(initial);
  const [revision, setRevision] = useState(initialRevision);
  const [step, setStep] = useState(initial.step);
  const [dirty, setDirty] = useState(false);
  const [busy, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const router = useRouter();
  const link = `${origin}/${document.profile.username}`;
  useEffect(() => {
    if (initialRevision === 0)
      setDocument((current) => ({
        ...current,
        availability: {
          ...current.availability,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      }));
  }, [initialRevision]);
  useEffect(() => {
    if (!dirty) return;
    function warn(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function change(next: PageDocument) {
    setDocument(next);
    setDirty(true);
    setMessage('');
  }
  async function save(nextStep = step) {
    const next = { ...document, step: nextStep };
    const result = await savePage(next, revision);
    if (result.error) {
      setError(result.error);
      return null;
    }
    setRevision(result.revision);
    setDocument(next);
    setDirty(false);
    setError('');
    setMessage('Saved to your account.');
    setStep(nextStep);
    return result.revision;
  }
  return (
    <section className="dt-builder">
      <div className="dt-workspace-heading">
        <div>
          <p className="eyebrow">
            {published
              ? 'Your creator studio'
              : 'A little setup. A lot of possibilities.'}
          </p>
          <h1>{published ? 'Make it yours.' : 'Your page starts here.'}</h1>
          <p className="dt-muted">
            {published
              ? 'Saved drafts stay private until you publish changes.'
              : 'Four simple steps to your own service link.'}
          </p>
        </div>
        <span className={`dt-status ${published ? 'dt-live' : ''}`}>
          {published ? '● Published' : '○ Draft'}
        </span>
      </div>
      <nav className="dt-tabs" aria-label="Profile setup steps">
        {steps.map((name, i) => (
          <Button
            variant="ghost"
            key={name}
            type="button"
            aria-current={i === step ? 'step' : undefined}
            onClick={() => setStep(i)}
          >
            <span>{i + 1}</span>
            {name}
          </Button>
        ))}
      </nav>
      <div className="dt-builder-grid">
        <div className="dt-editor">
          <div className="dt-editor-heading">
            <div>
              <small>STEP {step + 1} OF 4</small>
              <h2>{steps[step]}</h2>
            </div>
            <Button
              variant="ghost"
              type="button"
              className="dt-text-button dt-mobile-preview"
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? 'Hide preview' : 'Preview'}
            </Button>
          </div>
          <fieldset disabled={busy} className="dt-fieldset">
            {step === 0 && (
              <ProfileEditor
                profile={document.profile}
                locked={locked}
                onChange={(profile) => change({ ...document, profile })}
              />
            )}
            {step === 1 && (
              <ServiceEditor
                services={document.services}
                onChange={(services) => change({ ...document, services })}
              />
            )}
            {step === 2 && (
              <AvailabilityEditor
                value={document.availability}
                scheduled={document.services.some(
                  (s) => s.active && s.kind === 'scheduled',
                )}
                onChange={(availability) => change({ ...document, availability })}
              />
            )}
            {step === 3 && (
              <AppearanceEditor
                profile={document.profile}
                onChange={(profile) => change({ ...document, profile })}
              />
            )}
          </fieldset>
          {error && <Notice error>{error}</Notice>}
          {message && <Notice>{message}</Notice>}
          <div className="dt-editor-footer">
            <output className="dt-muted">
              {busy
                ? 'Saving…'
                : dirty
                  ? 'Unsaved changes'
                  : revision
                    ? 'Saved to your account'
                    : 'Save to reserve your username'}
            </output>
            <div className="dt-actions">
              <Button
                variant="ghost"
                type="button"
                className="dt-button-secondary"
                disabled={busy}
                onClick={() =>
                  startTransition(async () => {
                    await save();
                  })
                }
              >
                Save draft
              </Button>
              {step < 3 ? (
                <Button
                  variant="ghost"
                  type="button"
                  className="dt-button"
                  disabled={busy}
                  onClick={() =>
                    startTransition(async () => {
                      await save(step + 1);
                    })
                  }
                >
                  Save & continue →
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  type="button"
                  className="dt-button"
                  disabled={busy}
                  onClick={() =>
                    startTransition(async () => {
                      const rev = await save();
                      if (rev === null) return;
                      const result = await publishPage(true, rev);
                      if (result.error) setError(result.error);
                      else {
                        setMessage(
                          'Your page is published. Copy your link below and share it.',
                        );
                        router.refresh();
                      }
                    })
                  }
                >
                  {published ? 'Publish changes' : 'Publish my page'}
                </Button>
              )}
            </div>
          </div>
          {published && (
            <div className="dt-panel dt-stack">
              <h3>Your shareable link</h3>
              <a
                className="dt-share-url"
                href={`/${document.profile.username}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {link}
              </a>
              <div className="dt-actions">
                <Button
                  variant="ghost"
                  type="button"
                  className="dt-button-secondary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(link);
                      setMessage('Link copied.');
                    } catch {
                      setError(
                        'Copy the link shown above. Your browser did not allow clipboard access.',
                      );
                    }
                  }}
                >
                  Copy link
                </Button>
                <Button
                  variant="ghost"
                  type="button"
                  className="dt-button-secondary"
                  onClick={async () => {
                    try {
                      if (navigator.share)
                        await navigator.share({
                          title: document.profile.displayName,
                          url: link,
                        });
                      else {
                        await navigator.clipboard.writeText(link);
                        setMessage('Link copied — paste it into your favourite app.');
                      }
                    } catch {
                      /* Cancelling the native share sheet needs no error. */
                    }
                  }}
                >
                  Share
                </Button>
              </div>
              <details>
                <summary>Publication settings</summary>
                <div className="dt-actions dt-detail-body">
                  <Button
                    variant="ghost"
                    type="button"
                    className="dt-button-secondary"
                    disabled={busy}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await pauseRequests(!paused);
                        setError(result.error);
                        if (!result.error) router.refresh();
                      })
                    }
                  >
                    {paused ? 'Resume requests' : 'Pause new requests'}
                  </Button>
                  <Button
                    variant="ghost"
                    type="button"
                    className="dt-text-button"
                    disabled={busy}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await publishPage(false, revision);
                        setError(result.error);
                        if (!result.error) {
                          setMessage(
                            'Page unpublished. Your draft and requests are safe.',
                          );
                          router.refresh();
                        }
                      })
                    }
                  >
                    Unpublish page
                  </Button>
                </div>
                <small>
                  Unpublishing hides the page and its images. Existing requests stay in
                  your inbox.
                </small>
              </details>
            </div>
          )}
        </div>
        <aside
          className={`dt-preview-column ${showPreview ? 'dt-preview-open' : ''}`}
          aria-label="Live profile preview"
        >
          <div className="dt-preview-caption">
            <span>LIVE PREVIEW</span>
            <small>Only published changes are public</small>
          </div>
          <PublicPageView page={toPublicPage(document)} preview />
        </aside>
      </div>
    </section>
  );
}
