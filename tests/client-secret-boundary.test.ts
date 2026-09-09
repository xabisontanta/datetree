import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('browser Supabase client', () => {
  it('depends only on browser-safe publishable configuration', () => {
    const clientSource = readFileSync(
      path.resolve('src/lib/supabase/client.ts'),
      'utf8',
    );

    expect(clientSource).toContain('getSupabasePublicConfig');
    expect(clientSource).not.toMatch(/service.role/i);
    expect(clientSource).not.toContain('SUPABASE_SECRET_KEY');
    expect(clientSource).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });
});
