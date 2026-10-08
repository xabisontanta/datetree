import type { RequestInput } from '@/features/booking/request-schema';
import type { PublicService } from '@/features/creators/page-schema';

/** A different service must never inherit the previous service's brief or slot. */
export function freshServiceRequestDetails(service: Pick<PublicService, 'questions'>) {
  return {
    notes: '',
    answers: service.questions.map(() => ''),
    start: '',
    preferredDate: '',
  };
}

export type RequestSubmission = Omit<
  RequestInput,
  'adult' | 'consent' | 'contactSharingConsent'
> & {
  adult: boolean;
  consent: boolean;
  contactSharingConsent: boolean;
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
