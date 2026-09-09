import {
  ArrowUpRight,
  CalendarCheck2,
  Check,
  Clock3,
  Coffee,
  LockKeyhole,
  MessageCircleMore,
  Phone,
  ShieldCheck,
  Sparkles,
  Video,
} from 'lucide-react';
import Link from 'next/link';

import { BrandMark } from '@/components/brand-mark';

const experiences = [
  { icon: Coffee, title: 'Coffee date', meta: '60 min', price: 'R250' },
  { icon: Video, title: 'Video call', meta: '20 min', price: 'R100' },
  { icon: Phone, title: "Let's talk", meta: '30 min', price: 'Free' },
];

const steps = [
  {
    number: '01',
    title: 'Share one link',
    copy: 'Add your page to any social bio. No marketplace or discovery feed.',
    icon: Sparkles,
  },
  {
    number: '02',
    title: 'Choose every request',
    copy: 'People ask for your time. You accept, decline, or suggest another time.',
    icon: CalendarCheck2,
  },
  {
    number: '03',
    title: 'Confirm the plan',
    copy: 'Payment only happens after you accept. WhatsApp keeps everyone updated.',
    icon: MessageCircleMore,
  },
];

export default function Home() {
  return (
    <main className="site-shell">
      <header className="site-header">
        <BrandMark />
        <nav className="desktop-nav" aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#privacy">Privacy</a>
        </nav>
        <div className="header-actions">
          <Link className="text-link" href="/auth/sign-in">
            Sign in
          </Link>
          <Link className="mini-cta" href="/auth/sign-up">
            Create my link
          </Link>
        </div>
      </header>

      <section className="hero-section">
        <div className="hero-copy">
          <div className="hero-kicker">
            <span className="pulse-dot" />
            Your link. Your time. Your terms.
          </div>
          <h1>
            Turn interest into
            <span> an actual plan.</span>
          </h1>
          <p className="hero-subtitle">
            Create your personal social booking link. Let people request a call, coffee,
            date or conversation — on your terms.
          </p>
          <div className="hero-actions">
            <Link className="button-link button-link-primary" href="/auth/sign-up">
              Create my link
              <ArrowUpRight aria-hidden="true" />
            </Link>
            <a className="button-link button-link-secondary" href="#profile-preview">
              View demo
            </a>
          </div>
          <ul className="trust-list" aria-label="Product promises">
            <li>
              <Check aria-hidden="true" /> No discovery feed
            </li>
            <li>
              <Check aria-hidden="true" /> You approve every request
            </li>
            <li>
              <Check aria-hidden="true" /> Free to start
            </li>
          </ul>
        </div>

        <div className="profile-stage" id="profile-preview">
          <div className="stage-orbit stage-orbit-one" aria-hidden="true" />
          <div className="stage-orbit stage-orbit-two" aria-hidden="true" />
          <div className="status-float status-float-top">
            <MessageCircleMore aria-hidden="true" />
            <span>
              <strong>New request</strong>
              Video call · Saturday
            </span>
          </div>
          <article className="profile-card" aria-label="Example creator profile">
            <div className="phone-topline" aria-hidden="true">
              <span>9:41</span>
              <span className="phone-island" />
              <span>•••</span>
            </div>
            <div className="profile-cover">
              <div className="cover-grain" aria-hidden="true" />
              <span className="profile-badge">Available this week</span>
            </div>
            <div className="profile-content">
              <div className="profile-avatar" aria-hidden="true">
                T
              </div>
              <p className="profile-handle">@thando</p>
              <h2>Thando</h2>
              <p className="profile-bio">
                Coffee, good conversations and spontaneous adventures ✨
              </p>
              <div className="experience-list">
                {experiences.map(({ icon: Icon, title, meta, price }) => (
                  <div className="experience-card" key={title}>
                    <span className="experience-icon">
                      <Icon aria-hidden="true" />
                    </span>
                    <span className="experience-copy">
                      <strong>{title}</strong>
                      <span>
                        <Clock3 aria-hidden="true" /> {meta}
                      </span>
                    </span>
                    <strong className="experience-price">{price}</strong>
                  </div>
                ))}
              </div>
              <p className="preview-note">
                This preview is fictional. Booking opens in a later phase.
              </p>
            </div>
          </article>
          <div className="status-float status-float-bottom">
            <ShieldCheck aria-hidden="true" />
            <span>
              <strong>Private by design</strong>
              Your real calendar stays hidden
            </span>
          </div>
        </div>
      </section>

      <section className="signal-strip" aria-label="Core product values">
        <span>Built for social bios</span>
        <span aria-hidden="true">✦</span>
        <span>Consent before payment</span>
        <span aria-hidden="true">✦</span>
        <span>Mobile from the first tap</span>
      </section>

      <section className="steps-section" id="how-it-works">
        <div className="section-heading">
          <p className="eyebrow">How it works</p>
          <h2>Interest is easy. Making the plan should be too.</h2>
        </div>
        <div className="step-grid">
          {steps.map(({ number, title, copy, icon: Icon }) => (
            <article className="step-card" key={number}>
              <div className="step-topline">
                <span>{number}</span>
                <Icon aria-hidden="true" />
              </div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="privacy-section" id="privacy">
        <div className="privacy-icon">
          <LockKeyhole aria-hidden="true" />
        </div>
        <div>
          <p className="eyebrow">Privacy, not performance</p>
          <h2>Your calendar is nobody else&apos;s business.</h2>
          <p>
            Visitors see only calculated times they can request. Never your phone
            number, email, appointments, calendar details, or another person&apos;s
            booking.
          </p>
        </div>
        <Link className="privacy-link" href="/auth/sign-up">
          Start on your terms
          <ArrowUpRight aria-hidden="true" />
        </Link>
      </section>

      <footer className="site-footer">
        <BrandMark />
        <p>Social plans, with consent built in.</p>
        <p>© {new Date().getUTCFullYear()} Date Tree</p>
      </footer>
    </main>
  );
}
