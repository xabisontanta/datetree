import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

function readInitialMigration() {
  const migrationDirectory = path.resolve('supabase/migrations');
  const file = readdirSync(migrationDirectory).find((candidate) =>
    candidate.endsWith('_phase_1_creator_profiles.sql'),
  );

  if (!file) throw new Error('Phase 1 creator-profile migration is missing.');
  return readFileSync(path.join(migrationDirectory, file), 'utf8');
}

describe('creator profile migration security', () => {
  const migration = readInitialMigration();

  it('enables RLS on both creator profile tables', () => {
    expect(migration).toMatch(
      /alter table public\.profiles_private enable row level security/i,
    );
    expect(migration).toMatch(
      /alter table public\.profiles_public enable row level security/i,
    );
  });

  it('denies anonymous access to private creator records', () => {
    expect(migration).toMatch(
      /revoke all on table public\.profiles_private from anon, authenticated/i,
    );
    expect(migration).not.toMatch(/grant\s+select[^;]*profiles_private\s+to\s+anon/i);
  });

  it('restricts authenticated private access to the owning creator', () => {
    expect(migration).toMatch(/using\s*\(\(select auth\.uid\(\)\) = id\)/i);
    expect(migration).toMatch(/with check\s*\(\(select auth\.uid\(\)\) = id\)/i);
  });

  it('allows anonymous reads only for published public profiles', () => {
    expect(migration).toMatch(/to anon\s+using \(is_published = true\)/i);
  });
});
