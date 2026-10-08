'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { sendInboxSignInLink } from '@/app/requests/actions';
import { Field, Notice } from '@/components/editor-fields';
import { Button } from '@/components/ui/button';
export function InboxSignIn({ next }: { next: string }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, run] = useTransition();
  return (
    <form
      className="dt-stack"
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          try {
            const result = await sendInboxSignInLink(email, next);
            setError(result.error);
            setSent(!result.error);
          } catch {
            setError('Could not confirm delivery. Check your email before retrying.');
          }
        });
      }}
    >
      <Field
        label="Email used for your request"
        type="email"
        required
        value={email}
        autoComplete="email"
        onChange={(e) => setEmail(e.target.value)}
      />
      <Button type="submit" disabled={busy || sent}>
        {sent ? 'Check your email' : 'Send secure sign-in link'}
      </Button>
      {sent && (
        <Notice>
          Open your email link in this browser to return to your private request.
        </Notice>
      )}
      {error && <Notice error>{error}</Notice>}
      <Link href={`/auth/sign-in?next=${encodeURIComponent(next)}`}>
        Use a password instead
      </Link>
    </form>
  );
}
