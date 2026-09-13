import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cblbvsvftltothhrzehw.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_1wMh7c9tkiD3NgM_BYLLQg_KOxX46za';

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
