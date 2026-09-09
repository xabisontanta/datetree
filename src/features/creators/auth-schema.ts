import { z } from 'zod';

const email = z.email('Enter a valid email address.');
const password = z
  .string()
  .min(10, 'Use at least 10 characters.')
  .regex(/[A-Za-z]/, 'Include at least one letter.')
  .regex(/[0-9]/, 'Include at least one number.');

export const signInSchema = z.object({ email, password });

export const signUpSchema = z.object({
  email,
  password,
  whatsappNumber: z
    .string()
    .regex(
      /^\+[1-9][0-9]{7,14}$/,
      'Use international format, for example +27821234567.',
    ),
  isAdult: z.literal('on', { error: 'Confirm that you are 18 or older.' }),
  acceptsTerms: z.literal('on', { error: 'Accept the Terms to continue.' }),
  acceptsPrivacy: z.literal('on', { error: 'Accept the Privacy Policy to continue.' }),
  whatsappConsent: z.literal('on', {
    error: 'Consent to WhatsApp booking notifications is required.',
  }),
});
