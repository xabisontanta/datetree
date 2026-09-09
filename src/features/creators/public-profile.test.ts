import { describe, expect, it } from 'vitest';

import { PUBLIC_CREATOR_COLUMNS, toPublicCreatorDTO } from './public-profile';

const publicRecord = {
  username: 'thando',
  display_name: 'Thando',
  bio: 'Coffee, good conversations and spontaneous adventures.',
  profile_image_path: 'profiles/thando/avatar.jpg',
  cover_image_path: 'profiles/thando/cover.jpg',
  instagram_handle: 'thando',
  tiktok_handle: null,
  theme_preset: 'vibrant',
  accent_color: '#ff6b6b',
  background_type: 'gradient',
  background_value: 'sunset',
  button_style: 'pill',
  card_style: 'glass',
  font_preset: 'display',
  color_scheme: 'dark',
  phone_number: '+27821234567',
  email: 'private@example.test',
  payout_status: 'active',
};

describe('public creator projection', () => {
  it('maps only fields intended for a public response', () => {
    const dto = toPublicCreatorDTO(publicRecord);

    expect(dto).toEqual({
      slug: 'thando',
      displayName: 'Thando',
      bio: 'Coffee, good conversations and spontaneous adventures.',
      profileImagePath: 'profiles/thando/avatar.jpg',
      coverImagePath: 'profiles/thando/cover.jpg',
      socialLinks: [{ platform: 'instagram', handle: 'thando' }],
      theme: {
        preset: 'vibrant',
        accentColor: '#ff6b6b',
        background: { type: 'gradient', value: 'sunset' },
        buttonStyle: 'pill',
        cardStyle: 'glass',
        fontPreset: 'display',
        colorScheme: 'dark',
      },
    });

    expect(dto).not.toHaveProperty('phone_number');
    expect(dto).not.toHaveProperty('email');
    expect(dto).not.toHaveProperty('payout_status');
    expect(JSON.stringify(dto)).not.toContain('+27821234567');
    expect(JSON.stringify(dto)).not.toContain('private@example.test');
  });

  it('keeps the database select list free of private fields', () => {
    expect(PUBLIC_CREATOR_COLUMNS).not.toContain('whatsapp_number');
    expect(PUBLIC_CREATOR_COLUMNS).not.toContain('email');
    expect(PUBLIC_CREATOR_COLUMNS).not.toContain('requests_paused_at');
  });
});
