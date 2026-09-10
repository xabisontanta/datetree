import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn<() => Promise<unknown>>(),
  hasConfig: vi.fn(() => true),
  provisionProfile: vi.fn(),
  redirect: vi.fn((path: string): never => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/lib/supabase/config', () => ({
  hasSupabasePublicConfig: mocks.hasConfig,
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/features/creators/provision-private-profile', () => ({
  provisionPrivateCreatorProfile: mocks.provisionProfile,
}));

import {
  requestPasswordReset,
  signIn,
  signOut,
  signUp,
  updatePassword,
} from './actions';

const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

function formData(values: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

function authClient() {
  return {
    auth: {
      getUser: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      signUp: vi.fn(),
      updateUser: vi.fn(),
    },
  };
}

const validSignup = {
  email: 'creator@example.test',
  password: 'securepass1',
  whatsappNumber: '+27656193535',
  isAdult: 'on',
  acceptsTerms: 'on',
  acceptsPrivacy: 'on',
  whatsappConsent: 'on',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasConfig.mockReturnValue(true);
  mocks.provisionProfile.mockResolvedValue({ error: null });
  process.env.NEXT_PUBLIC_APP_URL = 'https://date-tree.example';
});

afterAll(() => consoleError.mockRestore());

describe('signIn', () => {
  it('normalizes email but passes the password through unchanged', async () => {
    const client = authClient();
    const user = { id: 'creator-1' };
    client.auth.signInWithPassword.mockResolvedValue({
      data: { user },
      error: null,
    });
    mocks.createClient.mockResolvedValue(client);

    await expect(
      signIn(
        formData({
          email: ' Creator@Example.Test ',
          password: ' password-with-spaces1 ',
        }),
      ),
    ).rejects.toThrow('NEXT_REDIRECT:/dashboard');

    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'creator@example.test',
      password: ' password-with-spaces1 ',
    });
    expect(mocks.provisionProfile).toHaveBeenCalledWith(client, user);
  });

  it('supports an existing account with a legacy short password', async () => {
    const client = authClient();
    client.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'legacy-creator' } },
      error: null,
    });
    mocks.createClient.mockResolvedValue(client);

    await expect(
      signIn(formData({ email: 'legacy@example.test', password: 'old1' })),
    ).rejects.toThrow('NEXT_REDIRECT:/dashboard');
  });

  it('does not call Supabase when validation fails', async () => {
    await expect(
      signIn(formData({ email: 'not-an-email', password: '' })),
    ).rejects.toThrow('NEXT_REDIRECT:/auth/sign-in?error=');
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('reports invalid credentials without leaking provider text', async () => {
    const client = authClient();
    client.auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: {
        code: 'invalid_credentials',
        message: 'sensitive upstream wording',
        status: 400,
      },
    });
    mocks.createClient.mockResolvedValue(client);

    await expect(
      signIn(formData({ email: 'creator@example.test', password: 'wrong1' })),
    ).rejects.toThrow('Incorrect%20email%20or%20password.');
    expect(consoleError).toHaveBeenCalledWith('Authentication operation failed.', {
      operation: 'sign_in',
      code: 'invalid_credentials',
      status: 400,
    });
  });

  it('tells an unconfirmed account to verify its email', async () => {
    const client = authClient();
    client.auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { code: 'email_not_confirmed', status: 400 },
    });
    mocks.createClient.mockResolvedValue(client);

    await expect(
      signIn(formData({ email: 'creator@example.test', password: 'securepass1' })),
    ).rejects.toThrow('Please%20verify%20your%20email%20before%20signing%20in.');
  });

  it('does not create a private profile after a failed login', async () => {
    const client = authClient();
    client.auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { code: 'invalid_credentials', status: 400 },
    });
    mocks.createClient.mockResolvedValue(client);

    await expect(
      signIn(formData({ email: 'unknown@example.test', password: 'securepass1' })),
    ).rejects.toThrow();
    expect(mocks.provisionProfile).not.toHaveBeenCalled();
  });
});

