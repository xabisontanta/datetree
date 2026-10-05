import { describe, expect, it } from 'vitest';
import { runInboxAction } from './inbox-action';

describe('inbox action recovery', () => {
  it('refreshes authoritative status after a successful transition', async () => {
    expect(await runInboxAction(async () => ({ error: '' }))).toEqual({
      error: '',
      refresh: true,
    });
  });

  it('preserves a known rejection without claiming success', async () => {
    expect(await runInboxAction(async () => ({ error: 'This request changed.' })))
      .toEqual({ error: 'This request changed.', refresh: false });
  });

  it('refreshes after transport loss without retrying an uncertain mutation', async () => {
    let attempts = 0;
    const result = await runInboxAction(async () => {
      attempts += 1;
      throw new Error('Response lost');
    });
    expect(attempts).toBe(1);
    expect(result.refresh).toBe(true);
    expect(result.error).toContain('check it before trying again');
    expect(result.error).not.toContain('Response lost');
  });
});
