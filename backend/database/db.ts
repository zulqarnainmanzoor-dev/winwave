import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Define the interface for our Database (Optional but recommended for type safety)
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          phone_number: string | null;
          email: string | null;
          main_balance: number | null;
          game_balance: number | null;
          wagering_required: number | null;
          total_bets: number | null;
          vip_level: number | null;
          invite_code: string | null;
          referred_by: string | null;
          withdrawal_pin: string | null;
          wallet_details: Json | null;
          bank_details: Json | null;
          wagered_amount: number | null;
          referral_code: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          phone_number?: string | null;
          email?: string | null;
          main_balance?: number | null;
          game_balance?: number | null;
          wagering_required?: number | null;
          total_bets?: number | null;
          vip_level?: number | null;
          invite_code?: string | null;
          referred_by?: string | null;
          withdrawal_pin?: string | null;
          wallet_details?: Json | null;
          bank_details?: Json | null;
          wagered_amount?: number | null;
          referral_code?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          phone_number?: string | null;
          email?: string | null;
          main_balance?: number | null;
          game_balance?: number | null;
          wagering_required?: number | null;
          total_bets?: number | null;
          vip_level?: number | null;
          invite_code?: string | null;
          referred_by?: string | null;
          withdrawal_pin?: string | null;
          wallet_details?: Json | null;
          bank_details?: Json | null;
          wagered_amount?: number | null;
          referral_code?: string | null;
          created_at?: string;
        };
      };
      wallets: {
        Row: {
          id: string;
          user_id: string;
          main_balance: number | null;
          game_balance: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          main_balance?: number | null;
          game_balance?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          main_balance?: number | null;
          game_balance?: number | null;
          created_at?: string;
        };
      };
      registration_attempts: {
        Row: {
          id: string;
          ip: string;
          phone_number: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          ip: string;
          phone_number: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          ip?: string;
          phone_number?: string;
          created_at?: string;
        };
      };
      security_events: {
        Row: {
          id: string;
          event_type: string;
          phone_number: string;
          ip: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_type: string;
          phone_number: string;
          ip?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_type?: string;
          phone_number?: string;
          ip?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          amount: number;
          status: string;
          gateway_ref: string | null;
          bonus: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          amount: number;
          status: string;
          gateway_ref?: string | null;
          bonus?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          amount?: number;
          status?: string;
          gateway_ref?: string | null;
          bonus?: number | null;
          created_at?: string;
        };
      };
      game_rounds: {
        Row: {
          id: string;
          game_type: string;
          status: string;
          started_at: string | null;
          ends_at: string | null;
          result_size: string | null;
          forced_outcome: string | null;
          total_big: number | null;
          total_small: number | null;
        };
        Insert: {
          id?: string;
          game_type: string;
          status?: string;
          started_at?: string | null;
          ends_at?: string | null;
          result_size?: string | null;
          forced_outcome?: string | null;
          total_big?: number | null;
          total_small?: number | null;
        };
        Update: {
          id?: string;
          game_type?: string;
          status?: string;
          started_at?: string | null;
          ends_at?: string | null;
          result_size?: string | null;
          forced_outcome?: string | null;
          total_big?: number | null;
          total_small?: number | null;
        };
      };
      bets: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          amount?: number;
          created_at?: string;
        };
      };
      withdraw_requests: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          account_number: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount: number;
          account_number: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          amount?: number;
          account_number?: string;
          status?: string;
          created_at?: string;
        };
      };
      user_banks: {
        Row: {
          id: string;
          user_id: string;
          bank_name: string;
          account_name: string;
          account_number: string;
          ifsc_code: string | null;
          upi_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          bank_name: string;
          account_name: string;
          account_number: string;
          ifsc_code?: string | null;
          upi_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          bank_name?: string;
          account_name?: string;
          account_number?: string;
          ifsc_code?: string | null;
          upi_id?: string | null;
          created_at?: string;
        };
      };
    };
  };
}

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const supabaseKey = supabaseServiceRoleKey || supabaseAnonKey;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase backend client created without URL or key. Set SUPABASE_URL or VITE_SUPABASE_URL, and a valid SERVICE_ROLE_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, or VITE_SUPABASE_ANON_KEY.');
}

export const supabase: SupabaseClient<Database> = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
  },
});

const supabaseAdminKey = supabaseServiceRoleKey || '';
if (!supabaseAdminKey) {
  console.warn('Supabase admin client is missing a service role key; server-side writes may be blocked by RLS.');
}

export const supabaseAdmin: SupabaseClient<Database> = createClient<Database>(supabaseUrl, supabaseAdminKey, {
  auth: {
    persistSession: false,
  },
});

export const isServiceRoleKey = () => Boolean(
  supabaseServiceRoleKey && supabaseServiceRoleKey.length > 0
);
   