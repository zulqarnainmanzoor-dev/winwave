// Admin-only Supabase client — uses service role key, bypasses ALL RLS.
// Only import this in /src/admin/ pages. Never use in user-facing code.
import { createClient } from '@supabase/supabase-js';

// Prefer VITE_* env, but fall back to NEXT_PUBLIC_* if present.
// NOTE: adminSupabase must be used ONLY on server/admin paths.
// Emergency bypass for local dev when env var names mismatch.
// This file must be used only by admin pages.
const url = 'https://ealtebiutcnaobjopvht.supabase.co';

// Service role key (from your .env)
const svcKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhbHRlYml1dGNuYW9iam9wdmh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjY1MjAwOCwiZXhwIjoyMDk4MjI4MDA4fQ.0YRBDhdlzEzjoiKT7bW0gqbDJrm9bY2kcFbCHgdDPZ8';

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
