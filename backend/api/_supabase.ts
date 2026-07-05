import { createClient } from '@supabase/supabase-js';

// NEW Supabase database credentials
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://stsemiuoqwfowgbbnjhu.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0c2VtaXVvcXdmb3dnYmJuamh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMjQwNjQsImV4cCI6MjA5ODgwMDA2NH0.z3FcP0V28aiYYalHWeSSt66Rx0BB-ptrX8NcmCSLiDM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);