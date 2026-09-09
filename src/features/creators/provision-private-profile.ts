import type { SupabaseClient, User } from '@supabase/supabase-js';

import { E164_PHONE_PATTERN } from '@/features/creators/auth-schema';
import type { Database } from '@/lib/supabase/database.types';

function optionalConsentTimestamp(value: unknown, now: string) {
  return value === true ? now : null;
}

export async function provisionPrivateCreatorProfile(
  supabase: SupabaseClient<Database>,
  user: User,
) {
  const now = new Date().toISOString();
  const metadata = user.user_metadata;
  const whatsappNumber =
    typeof metadata.whatsapp_number === 'string' &&
    E164_PHONE_PATTERN.test(metadata.whatsapp_number)
      ? metadata.whatsapp_number
      : null;

  return supabase.from('profiles_private').upsert(
    {
      id: user.id,
      whatsapp_number: whatsappNumber,
      is_adult: metadata.is_adult === true,
      terms_accepted_at: optionalConsentTimestamp(metadata.terms_accepted, now),
      privacy_accepted_at: optionalConsentTimestamp(metadata.privacy_accepted, now),
      whatsapp_notifications_consent_at: optionalConsentTimestamp(
        metadata.whatsapp_notifications_consent,
        now,
      ),
      updated_at: now,
    },
    { onConflict: 'id' },
  );
}