describe('signUp', () => {
  it('sends normalized data and the production callback to Supabase', async () => {
    const client = authClient();
    client.auth.signUp.mockResolvedValue({
      data: { session: null, user: { id: 'creator-1', identities: [{}] } },
      error: null,
    });
    mocks.createClient.mockResolvedValue(client);

    await expect(
      signUp(formData({ ...validSignup, email: ' Creator@Example.Test ' })),
    ).rejects.toThrow('Check%20your%20email%20to%20finish%20signup.');

    expect(client.auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'creator@example.test',
        password: 'securepass1',
        options: expect.objectContaining({
          emailRedirectTo: 'https://date-tree.example/auth/callback?next=/dashboard',
        }),
      }),
    );
  });

  it('does not claim a duplicate signup changed the password', async () => {
    const client = authClient();
    client.auth.signUp.mockResolvedValue({
      data: { session: null, user: { id: 'masked-user', identities: [] } },
      error: null,
    });
    mocks.createClient.mockResolvedValue(client);

    await expect(signUp(formData(validSignup))).rejects.toThrow(
      'If%20no%20email%20arrives%2C%20sign%20in%20or%20reset%20your%20password.',
    );
  });

  it('provisions a private profile when signup returns a session', async () => {
    const client = authClient();
    const user = { id: 'creator-1' };
    client.auth.signUp.mockResolvedValue({
      data: { session: { access_token: 'redacted' }, user },
      error: null,
    });
    mocks.createClient.mockResolvedValue(client);

    await expect(signUp(formData(validSignup))).rejects.toThrow(
      'NEXT_REDIRECT:/dashboard',
    );
    expect(mocks.provisionProfile).toHaveBeenCalledWith(client, user);
  });

  it('does not provision a profile when Supabase rejects signup', async () => {
    const client = authClient();
    client.auth.signUp.mockResolvedValue({
      data: { session: null, user: null },
      error: { code: 'over_email_send_rate_limit', status: 429 },
    });
    mocks.createClient.mockResolvedValue(client);

    await expect(signUp(formData(validSignup))).rejects.toThrow(
      'Too%20many%20account%20requests.',
    );
    expect(mocks.provisionProfile).not.toHaveBeenCalled();
  });
});

describe('password recovery', () => {
  it('requests a reset with a normalized email and recovery callback', async () => {
    const client = authClient();
    client.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue(client);

    await expect(
      requestPasswordReset(formData({ email: ' Creator@Example.Test ' })),
    ).rejects.toThrow('If%20an%20account%20exists%20for%20that%20email');

    expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'creator@example.test',
      {
        redirectTo:
          'https://date-tree.example/auth/callback?next=/auth/update-password',
      },
    );
  });

  it('uses the same non-enumerating response for an unknown email', async () => {
    const client = authClient();
    client.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue(client);

    await expect(
      requestPasswordReset(formData({ email: 'unknown@example.test' })),
    ).rejects.toThrow('If%20an%20account%20exists%20for%20that%20email');
  });

  it('rejects mismatched new passwords before calling Supabase', async () => {
    await expect(
      updatePassword(
        formData({
          password: 'new-password1',
          passwordConfirmation: 'different-password2',
        }),
      ),
    ).rejects.toThrow('Passwords%20do%20not%20match.');
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('rejects an expired recovery session', async () => {
    const client = authClient();
    client.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { code: 'session_not_found', status: 403 },
    });
    mocks.createClient.mockResolvedValue(client);

    await expect(
      updatePassword(
        formData({
          password: 'new-password1',
          passwordConfirmation: 'new-password1',
        }),
      ),
    ).rejects.toThrow('Your%20reset%20link%20is%20invalid%20or%20expired.');
  });

  it('updates the password and globally revokes the recovery session', async () => {
    const client = authClient();
    client.auth.getUser.mockResolvedValue({
      data: { user: { id: 'creator-1' } },
      error: null,
    });
    client.auth.updateUser.mockResolvedValue({ error: null });
    client.auth.signOut.mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue(client);

    await expect(
      updatePassword(
        formData({
          password: 'new-password1',
          passwordConfirmation: 'new-password1',
        }),
      ),
    ).rejects.toThrow('Password%20updated.');

    expect(client.auth.updateUser).toHaveBeenCalledWith({
      password: 'new-password1',
    });
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'global' });
  });
});

describe('configuration and logout', () => {
  it('fails safely when authentication is not configured', async () => {
    mocks.hasConfig.mockReturnValue(false);

    await expect(
      signIn(formData({ email: 'creator@example.test', password: 'securepass1' })),
    ).rejects.toThrow('Authentication%20is%20not%20configured');
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('signs out the current session and returns home', async () => {
    const client = authClient();
    client.auth.signOut.mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue(client);

    await expect(signOut()).rejects.toThrow('NEXT_REDIRECT:/');
    expect(client.auth.signOut).toHaveBeenCalledOnce();
  });
});
