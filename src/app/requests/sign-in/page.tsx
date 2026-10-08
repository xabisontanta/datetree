import { InboxSignIn } from '@/features/requester/inbox-sign-in';
import { safeAuthDestination } from '@/features/creators/auth-destination';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="dt-app dt-narrow">
      <h1>Your private requests</h1>
      <p>Verify your email. No creator profile or password is needed.</p>
      <InboxSignIn next={safeAuthDestination(next, '/requests')} />
    </main>
  );
}
