import { z } from 'zod';

export const RESERVED_USERNAMES = [
  'auth',
  'api',
  'dashboard',
  'requests',
  'preview',
  'admin',
  'settings',
  'signin-with-chatgpt',
  'signout-with-chatgpt',
  'callback',
  'assets',
  'media',
  'www',
  'help',
  'support',
];
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9][a-z0-9_-]{2,29}$/,
    'Use 3–30 letters, numbers, underscores or hyphens.',
  )
  .refine(
    (v) => !RESERVED_USERNAMES.includes(v),
    'That name is reserved. Try adding your name or profession.',
  );
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const imagePath = z
  .string()
  .regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.png$/)
  .or(z.literal(''));
const safeSocialDestination = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(value)) return true;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password;
    } catch {
      return false;
    }
  }, 'Use a safe https:// link or email address.');
const socialLinkSchema = z.object({
  label: z.string().trim().min(1).max(60),
  url: safeSocialDestination,
  icon: imagePath.optional(),
});
export const publicServiceSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(2).max(80),
  description: z.string().trim().max(1000),
  kind: z.enum(['scheduled', 'deliverable', 'enquiry']),
  active: z.boolean(),
  image: imagePath,
  pricing: z.enum(['free', 'fixed', 'quote']),
  amount: z.number().int().min(0).max(100000000),
  currency: z.enum(['ZAR', 'USD', 'GBP', 'EUR']),
  duration: z.number().int().min(15).max(240).multipleOf(15),
  mode: z.enum(['online', 'in-person']),
  location: z.string().trim().max(100),
  turnaround: z.number().int().min(1).max(90),
  capacity: z.number().int().min(1).max(100),
  instructions: z.string().trim().max(1000),
  questions: z
    .array(
      z.object({ label: z.string().trim().min(1).max(120), required: z.boolean() }),
    )
    .max(3),
});
export const serviceSchema = publicServiceSchema
  .extend({ privateDetails: z.string().trim().max(500) })
  .refine((s) => s.pricing !== 'fixed' || s.amount > 0, {
    path: ['amount'],
    message: 'Enter a price above zero.',
  })
  .refine((s) => s.pricing !== 'quote' || s.kind === 'enquiry', {
    path: ['pricing'],
    message: 'Use an enquiry service for quotations.',
  });
export const profileSchema = z.object({
  themeVersion: z.literal(1),
  username: usernameSchema,
  displayName: z.string().trim().min(1).max(80),
  bio: z.string().trim().max(500),
  tagline: z.string().trim().max(100),
  avatar: imagePath,
  cover: imagePath,
  backgroundImage: imagePath,
  avatarPosition: z.number().min(0).max(100),
  coverPosition: z.number().min(0).max(100),
  backgroundPosition: z.number().min(0).max(100),
  theme: z.enum(['dark', 'minimal', 'luxury', 'vibrant', 'soft']),
  accent: color,
  background: color,
  backgroundType: z.enum(['solid', 'gradient', 'image']),
  gradient: z.enum(['night', 'ocean', 'sunset']),
  font: z.enum(['sans', 'serif', 'mono']),
  buttons: z.enum(['pill', 'rounded', 'square']),
  cards: z.enum(['solid', 'glass', 'outline']),
  scheme: z.enum(['light', 'dark']),
  links: z.array(socialLinkSchema).max(12),
});
const windowSchema = z
  .object({
    day: z.number().int().min(0).max(6),
    start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  })
  .refine((v) => v.start !== v.end, 'Opening and closing times must differ.');
export const availabilitySchema = z.object({
  timezone: z
    .string()
    .max(80)
    .refine((v) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }, 'Choose a valid timezone.'),
  windows: z.array(windowSchema).max(28),
  exceptions: z
    .array(
      z.object({
        date: z.iso.date(),
        windows: z.array(windowSchema).max(4),
      }),
    )
    .max(90),
  notice: z.number().int().min(0).max(168),
  horizon: z.number().int().min(1).max(90),
  buffer: z.number().int().min(0).max(120),
});
export const pageDocumentSchema = z
  .object({
    profile: profileSchema,
    services: z.array(serviceSchema).max(20),
    availability: availabilitySchema,
    step: z.number().int().min(0).max(3),
  })
  .refine(
    (d) => new Set(d.services.map((s) => s.id)).size === d.services.length,
    'Services must have unique identifiers.',
  );
export const publicPageSchema = z.object({
  profile: profileSchema,
  services: z.array(publicServiceSchema).max(20),
});
export type PageDocument = z.infer<typeof pageDocumentSchema>;
export type Service = z.infer<typeof serviceSchema>;
export type PublicService = z.infer<typeof publicServiceSchema>;
export type PageProfile = z.infer<typeof profileSchema>;
export type PublicPage = z.infer<typeof publicPageSchema>;
export type Availability = z.infer<typeof availabilitySchema>;
export function emptyPage(): PageDocument {
  return {
    profile: {
      themeVersion: 1,
      username: '',
      displayName: '',
      bio: '',
      tagline: '',
      avatar: '',
      cover: '',
      backgroundImage: '',
      avatarPosition: 50,
      coverPosition: 50,
      backgroundPosition: 50,
      theme: 'dark',
      accent: '#ff6058',
      background: '#111020',
      backgroundType: 'solid',
      gradient: 'night',
      font: 'sans',
      buttons: 'pill',
      cards: 'solid',
      scheme: 'dark',
      links: [],
    },
    services: [],
    availability: {
      timezone: 'Africa/Johannesburg',
      windows: [],
      exceptions: [],
      notice: 24,
      horizon: 30,
      buffer: 15,
    },
    step: 0,
  };
}
export function newService(
  kind: Service['kind'] = 'scheduled',
  title = 'Coaching consultation',
): Service {
  return {
    id: crypto.randomUUID(),
    kind,
    title,
    description: '',
    image: '',
    active: true,
    pricing: kind === 'enquiry' ? 'quote' : 'free',
    amount: 0,
    currency: 'ZAR',
    duration: 30,
    mode: 'online',
    location: '',
    privateDetails: '',
    turnaround: 7,
    capacity: 5,
    instructions: '',
    questions: [],
  };
}
export function priceLabel(service: PublicService) {
  return service.pricing === 'free'
    ? 'Free'
    : service.pricing === 'quote'
      ? 'Request a quote'
      : new Intl.NumberFormat('en', {
          style: 'currency',
          currency: service.currency,
        }).format(service.amount / 100);
}
export function toPublicPage(d: PageDocument): PublicPage {
  return {
    profile: d.profile,
    services: d.services
      .filter((s) => s.active)
      .map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        kind: s.kind,
        active: s.active,
        image: s.image,
        pricing: s.pricing,
        amount: s.amount,
        currency: s.currency,
        duration: s.duration,
        mode: s.mode,
        location: s.location,
        turnaround: s.turnaround,
        capacity: s.capacity,
        instructions: s.instructions,
        questions: s.questions,
      })),
  };
}
export function publicationIssues(d: PageDocument): string[] {
  const issues: string[] = [];
  if (!d.services.some((s) => s.active))
    issues.push('Add at least one active service.');
  if (
    d.services.some((s) => s.active && s.kind === 'scheduled') &&
    !d.availability.windows.length &&
    !d.availability.exceptions.some((e) => e.windows.length)
  )
    issues.push('Set availability for your appointments.');
  return issues;
}
