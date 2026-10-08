import type { ContactSettings } from '@/services/notifications/contact-settings';

/** Consent applies to the contact proof the requester actually reviewed. */
export function contactProofChanged(
  previous: ContactSettings | null,
  current: ContactSettings | null,
) {
  return (
    previous?.email !== current?.email ||
    previous?.whatsappNumber !== current?.whatsappNumber ||
    previous?.whatsappVerified !== current?.whatsappVerified
  );
}

export function whatsappPermissionRevoked(
  previous: ContactSettings | null,
  current: ContactSettings | null,
) {
  return Boolean(previous?.whatsappConsent && !current?.whatsappConsent);
}
