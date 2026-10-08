import { describe, expect, it } from 'vitest';
import { contactProofChanged, whatsappPermissionRevoked } from './contact-selection';
import type { ContactSettings } from '@/services/notifications/contact-settings';

const verified: ContactSettings = {
  email: 'fan@example.test',
  whatsappNumber: '+27656193535',
  whatsappVerified: true,
  whatsappConsent: true,
};

describe('refreshing a requester contact proof', () => {
  it('does not discard current consent when the same verified contact is refreshed', () => {
    expect(contactProofChanged(verified, { ...verified })).toBe(false);
    expect(whatsappPermissionRevoked(verified, { ...verified })).toBe(false);
  });

  it.each([
    { ...verified, email: 'changed@example.test' },
    { ...verified, whatsappNumber: '+27656193536', whatsappVerified: false },
    { ...verified, whatsappVerified: false },
    null,
  ])(
    'requires fresh sharing and notification consent after the proof changes: %j',
    (next) => {
      expect(contactProofChanged(verified, next)).toBe(true);
    },
  );

  it('requires reviewing the contact after the initial proof arrives', () => {
    expect(contactProofChanged(null, verified)).toBe(true);
    expect(contactProofChanged(null, null)).toBe(false);
  });

  it('keeps contact proof separate from revoking WhatsApp notifications', () => {
    const optedOut = { ...verified, whatsappConsent: false };
    expect(contactProofChanged(verified, optedOut)).toBe(false);
    expect(whatsappPermissionRevoked(verified, optedOut)).toBe(true);
  });
});
