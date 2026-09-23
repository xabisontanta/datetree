import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { groupNotificationStatuses } from '@/features/booking/request-dto';

describe('request inbox server/client boundary', () => {
  it('serializes empty and populated notifications with the real React renderer', () => {
    // React's server entry requires its own Node condition, unlike the test runner.
    const script = `
      import { renderToPipeableStream } from 'react-server-dom-webpack/server.node';
      import { Writable } from 'node:stream';
      const group = ${groupNotificationStatuses.toString()};
      const errors = [];
      const rows = [{
        request_id: '00000000-0000-4000-8000-000000000001',
        event_id: 1, recipient_role: 'creator', channel: 'email',
        template_name: 'NEW_BOOKING_REQUEST', status: 'queued', attempts: 0,
        updated_at: '2026-09-23T12:00:00.000Z'
      }];
      for (const notifications of [group([]), group(rows)]) {
        const stream = renderToPipeableStream({ notifications }, {}, {
          onError(error) { errors.push(error.message); }
        });
        await new Promise((resolve, reject) => {
          stream.pipe(new Writable({ write(chunk, encoding, done) { done(); } }))
            .on('finish', resolve).on('error', reject);
        });
      }
      process.stdout.write(JSON.stringify(errors));
    `;
    const result = execFileSync(
      process.execPath,
      ['--conditions=react-server', '--input-type=module', '-e', script],
      { encoding: 'utf8', timeout: 10_000 },
    );
    expect(JSON.parse(result)).toEqual([]);
  });
});
