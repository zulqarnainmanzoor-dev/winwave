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

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseKey = supabaseServiceRoleKey || supabaseAnonKey;

console.log('[DB Init] Supabase URL:', supabaseUrl ? 'SET' : 'MISSING');
console.log('[DB Init] Service Role Key:', supabaseServiceRoleKey ? 'SET' : 'MISSING');
console.log('[DB Init] Anon Key:', supabaseAnonKey ? 'SET' : 'MISSING');

if (!supabaseUrl || !supabaseKey) {
  console.error('[DB Init] ERROR: Missing Supabase configuration!');
  console.error('[DB Init] URL:', supabaseUrl ? 'OK' : 'MISSING');
  console.error('[DB Init] Key:', supabaseKey ? 'OK' : 'MISSING');
}

export const supabase: SupabaseClient<any> = createClient<any>(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
  },
});

const supabaseAdminKey = supabaseServiceRoleKey || '';
if (!supabaseAdminKey) {
  console.error('[DB Init] ERROR: Missing service role key for admin client');
}

export const supabaseAdmin: SupabaseClient<any> = createClient<any>(supabaseUrl, supabaseAdminKey, {
  auth: {
    persistSession: false,
  },
});

export const isServiceRoleKey = () => Boolean(
  supabaseServiceRoleKey && supabaseServiceRoleKey.length > 0
);
   