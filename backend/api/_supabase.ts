import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("SUPABASE_URL ya ANON_KEY missing hai!");
} else {
  console.log("Supabase connected to:", supabaseUrl);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);