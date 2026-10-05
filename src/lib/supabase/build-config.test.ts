import { describe, expect, it } from 'vitest';
import { assertPublicBuildConfig } from './build-config';

const configured = {
  NEXT_PUBLIC_APP_URL: 'https://app.example.test',
  NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_fixture',
};

describe('public production configuration', () => {
  it('accepts configured browser-safe values', () => {
    expect(() => assertPublicBuildConfig(configured)).not.toThrow();
  });

  it.each(Object.keys(configured))('rejects missing or empty %s', (key) => {
    expect(() => assertPublicBuildConfig({ ...configured, [key]: '' })).toThrow(key);
    expect(() => assertPublicBuildConfig({ ...configured, [key]: undefined })).toThrow(key);
  });

  it('rejects unsafe URLs and server secrets without printing their values', () => {
    expect(() => assertPublicBuildConfig({
      ...configured, NEXT_PUBLIC_APP_URL: 'javascript:alert(1)',
    })).toThrow('NEXT_PUBLIC_APP_URL');
    expect(() => assertPublicBuildConfig({
      ...configured, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_private',
    })).toThrow('Use a Supabase publishable key');
  });
});
