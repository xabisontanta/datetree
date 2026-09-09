import type { Database } from '@/lib/supabase/database.types';

type PublicCreatorRow = Database['public']['Tables']['profiles_public']['Row'];

export const PUBLIC_CREATOR_COLUMNS = [
  'username',
  'display_name',
  'bio',
  'profile_image_path',
  'cover_image_path',
  'instagram_handle',
  'tiktok_handle',
  'theme_preset',
  'accent_color',
  'background_type',
  'background_value',
  'button_style',
  'card_style',
  'font_preset',
  'color_scheme',
] as const satisfies readonly (keyof PublicCreatorRow)[];

export type PublicCreatorDTO = {
  slug: string;
  displayName: string;
  bio: string | null;
  profileImagePath: string | null;
  coverImagePath: string | null;
  socialLinks: Array<{
    platform: 'instagram' | 'tiktok';
    handle: string;
  }>;
  theme: {
    preset: string;
    accentColor: string;
    background: {
      type: string;
      value: string;
    };
    buttonStyle: string;
    cardStyle: string;
    fontPreset: string;
    colorScheme: string;
  };
};

export function toPublicCreatorDTO(
  row: Pick<PublicCreatorRow, (typeof PUBLIC_CREATOR_COLUMNS)[number]>,
): PublicCreatorDTO {
  const socialLinks: PublicCreatorDTO['socialLinks'] = [];

  if (row.instagram_handle) {
    socialLinks.push({ platform: 'instagram', handle: row.instagram_handle });
  }

  if (row.tiktok_handle) {
    socialLinks.push({ platform: 'tiktok', handle: row.tiktok_handle });
  }

  return {
    slug: row.username,
    displayName: row.display_name,
    bio: row.bio,
    profileImagePath: row.profile_image_path,
    coverImagePath: row.cover_image_path,
    socialLinks,
    theme: {
      preset: row.theme_preset,
      accentColor: row.accent_color,
      background: {
        type: row.background_type,
        value: row.background_value,
      },
      buttonStyle: row.button_style,
      cardStyle: row.card_style,
      fontPreset: row.font_preset,
      colorScheme: row.color_scheme,
    },
  };
}
