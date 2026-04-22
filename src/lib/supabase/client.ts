import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

/**
 * Browser Supabase client — uses @supabase/ssr's createBrowserClient
 * which stores the session in cookies (not localStorage), so the
 * middleware and server components can read the same session.
 */
export const supabase = createBrowserClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
