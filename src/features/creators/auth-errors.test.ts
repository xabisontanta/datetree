import { describe, expect, it } from 'vitest';

import {
  authFailureDetails,
  resetPasswordFailureMessage,
  signInFailureMessage,
  signUpFailureMessage,
  updatePasswordFailureMessage,
} from './auth-errors';

describe('safe authentication errors', () => {
  it('distinguishes an unconfirmed email from a wrong password', () => {
    expect(signInFailureMessage({ code: 'email_not_confirmed', status: 400 })).toBe(
      'Please verify your email before signing in.',
    );
  });

  it('returns an actionable invalid-credentials message', () => {
    expect(signInFailureMessage({ code: 'invalid_credentials', status: 400 })).toBe(
      'Incorrect email or password.',
    );
  });

  it('handles rate limits without exposing provider details', () => {
    expect(signInFailureMessage({ status: 429 })).toContain('Too many');
    expect(
      resetPasswordFailureMessage({ code: 'over_email_send_rate_limit' }),
    ).toContain('Too many');
  });

  it('provides a useful weak-password response', () => {
    expect(signUpFailureMessage({ code: 'weak_password' })).toContain(
      'at least 10 characters',
    );
    expect(updatePasswordFailureMessage({ code: 'weak_password' })).toContain(
      'at least 10 characters',
    );
  });

  it('logs only the provider code and status', () => {
    expect(authFailureDetails({ code: 'invalid_credentials', status: 400 })).toEqual({
      code: 'invalid_credentials',
      status: 400,
    });
  });
});
