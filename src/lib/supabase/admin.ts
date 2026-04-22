import { createClient } from "@supabase/supabase-js";

/**
 * Supabase admin client using service role key.
 * Bypasses RLS — only use server-side in trusted contexts.
 * Never expose to the browser.
 */
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
