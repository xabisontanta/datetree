import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { publicPageSchema, usernameSchema } from '@/features/creators/page-schema';
import { ServiceRequest } from '@/features/requester/service-request';
export const dynamic = 'force-dynamic';
type Props = {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ service?: string }>;
};
async function loadPage(username: string) {
  const slug = usernameSchema.safeParse(username);
  if (!slug.success) return null;
  const db = await createClient();
  const { data, error } = await db
    .from('profiles_public')
    .select('document')
    .eq('username', slug.data)
    .eq('is_published', true)
    .maybeSingle();
  if (error) throw new Error('Unable to load this profile. Please try again.');
  const parsed = publicPageSchema.safeParse(data?.document);
  return parsed.success ? parsed.data : null;
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await loadPage((await params).username);
  if (!page) return { title: 'Page unavailable', robots: { index: false } };
  return {
    title: page.profile.displayName,
    description: page.profile.tagline || page.profile.bio,
    alternates: { canonical: `/${page.profile.username}` },
    openGraph: {
      title: page.profile.displayName,
      description: page.profile.tagline || page.profile.bio,
      type: 'profile',
    },
  };
}
export default async function CreatorPublicPage({ params, searchParams }: Props) {
  const page = await loadPage((await params).username);
  if (!page) notFound();
  const db = await createClient();
  const { data } = await db.auth.getUser();
  return (
    <main className="dt-public-shell">
      <ServiceRequest
        page={page}
        verified={Boolean(data.user?.email_confirmed_at)}
        initialService={(await searchParams).service}
      />
    </main>
  );
}
