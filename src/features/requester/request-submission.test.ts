import { describe, expect, it } from 'vitest';
import {
  isAmbiguousSubmissionResult,
  retainRequestSubmission,
  type RequestSubmission,
} from './request-submission';

function draft(): RequestSubmission {
  return {
    serviceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    idempotencyKey: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    serviceSnapshot: {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Coaching session',
      description: 'A test consultation',
      kind: 'scheduled',
      active: true,
      image: '',
      pricing: 'free',
      amount: 0,
      currency: 'ZAR',
      duration: 30,
      mode: 'online',
      location: '',
      turnaround: 7,
      capacity: 5,
      instructions: '',
      questions: [{ label: 'What is your goal?', required: true }],
    },
    name: 'Test requester',
    notes: 'Original notes',
    answers: ['Original answer'],
    start: '2026-10-01T10:00:00Z',
    preferredDate: '',
    timezone: 'Africa/Johannesburg',
    adult: true,
    consent: true,
  };
}

describe('ambiguous request retries', () => {
  it('snapshots the complete first attempt without retaining mutable draft data', () => {
    const original = draft();
    const pending = retainRequestSubmission(null, original);
    expect(pending).toEqual(original);
    expect(pending).not.toBe(original);

    original.notes = 'Edited notes';
    original.answers[0] = 'Edited answer';
    original.serviceSnapshot.questions[0]!.label = 'Edited question';
    expect(pending.notes).toBe('Original notes');
    expect(pending.answers).toEqual(['Original answer']);
    expect(pending.serviceSnapshot.questions[0]!.label).toBe('What is your goal?');
  });

  it('reuses the original key and exact payload even if a new draft is supplied', () => {
    const pending = retainRequestSubmission(null, draft());
    const edited = draft();
    edited.idempotencyKey = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    edited.serviceId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    edited.name = 'Changed name';
    edited.notes = 'Changed notes';
    edited.start = '2026-10-02T10:00:00Z';
    edited.timezone = 'Pacific/Honolulu';

    const retry = retainRequestSubmission(pending, edited);
    expect(retry).toBe(pending);
    expect(JSON.stringify(retry)).toBe(JSON.stringify(draft()));
  });

  it.each([
    { error: 'Could not send your request. Please retry.', id: '' },
    { error: '', id: '' },
  ])('keeps pending data when no definitive result is available: %j', (result) => {
    expect(isAmbiguousSubmissionResult(result)).toBe(true);
  });

  it.each([
    { error: '', id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' },
    { error: 'Check your name, answers, and consent.', id: '' },
    { error: 'Verify your email before submitting.', id: '' },
    { error: 'That time is no longer available.', id: '' },
  ])('unlocks editing after a definitive success or rejection: %j', (result) => {
    expect(isAmbiguousSubmissionResult(result)).toBe(false);
  });
});
