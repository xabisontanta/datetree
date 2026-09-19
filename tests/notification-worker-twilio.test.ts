import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const workerSource = readFileSync(
  path.resolve('supabase/functions/dt-notification-worker/index.ts'),
  'utf8',
);

describe('notification worker Twilio boundary', () => {
  it('sends WhatsApp through Twilio and keeps secrets server-side', () => {
    expect(workerSource).toContain('api.twilio.com/2010-04-01/Accounts/');
    expect(workerSource).toContain('TWILIO_ACCOUNT_SID');
    expect(workerSource).toContain('TWILIO_AUTH_TOKEN');
    expect(workerSource).toContain('TWILIO_WHATSAPP_FROM');
    expect(workerSource).not.toContain('api.sent.dm');
    expect(workerSource).not.toContain('SENT_DM_API_KEY');
    expect(workerSource).not.toMatch(/console\.(log|info|debug|error)/);
  });

  it('does not treat email provider absence as a WhatsApp blocker', () => {
    expect(workerSource).toContain('channels = [');
    expect(workerSource).toContain("['email']");
    expect(workerSource).toContain("['whatsapp']");
  });
});
