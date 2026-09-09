import { describe, expect, it } from 'vitest';

import {
  E164_PHONE_INPUT_PATTERN,
  E164_PHONE_PATTERN,
  signUpSchema,
} from './auth-schema';

const validSignUp = {
  email: 'creator@example.test',
  password: 'securepass1',
  whatsappNumber: '+27656193535',
  isAdult: 'on',
  acceptsTerms: 'on',
  acceptsPrivacy: 'on',
  whatsappConsent: 'on',
};

describe('creator authentication validation', () => {
  it('accepts a valid South African WhatsApp number', () => {
    expect(E164_PHONE_PATTERN.test('+27656193535')).toBe(true);
    expect(signUpSchema.safeParse(validSignUp).success).toBe(true);
  });

  it('uses a browser-safe pattern with the same E.164 rules', () => {
    const browserPattern = new RegExp(`^(?:${E164_PHONE_INPUT_PATTERN})$`);

    expect(browserPattern.test('+27656193535')).toBe(true);
    expect(browserPattern.test('27656193535')).toBe(false);
    expect(browserPattern.test('+27 65 619 3535')).toBe(false);
  });
});
