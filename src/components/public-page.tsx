import { Button } from '@/components/ui/button';
import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { ArrowUpRight, CalendarDays, MessageCircle, Sparkles } from 'lucide-react';
import {
  priceLabel,
  type PublicPage,
  type PublicService,
} from '@/features/creators/page-schema';

export function mediaUrl(path: string) {
  return `/api/media?path=${encodeURIComponent(path)}`;
}
export function accentTextColor(hex: string) {
  const parts = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * parts[0]! + 0.7152 * parts[1]! + 0.0722 * parts[2]! > 0.179
    ? '#000000'
    : '#ffffff';
}
export function serviceSummary(s: PublicService) {
  return s.kind === 'scheduled'
    ? `${s.duration} min · ${s.mode === 'online' ? 'Online' : s.location || 'In person'}`
    : s.kind === 'deliverable'
      ? `Delivered within ${s.turnaround} days of acceptance`
      : 'Let’s discuss your project';
}
export function PublicPageView({
  page,
  preview = false,
  onSelect,
  children,
}: {
  page: PublicPage;
  preview?: boolean;
  onSelect?: (s: PublicService) => void;
  children?: ReactNode;
}) {
  const p = page.profile;
  const gradients = {
    night: 'linear-gradient(150deg,#1a153c,#32294a,#111020)',
    ocean: 'linear-gradient(155deg,#083344,#155e75,#042f2e)',
    sunset: 'linear-gradient(155deg,#4c1d4c,#9a3412,#451a03)',
  };
  const bg =
    p.backgroundType === 'image' && p.backgroundImage
      ? `linear-gradient(#0006,#0006), url("${mediaUrl(p.backgroundImage)}")`
      : p.backgroundType === 'gradient'
        ? gradients[p.gradient]
        : p.background;
  const style = {
    '--page-accent': p.accent,
    '--page-accent-text': accentTextColor(p.accent),
    '--page-radius':
      p.buttons === 'pill' ? '999px' : p.buttons === 'square' ? '4px' : '18px',
    background: bg,
    backgroundSize: 'cover',
    backgroundPosition: `center ${p.backgroundPosition}%`,
    fontFamily:
      p.font === 'serif'
        ? 'Georgia,serif'
        : p.font === 'mono'
          ? 'monospace'
          : 'var(--font-manrope),sans-serif',
  } as CSSProperties;
  return (
    <article
      className={`dt-public dt-scheme-${p.scheme} dt-card-${p.cards} ${preview ? 'dt-preview' : ''}`}
      style={style}
    >
      <div className="dt-public-cover">
        {p.cover ? (
          <Image
            unoptimized
            width={1400}
            height={1400}
            src={mediaUrl(p.cover)}
            alt=""
            style={{ objectPosition: `center ${p.coverPosition}%` }}
          />
        ) : (
          <div className="dt-cover-art" aria-hidden="true" />
        )}
      </div>
      <div className="dt-public-body">
        <div className="dt-public-avatar">
          {p.avatar ? (
            <Image
              unoptimized
              width={1400}
              height={1400}
              src={mediaUrl(p.avatar)}
              alt={`${p.displayName}'s profile`}
              style={{ objectPosition: `center ${p.avatarPosition}%` }}
            />
          ) : (
            <span>{p.displayName.slice(0, 2).toUpperCase() || 'YOU'}</span>
          )}
        </div>
        <p className="dt-handle">@{p.username || 'your-name'}</p>
        <h1>{p.displayName || 'Your name. Your world.'}</h1>
        {p.tagline && <p className="dt-tagline">{p.tagline}</p>}
        {p.bio && <p className="dt-bio">{p.bio}</p>}
        {page.services.length > 0 ? (
          <section className="dt-service-list" aria-label="Services">
            <h2>Work with me</h2>
            {page.services.map((s) => (
              <div key={s.id} className="dt-public-service">
                {s.image && (
                  <Image
                    unoptimized
                    width={1400}
                    height={1400}
                    className="dt-service-image"
                    src={mediaUrl(s.image)}
                    alt=""
                    loading="lazy"
                  />
                )}
                <div className="dt-service-title">
                  {s.kind === 'scheduled' ? (
                    <CalendarDays aria-hidden="true" />
                  ) : s.kind === 'deliverable' ? (
                    <Sparkles aria-hidden="true" />
                  ) : (
                    <MessageCircle aria-hidden="true" />
                  )}
                  <h3>{s.title}</h3>
                </div>
                <p className="dt-subtle">{serviceSummary(s)}</p>
                <p>{s.description}</p>
                <div className="dt-service-bottom">
                  <strong>{priceLabel(s)}</strong>
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => onSelect?.(s)}
                    disabled={preview}
                    aria-label={`Request ${s.title}`}
                  >
                    Request <ArrowUpRight aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ))}
          </section>
        ) : (
          <p className="dt-subtle">Your services will appear here.</p>
        )}
        {p.links.length > 0 && (
          <nav className="dt-public-links" aria-label="More from this creator">
            {p.links.map((l, i) => (
              <a
                key={`${l.url}-${i}`}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer nofollow ugc"
              >
                {l.label}
                <ArrowUpRight aria-hidden="true" />
              </a>
            ))}
          </nav>
        )}
        {children}
        <Link className="dt-powered" href="/">
          Made with <strong>Date Tree</strong>
        </Link>
      </div>
    </article>
  );
}
