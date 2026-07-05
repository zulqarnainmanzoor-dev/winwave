/// <reference types="vite/client" />
import { createClient, SupabaseClient } from '@supabase/supabase-js';

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type GenericTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: Array<Record<string, unknown>>;
};

type GenericFunction = {
  Args: Record<string, unknown>;
  Returns: unknown;
  SetofOptions?: Record<string, unknown>;
};

export interface Database {
  public: {
    Tables: Record<string, GenericTable>;
    Views: Record<string, GenericTable>;
    Functions: Record<string, GenericFunction>;
    Enums: Record<string, unknown>;
  };
}

// ── Singleton guard ──────────────────────────────────────────────
// Prevents "Multiple GoTrueClient instances" warning when this
// module is imported from multiple files.
declare global {
  // eslint-disable-next-line no-var
  var __supabase_singleton__: SupabaseClient<any> | undefined;
}

// Prefer VITE_* (existing app expectation), but fall back to NEXT_PUBLIC_*
// because your .env currently contains NEXT_PUBLIC_SUPABASE_*.
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase URL/Anon key. Set VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY) in .env');
}


if (!globalThis.__supabase_singleton__) {
  globalThis.__supabase_singleton__ = createClient<any>(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

export const supabase = globalThis.__supabase_singleton__!;
