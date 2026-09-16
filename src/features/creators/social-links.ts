export const SOCIAL_PLATFORMS = [
  'facebook',
  'instagram',
  'tiktok',
  'x',
  'linkedin',
  'youtube',
  'onlyfans',
  'whatsapp',
  'gmail',
  'email',
  'github',
  'custom',
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

const platformNames: Record<SocialPlatform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  x: 'X',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  onlyfans: 'OnlyFans',
  whatsapp: 'WhatsApp',
  gmail: 'Gmail',
  email: 'Email',
  github: 'GitHub',
  custom: 'Custom link',
};

const hostPlatforms: Array<[RegExp, SocialPlatform]> = [
  [/(^|\.)facebook\.com$|(^|\.)fb\.com$/, 'facebook'],
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)x\.com$|(^|\.)twitter\.com$/, 'x'],
  [/(^|\.)linkedin\.com$/, 'linkedin'],
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/, 'youtube'],
  [/(^|\.)onlyfans\.com$/, 'onlyfans'],
  [/(^|\.)whatsapp\.com$|^wa\.me$/, 'whatsapp'],
  [/(^|\.)mail\.google\.com$/, 'gmail'],
  [/(^|\.)github\.com$/, 'github'],
];

export function platformLabel(platform: SocialPlatform) {
  return platformNames[platform];
}

export function detectSocialPlatform(destination: string): SocialPlatform {
  const value = destination.trim();
  if (/^mailto:/i.test(value)) {
    const address = value.slice(7).split('?')[0]?.toLowerCase() ?? '';
    return address.endsWith('@gmail.com') ? 'gmail' : 'email';
  }
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, '');
    return hostPlatforms.find(([pattern]) => pattern.test(host))?.[1] ?? 'custom';
  } catch {
    return 'custom';
  }
}

export function normalizeSocialDestination(destination: string) {
  const value = destination.trim();
  if (!value) return '';

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `mailto:${value}`;

  if (/^mailto:/i.test(value)) {
    const address = value.slice(7).split('?')[0] ?? '';
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) ? `mailto:${address}` : value;
  }

  if (/^\+?[1-9][0-9]{7,14}$/.test(value.replace(/[\s()-]/g, ''))) {
    return `https://wa.me/${value.replace(/\D/g, '')}`;
  }

  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol === 'http:') url.protocol = 'https:';
    return url.toString();
  } catch {
    return value;
  }
}

export function opensInNewTab(destination: string) {
  return !destination.toLowerCase().startsWith('mailto:');
}
