'use client';
import { useState, useTransition } from 'react';
import {
  loadContactSettings,
  saveContactSettings,
  verifyWhatsApp,
} from '@/app/settings/notifications/actions';
import { Field, Toggle, Notice } from '@/components/editor-fields';
import { Button } from '@/components/ui/button';
import type { ContactSettings } from '@/services/notifications/contact-settings';
export function ContactSettingsView({ initial }: { initial: ContactSettings }) {
  const [settings, setSettings] = useState(initial);
  const [number, setNumber] = useState(initial.whatsappNumber ?? '');
  const [challenge, setChallenge] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, run] = useTransition();
  function execute(task: () => Promise<{ error?: string }>) {
    run(async () => {
      setError('');
      setMessage('');
      try {
        const r = await task();
        setError(r.error ?? '');
        const fresh = await loadContactSettings();
        if (fresh) setSettings(fresh);
      } catch {
        setError('Could not complete that change. Please try again.');
      }
    });
  }
  const saved = number === settings.whatsappNumber;
  return (
    <div className="dt-stack">
      <p>
        Email notifications use your verified email. Contact sharing is a separate
        choice on each request.
      </p>
      <p>Verified email: {settings.email}</p>
      <Field
        label="WhatsApp number (optional)"
        type="tel"
        autoComplete="tel"
        placeholder="+27656193535"
        value={number}
        onChange={(e) => {
          setNumber(e.target.value);
          setChallenge('');
          setCode('');
        }}
      />
      <small>
        Changing your number removes its verification and notification permission.
      </small>
      <Button
        disabled={busy}
        onClick={() =>
          execute(async () => {
            const r = await saveContactSettings(
              number,
              saved && settings.whatsappConsent,
            );
            if (!r.error) setMessage('Number saved.');
            return r;
          })
        }
      >
        Save number
      </Button>
      {!settings.whatsappVerified && saved && number && (
        <Button
          disabled={busy || Boolean(challenge)}
          onClick={() =>
            execute(async () => {
              const r = await verifyWhatsApp(number);
              if ('challenge' in r && r.challenge) {
                setChallenge(r.challenge);
                setMessage('Check WhatsApp for your verification code.');
              }
              return r;
            })
          }
        >
          Send WhatsApp verification code
        </Button>
      )}
      {challenge && !settings.whatsappVerified && (
        <>
          <Field
            label="Verification code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            maxLength={10}
            onChange={(e) => setCode(e.target.value)}
          />
          <Button
            disabled={busy || !code}
            onClick={() =>
              execute(async () => {
                const r = await verifyWhatsApp(number, challenge, code);
                setCode('');
                if ('verified' in r && r.verified) {
                  setChallenge('');
                  setMessage('WhatsApp verified.');
                }
                return r;
              })
            }
          >
            Verify code
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setChallenge('');
              setCode('');
            }}
          >
            Request another code
          </Button>
        </>
      )}
      {settings.whatsappVerified && saved && (
        <Toggle
          label="Send service-request updates to my verified WhatsApp number. I can opt out here or reply STOP."
          checked={settings.whatsappConsent}
          disabled={busy}
          onChange={(e) => execute(() => saveContactSettings(number, e.target.checked))}
        />
      )}
      {message && <Notice>{message}</Notice>}
      {error && <Notice error>{error}</Notice>}
    </div>
  );
}
