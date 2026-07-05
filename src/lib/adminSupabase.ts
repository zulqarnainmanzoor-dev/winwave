// Admin-only Supabase client — uses service role key, bypasses ALL RLS.
// Only import this in /src/admin/ pages. Never use in user-facing code.
import { createClient } from '@supabase/supabase-js';

// Must point to the SAME project as VITE_SUPABASE_URL in .env
const url =
  import.meta.env.VITE_SUPABASE_URL ??
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL;

const svcKey =
  import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY ??
  import.meta.env.SERVICE_ROLE_KEY ??
  import.meta.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!url || !svcKey) {
  console.error('[adminSupabase] Missing Supabase admin URL/service role key');
}



declare global { var __supabase_admin__: ReturnType<typeof createClient> | undefined; }

if (!globalThis.__supabase_admin__) {
  globalThis.__supabase_admin__ = createClient(url, svcKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const adminSupabase = globalThis.__supabase_admin__!;
