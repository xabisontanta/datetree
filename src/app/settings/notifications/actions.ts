'use server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { contactSettingsSchema } from '@/services/notifications/contact-settings';
export async function loadContactSettings() {
  const db = await createClient();
  const { data } = await db.rpc('dt_contact_settings');
  const parsed = contactSettingsSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}
export async function saveContactSettings(number: string, optIn: boolean) {
  if (typeof optIn !== 'boolean' || (number && !/^\+[1-9]\d{7,14}$/.test(number)))
    return { error: 'Use international format without spaces.' };
  const db = await createClient();
  const { error } = await db.rpc('dt_set_contact_preferences', {
    number: number || null,
    opt_in: optIn,
  });
  return {
    error: error
      ? error.code === 'P0001'
        ? error.message
        : 'Could not save settings.'
      : '',
  };
}
export async function verifyWhatsApp(
  number: string,
  challenge?: string,
  code?: string,
) {
  if (
    !/^\+[1-9]\d{7,14}$/.test(number) ||
    (challenge &&
      (!z.uuid().safeParse(challenge).success || !/^\d{4,10}$/.test(code ?? '')))
  )
    return { error: 'Check the number and code.' };
  const db = await createClient();
  const { data, error } = await db.functions.invoke('dt-whatsapp-verify', {
    body: { number, ...(challenge ? { challenge, code } : {}) },
  });
  // Never log or persist the OTP. Return only safe, allowlisted outcome fields.
  const parsed = z
    .object({
      error: z.string().max(250).optional(),
      challenge: z.uuid().optional(),
      verified: z.boolean().optional(),
    })
    .safeParse(data);
  if (!parsed.success)
    return {
      error: 'WhatsApp verification is not available yet. Email remains available.',
    };
  return {
    ...parsed.data,
    error: parsed.data.error ?? (error ? 'Verification could not be completed.' : ''),
  };
}
