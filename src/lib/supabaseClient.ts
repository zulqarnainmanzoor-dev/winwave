/// <reference types="vite/client" />
import { createClient, SupabaseClient } from '@supabase/supabase-js';

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          phone_number: string | null;
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
          created_at: string;
        };
        Insert: {
          id: string;
          phone_number?: string | null;
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
          created_at?: string;
        };
        Update: {
          id?: string;
          phone_number?: string | null;
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
      transactions: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          amount: number;
          status: string;
          gateway_ref: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          amount: number;
          status: string;
          gateway_ref?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          amount?: number;
          status?: string;
          gateway_ref?: string | null;
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
      withdraw_requests: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          bank_name: string;
          account_name: string;
          account_number: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount: number;
          bank_name: string;
          account_name: string;
          account_number: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          amount?: number;
          bank_name?: string;
          account_name?: string;
          account_number?: string;
          status?: string;
          created_at?: string;
        };
      };
      gift_codes: {
        Row: {
          id: string;
          code: string;
          amount: number;
          status: string; // active | paused | claimed | deleted
          claimed_by: string | null;
          created_at: string;
          expires_at: string | null;
          admin_remarks: string | null;
        };
        Insert: {
          id?: string;
          code: string;
          amount: number;
          status?: string;
          claimed_by?: string | null;
          created_at?: string;
          expires_at?: string | null;
          admin_remarks?: string | null;
        };
        Update: {
          id?: string;
          code?: string;
          amount?: number;
          status?: string;
          claimed_by?: string | null;
          created_at?: string;
          expires_at?: string | null;
          admin_remarks?: string | null;
        };
      };
      betting_history: {
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
    };
  };
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.'
  );
}

export const supabase: SupabaseClient<Database> = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
