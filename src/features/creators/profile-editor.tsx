'use client';
import { Button } from '@/components/ui/button';

import { Field, Select, TextArea } from '@/components/editor-fields';
import { SocialIcon } from '@/components/social-icon';
import { ImageUpload } from './image-upload';
import type { PageProfile } from './page-schema';
import {
  detectSocialPlatform,
  normalizeSocialDestination,
  platformLabel,
} from './social-links';
export function ProfileEditor({
  profile: p,
  locked,
  onChange,
}: {
  profile: PageProfile;
  locked: boolean;
  onChange: (p: PageProfile) => void;
}) {
  return (
    <div className="dt-stack">
      <div className="dt-row dt-align-top">
        <Field
          label="Display name"
          value={p.displayName}
          maxLength={80}
          autoComplete="name"
          onChange={(e) => onChange({ ...p, displayName: e.target.value })}
        />
        <Field
          label="Your username"
          value={p.username}
          disabled={locked}
          maxLength={30}
          autoCapitalize="none"
          spellCheck={false}
          help={
            locked
              ? 'Your published username stays fixed so shared links keep working.'
              : '3–30 letters, numbers, underscores or hyphens. Reserved when you save.'
          }
          onChange={(e) =>
            onChange({ ...p, username: e.target.value.toLowerCase().trim() })
          }
        />
      </div>
      <Field
        label="Tagline (optional)"
        value={p.tagline}
        maxLength={100}
        placeholder="Fitness coach. Small steps, lasting change."
        onChange={(e) => onChange({ ...p, tagline: e.target.value })}
      />
      <TextArea
        label="Bio"
        value={p.bio}
        maxLength={500}
        placeholder="Who you help, what you do, and a little about you."
        onChange={(e) => onChange({ ...p, bio: e.target.value })}
      />
      <ImageUpload
        label="Profile photo (optional)"
        value={p.avatar}
        onChange={(avatar) => onChange({ ...p, avatar })}
        position={p.avatarPosition}
        onPosition={(avatarPosition) => onChange({ ...p, avatarPosition })}
      />
      <details>
        <summary>
          Social links and buttons <small>Optional</small>
        </summary>
        <div className="dt-stack dt-detail-body">
          {p.links.map((l, i) => (
            <div key={i} className="dt-panel dt-stack dt-social-link-editor">
              <div className="dt-social-link-heading">
                <span className="dt-social-link-preview" aria-hidden="true">
                  <SocialIcon platform={detectSocialPlatform(l.url)} />
                </span>
                <div>
                  <strong>{platformLabel(detectSocialPlatform(l.url))}</strong>
                  <small>
                    {detectSocialPlatform(l.url) === 'custom'
                      ? 'Add your own logo, or Date Tree will show a link icon.'
                      : 'Date Tree will use the official platform icon.'}
                  </small>
                </div>
              </div>
              <Field
                label="Link name"
                value={l.label}
                maxLength={60}
                placeholder="Instagram, coaching website, email..."
                onChange={(e) =>
                  onChange({
                    ...p,
                    links: p.links.map((v, n) =>
                      n === i ? { ...v, label: e.target.value } : v,
                    ),
                  })
                }
              />
              <Field
                label="Destination"
                value={l.url}
                type="text"
                inputMode="url"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="instagram.com/yourname or you@example.com"
                onChange={(e) =>
                  onChange({
                    ...p,
                    links: p.links.map((v, n) =>
                      n === i ? { ...v, url: e.target.value } : v,
                    ),
                  })
                }
                onBlur={() => {
                  const url = normalizeSocialDestination(l.url);
                  const platform = detectSocialPlatform(url);
                  onChange({
                    ...p,
                    links: p.links.map((value, index) =>
                      index === i
                        ? {
                            ...value,
                            url,
                            label:
                              value.label ||
                              (platform === 'custom' ? '' : platformLabel(platform)),
                            icon: platform === 'custom' ? value.icon : '',
                          }
                        : value,
                    ),
                  });
                }}
              />
              {detectSocialPlatform(l.url) === 'custom' && (
                <ImageUpload
                  label="Custom icon (optional)"
                  value={l.icon ?? ''}
                  onChange={(icon) =>
                    onChange({
                      ...p,
                      links: p.links.map((value, index) =>
                        index === i ? { ...value, icon } : value,
                      ),
                    })
                  }
                />
              )}
              <div className="dt-actions">
                <Button
                  variant="ghost"
                  type="button"
                  className="dt-text-button"
                  disabled={i === 0}
                  onClick={() => {
                    const links = [...p.links];
                    [links[i - 1], links[i]] = [links[i]!, links[i - 1]!];
                    onChange({ ...p, links });
                  }}
                  aria-label={`Move ${l.label} up`}
                >
                  ↑ Up
                </Button>
                <Button
                  variant="ghost"
                  type="button"
                  className="dt-text-button"
                  disabled={i === p.links.length - 1}
                  onClick={() => {
                    const links = [...p.links];
                    [links[i + 1], links[i]] = [links[i]!, links[i + 1]!];
                    onChange({ ...p, links });
                  }}
                  aria-label={`Move ${l.label} down`}
                >
                  ↓ Down
                </Button>
                <Button
                  variant="ghost"
                  type="button"
                  className="dt-text-button"
                  onClick={() =>
                    onChange({ ...p, links: p.links.filter((_, n) => n !== i) })
                  }
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
          {p.links.length < 12 && (
            <Button
              variant="ghost"
              type="button"
              className="dt-button-secondary"
              onClick={() =>
                onChange({
                  ...p,
                  links: [...p.links, { label: '', url: '', icon: '' }],
                })
              }
            >
              ＋ Add a link
            </Button>
          )}
          <small>
            Paste a social URL, email address, or WhatsApp number. Links appear publicly
            only after they are valid, saved, and published.
          </small>
        </div>
      </details>
    </div>
  );
}
const themes: { label: string; values: Partial<PageProfile> }[] = [
  {
    label: 'Midnight',
    values: {
      theme: 'dark',
      scheme: 'dark',
      accent: '#ff6058',
      background: '#111020',
      backgroundType: 'solid',
      font: 'sans',
      cards: 'solid',
      buttons: 'pill',
    },
  },
  {
    label: 'Studio',
    values: {
      theme: 'minimal',
      scheme: 'light',
      accent: '#176953',
      background: '#f5f2eb',
      backgroundType: 'solid',
      font: 'sans',
      cards: 'outline',
      buttons: 'rounded',
    },
  },
  {
    label: 'Editorial',
    values: {
      theme: 'luxury',
      scheme: 'light',
      accent: '#785633',
      background: '#f3eadc',
      backgroundType: 'solid',
      font: 'serif',
      cards: 'outline',
      buttons: 'square',
    },
  },
  {
    label: 'Electric',
    values: {
      theme: 'vibrant',
      scheme: 'dark',
      accent: '#b4e86d',
      background: '#171b16',
      backgroundType: 'gradient',
      gradient: 'ocean',
      font: 'sans',
      cards: 'glass',
      buttons: 'pill',
    },
  },
  {
    label: 'Blush',
    values: {
      theme: 'soft',
      scheme: 'light',
      accent: '#8e3c65',
      background: '#faecf2',
      backgroundType: 'solid',
      font: 'serif',
      cards: 'solid',
      buttons: 'rounded',
    },
  },
];
export function AppearanceEditor({
  profile: p,
  onChange,
}: {
  profile: PageProfile;
  onChange: (p: PageProfile) => void;
}) {
  return (
    <div className="dt-stack">
      <p className="dt-muted">
        Start with a theme, then make it yours. Your live preview updates as you edit.
      </p>
      <div className="dt-theme-grid">
        {themes.map((t) => (
          <Button
            variant="ghost"
            key={t.label}
            type="button"
            className="dt-theme"
            aria-pressed={p.theme === t.values.theme}
            style={{
              background: t.values.background,
              color: t.values.scheme === 'dark' ? '#fff' : '#151515',
            }}
            onClick={() => onChange({ ...p, ...t.values })}
          >
            <span style={{ background: t.values.accent }} />
            {t.label}
          </Button>
        ))}
      </div>
      <div className="dt-row">
        <Field
          label="Accent colour"
          type="color"
          value={p.accent}
          onChange={(e) => onChange({ ...p, accent: e.target.value })}
        />
        <Select
          label="Text colour"
          value={p.scheme}
          onChange={(e) =>
            onChange({ ...p, scheme: e.target.value as PageProfile['scheme'] })
          }
        >
          <option value="dark">Light text (dark background)</option>
          <option value="light">Dark text (light background)</option>
        </Select>
      </div>
      <ImageUpload
        label="Cover banner"
        value={p.cover}
        onChange={(cover) => onChange({ ...p, cover })}
        position={p.coverPosition}
        onPosition={(coverPosition) => onChange({ ...p, coverPosition })}
      />
      <Select
        label="Page background"
        value={p.backgroundType}
        onChange={(e) =>
          onChange({
            ...p,
            backgroundType: e.target.value as PageProfile['backgroundType'],
          })
        }
      >
        <option value="solid">Solid colour</option>
        <option value="gradient">Gradient</option>
        <option value="image">Background photo</option>
      </Select>
      {p.backgroundType === 'solid' && (
        <Field
          label="Background colour"
          type="color"
          value={p.background}
          onChange={(e) => onChange({ ...p, background: e.target.value })}
        />
      )}
      {p.backgroundType === 'gradient' && (
        <Select
          label="Gradient"
          value={p.gradient}
          onChange={(e) =>
            onChange({
              ...p,
              gradient: e.target.value as PageProfile['gradient'],
              scheme: 'dark',
            })
          }
        >
          <option value="night">Nightfall</option>
          <option value="ocean">Deep ocean</option>
          <option value="sunset">Sunset</option>
        </Select>
      )}
      {p.backgroundType === 'image' && (
        <ImageUpload
          label="Background photo (separate from your banner)"
          value={p.backgroundImage}
          onChange={(backgroundImage) => onChange({ ...p, backgroundImage })}
          position={p.backgroundPosition}
          onPosition={(backgroundPosition) => onChange({ ...p, backgroundPosition })}
        />
      )}
      <div className="dt-row">
        <Select
          label="Font"
          value={p.font}
          onChange={(e) =>
            onChange({ ...p, font: e.target.value as PageProfile['font'] })
          }
        >
          <option value="sans">Modern</option>
          <option value="serif">Editorial</option>
          <option value="mono">Monospace</option>
        </Select>
        <Select
          label="Buttons"
          value={p.buttons}
          onChange={(e) =>
            onChange({ ...p, buttons: e.target.value as PageProfile['buttons'] })
          }
        >
          <option value="pill">Pill</option>
          <option value="rounded">Rounded</option>
          <option value="square">Square</option>
        </Select>
        <Select
          label="Service cards"
          value={p.cards}
          onChange={(e) =>
            onChange({ ...p, cards: e.target.value as PageProfile['cards'] })
          }
        >
          <option value="solid">Solid</option>
          <option value="glass">Glass</option>
          <option value="outline">Outline</option>
        </Select>
      </div>
      <small>Preview your colour choices for readability before publishing.</small>
    </div>
  );
}
