import { describe, expect, it } from 'vitest';

import {
  E164_PHONE_INPUT_PATTERN,
  E164_PHONE_PATTERN,
  requestPasswordResetSchema,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
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

  it('normalizes email casing and surrounding whitespace', () => {
    const result = signInSchema.parse({
      email: '  Creator@Example.Test ',
      password: 'unchanged password',
    });

    expect(result.email).toBe('creator@example.test');
  });

  it('never trims or otherwise changes a sign-in password', () => {
    const result = signInSchema.parse({
      email: 'creator@example.test',
      password: ' leading-and-trailing1 ',
    });

    expect(result.password).toBe(' leading-and-trailing1 ');
  });

  it('accepts legacy sign-in passwords shorter than the current signup minimum', () => {
    expect(
      signInSchema.safeParse({ email: 'creator@example.test', password: 'old1' })
        .success,
    ).toBe(true);
  });

  it('still enforces the current password policy for new accounts', () => {
    expect(signUpSchema.safeParse({ ...validSignUp, password: 'old1' }).success).toBe(
      false,
    );
  });

  it('normalizes an email submitted for password recovery', () => {
    expect(
      requestPasswordResetSchema.parse({ email: ' Creator@Example.Test ' }).email,
    ).toBe('creator@example.test');
  });

  it('requires matching new-password confirmation', () => {
    expect(
      updatePasswordSchema.safeParse({
        password: 'new-password1',
        passwordConfirmation: 'different-password2',
      }).success,
    ).toBe(false);
  });

  it('accepts a matching password that meets the policy', () => {
    expect(
      updatePasswordSchema.safeParse({
        password: 'new-password1',
        passwordConfirmation: 'new-password1',
      }).success,
    ).toBe(true);
  });
});
