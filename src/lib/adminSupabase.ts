// Admin-only Supabase client — uses service role key, bypasses ALL RLS.
// Only import this in /src/admin/ pages. Never use in user-facing code.
import { createClient } from '@supabase/supabase-js';

const url     = import.meta.env.VITE_SUPABASE_URL as string;
const svcKey  = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY as string;

if (!url || !svcKey) {
  console.error('[adminSupabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY');
}

declare global { var __supabase_admin__: ReturnType<typeof createClient> | undefined; }

if (!globalThis.__supabase_admin__) {
  globalThis.__supabase_admin__ = createClient(url, svcKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const adminSupabase = globalThis.__supabase_admin__!;
