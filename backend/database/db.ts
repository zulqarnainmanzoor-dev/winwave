import 'dotenv/config';
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

// Define the interface for our Database (Optional but recommended for type safety)
export interface Database {
  public: {
    Tables: Record<string, GenericTable>;
    Views: Record<string, GenericTable>;
    Functions: Record<string, GenericFunction>;
    Enums: Record<string, unknown>;
  };
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const supabaseKey = supabaseServiceRoleKey || supabaseAnonKey;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase backend client created without URL or key. Set SUPABASE_URL or VITE_SUPABASE_URL, and a valid SERVICE_ROLE_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, or VITE_SUPABASE_ANON_KEY.');
}

export const supabase: SupabaseClient<any> = createClient<any>(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
  },
});

const supabaseAdminKey = supabaseServiceRoleKey || '';
if (!supabaseAdminKey) {
  console.warn('Supabase admin client is missing a service role key; server-side writes may be blocked by RLS.');
}

export const supabaseAdmin: SupabaseClient<any> = createClient<any>(supabaseUrl, supabaseAdminKey, {
  auth: {
    persistSession: false,
  },
});

export const isServiceRoleKey = () => Boolean(
  supabaseServiceRoleKey && supabaseServiceRoleKey.length > 0
);
   