import { Globe2, Mail } from 'lucide-react';
import { FaLinkedinIn } from 'react-icons/fa6';
import {
  SiFacebook,
  SiGithub,
  SiGmail,
  SiInstagram,
  SiOnlyfans,
  SiTiktok,
  SiWhatsapp,
  SiX,
  SiYoutube,
} from 'react-icons/si';
import type { IconType } from 'react-icons';
import type { SocialPlatform } from '@/features/creators/social-links';

const icons: Partial<Record<SocialPlatform, IconType>> = {
  facebook: SiFacebook,
  instagram: SiInstagram,
  tiktok: SiTiktok,
  x: SiX,
  linkedin: FaLinkedinIn,
  youtube: SiYoutube,
  onlyfans: SiOnlyfans,
  whatsapp: SiWhatsapp,
  gmail: SiGmail,
  github: SiGithub,
};

export function SocialIcon({ platform }: { platform: SocialPlatform }) {
  const Icon = icons[platform];
  if (Icon) return <Icon aria-hidden="true" focusable="false" />;
  if (platform === 'email') return <Mail aria-hidden="true" />;
  return <Globe2 aria-hidden="true" />;
}
