import { createClient } from '@supabase/supabase-js';

// Vercel/Production mein variables milne ke liye direct hardcode kar do
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ealtebiutcnaobjopvht.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhbHRlYml1dGNuYW9iam9wdmh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NTIwMDgsImV4cCI6MjA5ODIyODAwOH0.A4xoJuKC8AbcFro0_yvPZXpDFFXnoEQjJo9Q_lqejuQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);