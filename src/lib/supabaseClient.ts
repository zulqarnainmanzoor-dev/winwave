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
          invite_code: string | null;
          inviter_code: string | null;
          main_balance: number | null;
          game_balance: number | null;
          total_bets: number | null;
          vip_level: number | null;
          is_agent: boolean | null;
          agent_id: string | null;
          manual_verification: boolean | null;
          referred_by: string | null;
          withdrawal_pin: string | null;
          bank_details: Json | null;
          wagering_required: number | null;
          wagering_completed: number | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id: string;
          phone_number?: string | null;
          invite_code?: string | null;
          inviter_code?: string | null;
          main_balance?: number | null;
          game_balance?: number | null;
          total_bets?: number | null;
          vip_level?: number | null;
          is_agent?: boolean | null;
          agent_id?: string | null;
          manual_verification?: boolean | null;
          referred_by?: string | null;
          withdrawal_pin?: string | null;
          bank_details?: Json | null;
          wagering_required?: number | null;
          wagering_completed?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          phone_number?: string | null;
          invite_code?: string | null;
          inviter_code?: string | null;
          main_balance?: number | null;
          game_balance?: number | null;
          total_bets?: number | null;
          vip_level?: number | null;
          is_agent?: boolean | null;
          agent_id?: string | null;
          manual_verification?: boolean | null;
          referred_by?: string | null;
          withdrawal_pin?: string | null;
          bank_details?: Json | null;
          wagering_required?: number | null;
          wagering_completed?: number | null;
        };
      };
      wallets: {
        Row: { id: string; user_id: string; main_balance: number | null; game_balance: number | null; created_at: string };
        Insert: { id?: string; user_id: string; main_balance?: number | null; game_balance?: number | null; created_at?: string };
        Update: { id?: string; user_id?: string; main_balance?: number | null; game_balance?: number | null };
      };
      transactions: {
        Row: { id: string; user_id: string; type: string; amount: number; status: string; gateway_ref: string | null; created_at: string };
        Insert: { id?: string; user_id: string; type: string; amount: number; status: string; gateway_ref?: string | null; created_at?: string };
        Update: { id?: string; user_id?: string; type?: string; amount?: number; status?: string; gateway_ref?: string | null };
      };
      withdraw_requests: {
        Row: { id: string; user_id: string; amount: number; bank_name: string; account_name: string; account_number: string; status: string; created_at: string };
        Insert: { id?: string; user_id: string; amount: number; bank_name: string; account_name: string; account_number: string; status?: string; created_at?: string };
        Update: { id?: string; user_id?: string; amount?: number; bank_name?: string; account_name?: string; account_number?: string; status?: string };
      };
      gift_codes: {
        Row: { id: string; code: string; amount: number; status: string; claimed_by: string | null; created_at: string; expires_at: string | null; admin_remarks: string | null };
        Insert: { id?: string; code: string; amount: number; status?: string; claimed_by?: string | null; created_at?: string; expires_at?: string | null; admin_remarks?: string | null };
        Update: { id?: string; code?: string; amount?: number; status?: string; claimed_by?: string | null; expires_at?: string | null; admin_remarks?: string | null };
      };
      betting_history: {
        Row: { id: string; user_id: string; amount: number; created_at: string };
        Insert: { id?: string; user_id: string; amount: number; created_at?: string };
        Update: { id?: string; user_id?: string; amount?: number };
      };
    };
  };
}

// ── Singleton guard ──────────────────────────────────────────────
// Prevents "Multiple GoTrueClient instances" warning when this
// module is imported from multiple files.
declare global {
  // eslint-disable-next-line no-var
  var __supabase_singleton__: SupabaseClient<Database> | undefined;
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
}

if (!globalThis.__supabase_singleton__) {
  globalThis.__supabase_singleton__ = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

export const supabase = globalThis.__supabase_singleton__;
