import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

/**
 * Best-effort downstream delivery. The request transaction has already committed;
 * a provider or network failure must never undo the user's booking action.
 */
export async function dispatchRequestNotifications(
  supabase: SupabaseClient<Database>,
  requestId: string,
) {
  try {
    const { data, error } = await supabase.functions.invoke('dt-notification-worker', {
      body: { requestId },
    });
    if (error) return 'failed' as const;
    if ((data as { providerConfigured?: boolean } | null)?.providerConfigured === false)
      return 'not-configured' as const;
    return 'processed' as const;
  } catch {
    return 'failed' as const;
  }
}
