import { RequestDetail } from '@/features/booking/request-detail';
export const dynamic = 'force-dynamic';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ intent?: string }>;
}) {
  const { id } = await params;
  const { intent } = await searchParams;
  return <RequestDetail id={id} creator intent={intent} />;
}
