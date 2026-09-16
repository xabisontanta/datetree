import { describe, expect, it } from 'vitest';
import {
  latestNotificationStatusesByChannel,
  type NotificationStatusDTO,
} from './request-dto';

function notification(
  channel: NotificationStatusDTO['channel'],
  eventId: number,
  status: string,
): NotificationStatusDTO {
  return {
    request_id: '00000000-0000-4000-8000-000000000001',
    event_id: eventId,
    recipient_role: 'creator',
    channel,
    template_name: 'NEW_BOOKING_REQUEST',
    status,
    attempts: 1,
    updated_at: '2026-09-16T12:00:00.000Z',
  };
}

describe('notification status selection', () => {
  it('keeps the newest RPC row for each channel', () => {
    const statuses = [
      notification('email', 8, 'accepted'),
      notification('whatsapp', 8, 'retry_scheduled'),
      notification('email', 3, 'provider_not_configured'),
      notification('whatsapp', 3, 'provider_not_configured'),
    ];

    expect(latestNotificationStatusesByChannel(statuses)).toEqual([
      statuses[0],
      statuses[1],
    ]);
  });
});
