import { z } from 'zod';
export const contactSettingsSchema = z.object({
  email: z.email(),
  whatsappNumber: z.string().nullable(),
  whatsappVerified: z.boolean(),
  whatsappConsent: z.boolean(),
});
export type ContactSettings = z.infer<typeof contactSettingsSchema>;
