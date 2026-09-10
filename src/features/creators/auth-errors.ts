type AuthFailure = {
  code?: string;
  status?: number;
};

const RATE_LIMIT_CODES = new Set([
  'over_email_send_rate_limit',
  'over_request_rate_limit',
  'over_sms_send_rate_limit',
]);

function isRateLimited(error: AuthFailure) {
  return error.status === 429 || (error.code && RATE_LIMIT_CODES.has(error.code));
}

export function authFailureDetails(error: AuthFailure) {
  return {
    code: error.code ?? 'unknown_auth_error',
    status: error.status ?? null,
  };
}

export function signInFailureMessage(error: AuthFailure) {
  if (error.code === 'email_not_confirmed') {
    return 'Please verify your email before signing in.';
  }

  if (error.code === 'invalid_credentials') {
    return 'Incorrect email or password.';
  }

  if (isRateLimited(error)) {
    return 'Too many sign-in attempts. Wait a moment, then try again.';
  }

  return 'Sign-in is temporarily unavailable. Please try again.';
}

export function signUpFailureMessage(error: AuthFailure) {
  if (error.code === 'weak_password') {
    return 'Use a stronger password with at least 10 characters and a number.';
  }

  if (isRateLimited(error)) {
    return 'Too many account requests. Wait a moment, then try again.';
  }

  return 'We could not create your account. Try again or reset your password.';
}

export function resetPasswordFailureMessage(error: AuthFailure) {
  if (isRateLimited(error)) {
    return 'Too many reset requests. Wait a moment, then try again.';
  }

  return 'Password recovery is temporarily unavailable. Please try again.';
}

export function updatePasswordFailureMessage(error: AuthFailure) {
  if (error.code === 'weak_password') {
    return 'Use a stronger password with at least 10 characters and a number.';
  }

  return 'We could not update your password. Request a new reset link and try again.';
}
