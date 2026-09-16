import { describe, expect, it } from 'vitest';
import {
  detectSocialPlatform,
  normalizeSocialDestination,
  opensInNewTab,
} from './social-links';

describe('creator social links', () => {
  it('detects supported platforms from canonical and alternate hosts', () => {
    expect(detectSocialPlatform('https://instagram.com/date.tree')).toBe('instagram');
    expect(detectSocialPlatform('https://twitter.com/date_tree')).toBe('x');
    expect(detectSocialPlatform('https://youtu.be/video')).toBe('youtube');
    expect(detectSocialPlatform('https://wa.me/27656193535')).toBe('whatsapp');
    expect(detectSocialPlatform('mailto:hello@gmail.com')).toBe('gmail');
    expect(detectSocialPlatform('https://example.com/about')).toBe('custom');
  });

  it('normalizes domains, email addresses, phones and legacy HTTP links', () => {
    expect(normalizeSocialDestination('instagram.com/date.tree')).toBe(
      'https://instagram.com/date.tree',
    );
    expect(normalizeSocialDestination('hello@example.com')).toBe(
      'mailto:hello@example.com',
    );
    expect(normalizeSocialDestination('+27 65 619 3535')).toBe(
      'https://wa.me/27656193535',
    );
    expect(normalizeSocialDestination('http://example.com/me')).toBe(
      'https://example.com/me',
    );
  });

  it('keeps email in the current browser and external sites isolated', () => {
    expect(opensInNewTab('mailto:hello@example.com')).toBe(false);
    expect(opensInNewTab('https://example.com')).toBe(true);
  });
});
