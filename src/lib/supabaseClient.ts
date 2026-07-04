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
          total_deposit: number | null;
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
        Row: { 
          id: string; 
          user_id: string; 
          type: string; 
          amount: number; 
          bonus: number | null;
          status: string; 
          gateway_ref: string | null; 
          created_at: string 
        };
        Insert: { 
          id?: string; 
          user_id: string; 
          type: string; 
          amount: number; 
          bonus?: number | null;
          status: string; 
          gateway_ref?: string | null; 
          created_at?: string 
        };
        Update: { 
          id?: string; 
          user_id?: string; 
          type?: string; 
          amount?: number; 
          bonus?: number | null;
          status?: string; 
          gateway_ref?: string | null 
        };
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
        Update: { user_id?: string; amount?: number };
      };
      gift_code_claims: {
        Row: { id: string; user_id: string; gift_code: string; amount: number; created_at: string };
        Insert: { id?: string; user_id: string; gift_code: string; amount: number; created_at?: string };
        Update: { id?: string; user_id?: string; gift_code?: string; amount?: number };
      };
      deposit_history: {
        Row: { 
          id: string; 
          user_id: string; 
          amount: number; 
          status: string; 
          gateway_ref: string | null; 
          order_id: string | null;
          method: string | null;
          remarks: string | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: { 
          id?: string; 
          user_id: string; 
          amount: number; 
          status?: string; 
          gateway_ref?: string | null; 
          order_id?: string | null;
          method?: string | null;
          remarks?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: { 
          id?: string; 
          user_id?: string; 
          amount?: number; 
          status?: string; 
          gateway_ref?: string | null;
          order_id?: string | null;
          method?: string | null;
          remarks?: string | null;
          updated_at?: string | null;
        };
      };
      withdrawal_history: {
        Row: { id: string; user_id: string; amount: number; method: string; account_number: string; account_name: string; status: string; gateway_ref: string | null; created_at: string };
        Insert: { id?: string; user_id: string; amount: number; method?: string; account_number?: string; account_name?: string; status?: string; gateway_ref?: string | null; created_at?: string };
        Update: { id?: string; user_id?: string; amount?: number; status?: string; gateway_ref?: string | null };
      };
      referral_commissions: {
        Row: { id: string; user_id: string; amount: number; created_at: string };
        Insert: { id?: string; user_id: string; amount: number; created_at?: string };
        Update: { id?: string; user_id?: string; amount?: number };
      };
      registration_attempts: {
        Row: { id: string; ip: string; phone_number: string; created_at: string };
        Insert: { id?: string; ip: string; phone_number: string; created_at?: string };
        Update: { id?: string; ip?: string; phone_number?: string };
      };
      platform_settings: {
        Row: { id: string; platform_name: string; platform_margin_target: number; game_control_enabled: boolean; smart_risk_default: boolean; notifications_enabled: boolean; auto_approve_deposit: boolean; created_at: string };
        Insert: { id?: string; platform_name?: string; platform_margin_target?: number; game_control_enabled?: boolean; smart_risk_default?: boolean; notifications_enabled?: boolean; auto_approve_deposit?: boolean; created_at?: string };
        Update: { id?: string; platform_name?: string; platform_margin_target?: number; game_control_enabled?: boolean; smart_risk_default?: boolean; notifications_enabled?: boolean; auto_approve_deposit?: boolean };
      };
      game_rounds: {
        Row: { id: string; game_type: string; round_number: number; start_time: string; end_time: string; result: string | null; status: string; target_result: string | null; total_big: number; total_small: number; created_at: string };
        Insert: { id?: string; game_type?: string; round_number?: number; start_time?: string; end_time?: string; result?: string | null; status?: string; target_result?: string | null; total_big?: number; total_small?: number; created_at?: string };
        Update: { id?: string; game_type?: string; round_number?: number; start_time?: string; end_time?: string; result?: string | null; status?: string; target_result?: string | null; total_big?: number; total_small?: number };
      };
      user_banks: {
        Row: { id: string; user_id: string; bank_name: string; account_name: string; account_number: string; created_at: string };
        Insert: { id?: string; user_id: string; bank_name?: string; account_name?: string; account_number?: string; created_at?: string };
        Update: { id?: string; user_id?: string; bank_name?: string; account_name?: string; account_number?: string };
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
  globalThis.__supabase_singleton__ = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

export const supabase = globalThis.__supabase_singleton__;
