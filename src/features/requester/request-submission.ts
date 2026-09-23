import type { RequestInput } from '@/features/booking/request-schema';

export type RequestSubmission = Omit<RequestInput, 'adult' | 'consent'> & {
  adult: boolean;
  consent: boolean;
};

/** A retry must use the same key AND data as the attempt whose result was lost. */
export function retainRequestSubmission(
  pending: RequestSubmission | null,
  draft: RequestSubmission,
): RequestSubmission {
  return pending ?? structuredClone(draft);
}

export function isAmbiguousSubmissionResult(result: { error: string; id: string }) {
  // The action uses this generic message for transport/non-domain RPC errors.
  // Named validation and business-rule rejections cannot have committed a request.
  return (
    !result.id &&
    (!result.error || result.error === 'Could not send your request. Please retry.')
  );
}
