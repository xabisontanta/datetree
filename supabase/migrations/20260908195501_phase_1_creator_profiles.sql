-- Phase 1 establishes an explicit public/private creator data boundary.
-- Grants and RLS are intentionally declared together so Data API exposure is auditable.

create table public.profiles_private (
  id uuid primary key references auth.users (id) on delete cascade,
  whatsapp_number text,
  whatsapp_verified_at timestamptz,
  is_adult boolean not null default false,
  terms_accepted_at timestamptz,
  privacy_accepted_at timestamptz,
  whatsapp_notifications_consent_at timestamptz,
  requests_paused_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_private_whatsapp_e164_check
    check (
      whatsapp_number is null
      or whatsapp_number ~ '^\+[1-9][0-9]{7,14}$'
    )
);

create table public.profiles_public (
  creator_id uuid primary key references public.profiles_private (id) on delete cascade,
  username text not null,
  display_name text not null,
  bio text,
  profile_image_path text,
  cover_image_path text,
  instagram_handle text,
  tiktok_handle text,
  theme_preset text not null default 'minimal',
  accent_color text not null default '#ff6b6b',
  background_type text not null default 'solid',
  background_value text not null default '#0d0e12',
  button_style text not null default 'pill',
  card_style text not null default 'solid',
  font_preset text not null default 'sans',
  color_scheme text not null default 'dark',
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_public_username_format_check
    check (username = lower(username) and username ~ '^[a-z0-9][a-z0-9_-]{2,29}$'),
  constraint profiles_public_display_name_length_check
    check (char_length(display_name) between 1 and 80),
  constraint profiles_public_bio_length_check
    check (bio is null or char_length(bio) <= 500),
  constraint profiles_public_accent_color_check
    check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  constraint profiles_public_theme_preset_check
    check (theme_preset in ('minimal', 'luxury', 'soft', 'dark', 'vibrant', 'elegant', 'playful')),
  constraint profiles_public_background_type_check
    check (background_type in ('solid', 'gradient', 'image')),
  constraint profiles_public_background_value_length_check
    check (char_length(background_value) between 1 and 2048),
  constraint profiles_public_button_style_check
    check (button_style in ('rounded', 'pill', 'square')),
  constraint profiles_public_card_style_check
    check (card_style in ('solid', 'glass', 'outline')),
  constraint profiles_public_font_preset_check
    check (font_preset in ('sans', 'serif', 'display', 'mono')),
  constraint profiles_public_color_scheme_check
    check (color_scheme in ('light', 'dark', 'system')),
  constraint profiles_public_publish_timestamp_check
    check (
      (is_published = false and published_at is null)
      or (is_published = true and published_at is not null)
    )
);

create unique index profiles_public_username_unique_idx
  on public.profiles_public (lower(username));

create index profiles_public_published_username_idx
  on public.profiles_public (username)
  where is_published = true;

alter table public.profiles_private enable row level security;
alter table public.profiles_public enable row level security;

revoke all on table public.profiles_private from anon, authenticated;
grant select, insert, update on table public.profiles_private to authenticated;

revoke all on table public.profiles_public from anon, authenticated;
grant select on table public.profiles_public to anon;
grant select, insert, update on table public.profiles_public to authenticated;

create policy "Creators can read their private profile"
on public.profiles_private
for select
to authenticated
using ((select auth.uid()) = id);

create policy "Creators can create their private profile"
on public.profiles_private
for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "Creators can update their private profile"
on public.profiles_private
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Visitors can read published creator profiles"
on public.profiles_public
for select
to anon
using (is_published = true);

create policy "Creators can read their own or published profiles"
on public.profiles_public
for select
to authenticated
using (is_published = true or (select auth.uid()) = creator_id);

create policy "Creators can create their public profile"
on public.profiles_public
for insert
to authenticated
with check ((select auth.uid()) = creator_id);

create policy "Creators can update their public profile"
on public.profiles_public
for update
to authenticated
using ((select auth.uid()) = creator_id)
with check ((select auth.uid()) = creator_id);

comment on table public.profiles_public is
  'Allow-listed creator information that may be exposed when is_published is true.';

comment on table public.profiles_private is
  'Creator-owned private information. Never expose this table to anonymous clients.';
