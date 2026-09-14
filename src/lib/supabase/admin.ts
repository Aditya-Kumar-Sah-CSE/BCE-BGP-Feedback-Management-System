import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Creates an admin client with service_role privileges if SUPABASE_SERVICE_ROLE_KEY is set.
 * Returns null if the service role key is not configured, allowing safe fallback to the user session client.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cblbvsvftltothhrzehw.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!serviceKey) {
    return null;
  }

  return createSupabaseClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
