import { describe, expect, it } from 'vitest';
import {
  emptyPage,
  newService,
  pageDocumentSchema,
  publicationIssues,
  toPublicPage,
  usernameSchema,
} from './page-schema';

export function validPage() {
  const d = emptyPage();
  d.profile.username = 'coach-thando';
  d.profile.displayName = 'Thando';
  d.services = [newService('enquiry', 'Project enquiry')];
  return d;
}
describe('creator page contracts', () => {
  it('normalizes usernames and rejects reserved or unsafe slugs', () => {
    expect(usernameSchema.parse(' Thando_Coach ')).toBe('thando_coach');
    for (const value of ['api', 'dashboard', 'auth', '../../other', 'a', 'two words'])
      expect(usernameSchema.safeParse(value).success).toBe(false);
  });
  it('allows simple enquiry onboarding without availability', () => {
    const d = validPage();
    expect(pageDocumentSchema.safeParse(d).success).toBe(true);
    expect(publicationIssues(d)).toEqual([]);
  });
  it('requires at least one active service and hours for appointments', () => {
    const d = validPage();
    d.services = [];
    expect(publicationIssues(d)).toHaveLength(1);
    d.services = [newService()];
    expect(publicationIssues(d)).toHaveLength(1);
    d.availability.windows = [{ day: 1, start: '09:00', end: '17:00' }];
    expect(publicationIssues(d)).toEqual([]);
  });
  it('rejects unsafe theme values and external link protocols', () => {
    for (const value of [
      'javascript:alert(1)',
      'http://example.com',
      'https://user:pass@example.com',
    ]) {
      const d = validPage();
      d.profile.links = [{ label: 'Bad link', url: value }];
      expect(pageDocumentSchema.safeParse(d).success).toBe(false);
    }
    const d = validPage();
    d.profile.accent = 'url(https://example.com)';
    expect(pageDocumentSchema.safeParse(d).success).toBe(false);
  });
  it('allows email links and owned custom-icon paths', () => {
    const d = validPage();
    d.profile.links = [
      { label: 'Email me', url: 'mailto:hello@example.com' },
      {
        label: 'Portfolio',
        url: 'https://example.com/work',
        icon: '11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.png',
      },
    ];
    expect(pageDocumentSchema.safeParse(d).success).toBe(true);
  });
  it('limits prices, questions, duplicated services and dates', () => {
    const d = validPage();
    d.services[0]!.pricing = 'fixed';
    expect(pageDocumentSchema.safeParse(d).success).toBe(false);
    d.services[0]!.amount = 2500;
    expect(pageDocumentSchema.safeParse(d).success).toBe(true);
    d.services.push(d.services[0]!);
    expect(pageDocumentSchema.safeParse(d).success).toBe(false);
    d.services.pop();
    d.availability.exceptions = [{ date: '2026-02-30', windows: [] }];
    expect(pageDocumentSchema.safeParse(d).success).toBe(false);
  });
  it('never projects private meeting instructions or availability into public pages', () => {
    const d = validPage();
    d.services[0]!.privateDetails = 'SECRET meeting location';
    d.services.push({ ...newService(), active: false });
    const publicPage = toPublicPage(d);
    expect(publicPage.services).toHaveLength(1);
    expect(JSON.stringify(publicPage)).not.toContain('SECRET');
    expect(publicPage).not.toHaveProperty('availability');
    expect(publicPage.profile.themeVersion).toBe(1);
  });
  it('keeps unfinished live previews renderable', () => {
    expect(toPublicPage(emptyPage()).profile.username).toBe('');
  });
});
