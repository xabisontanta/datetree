const requiredKeys = [
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
] as const;

/** NEXT_PUBLIC values are baked into browser and RSC output during the build. */
export function assertPublicBuildConfig(env: Record<string, string | undefined>) {
  const missing = requiredKeys.filter((key) => !env[key]?.trim());
  if (missing.length) {
    throw new Error(`Production build requires: ${missing.join(', ')}.`);
  }
  for (const key of ['NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_SUPABASE_URL'] as const) {
    try {
      const url = new URL(env[key]!);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
        throw new Error('Invalid URL');
      }
    } catch {
      throw new Error(`${key} must be a valid HTTP(S) URL without credentials.`);
    }
  }
  if (!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!.startsWith('sb_publishable_')) {
    throw new Error('Use a Supabase publishable key for browser configuration.');
  }
}
