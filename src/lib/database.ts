import { supabase, Database } from './supabaseClient';

// ============================================
// Standardized Supabase Fetch Functions
// ============================================

// --- Profiles ---
export async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('id, phone_number, invite_code, inviter_code, main_balance, game_balance, total_bets, vip_level, is_agent, agent_id, manual_verification, referred_by, withdrawal_pin, bank_details, created_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) console.error('fetchProfile error:', error);
  return { data, error };
}

export async function updateProfile(userId: string, updates: Partial<Database['public']['Tables']['users']['Update']>) {
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()
    .maybeSingle();
  if (error) console.error('updateProfile error:', error);
  return { data, error };
}

// --- Wallets ---
export async function fetchWallet(userId: string) {
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) console.error('fetchWallet error:', error);
  return { data, error };
}

export async function updateWalletBalance(userId: string, newBalance: number) {
  const { data, error } = await supabase
    .from('wallets')
    .update({ main_balance: newBalance })
    .eq('user_id', userId)
    .select()
    .maybeSingle();
  if (error) console.error('updateWalletBalance error:', error);
  return { data, error };
}

// --- Transactions ---
export async function fetchTransactions(userId: string, limit = 50) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) console.error('fetchTransactions error:', error);
  return { data: data || [], error };
}

export async function insertTransaction(tx: Database['public']['Tables']['transactions']['Insert']) {
  const { data, error } = await supabase
    .from('transactions')
    .insert([{ ...tx, created_at: new Date().toISOString() }])
    .select()
    .maybeSingle();
  if (error) console.error('insertTransaction error:', error);
  return { data, error };
}

// --- User Banks ---
export async function fetchUserBanks(userId: string) {
  const { data, error } = await supabase
    .from('user_banks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) console.error('fetchUserBanks error:', error);
  return { data: data || [], error };
}

export async function upsertUserBank(bank: Database['public']['Tables']['user_banks']['Insert']) {
  const { data, error } = await supabase
    .from('user_banks')
    .upsert(bank, { onConflict: 'user_id,account_number' })
    .select()
    .maybeSingle();
  if (error) console.error('upsertUserBank error:', error);
  return { data, error };
}

// --- Withdraw Requests ---
export async function fetchWithdrawRequests(userId: string, limit = 50) {
  const { data, error } = await supabase
    .from('withdraw_requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) console.error('fetchWithdrawRequests error:', error);
  return { data: data || [], error };
}

export async function createWithdrawRequest(request: Omit<Database['public']['Tables']['withdraw_requests']['Insert'], 'status' | 'created_at'>) {
  const { data, error } = await supabase
    .from('withdraw_requests')
    .insert([{
      ...request,
      status: 'pending',
      created_at: new Date().toISOString(),
    }])
    .select()
    .maybeSingle();
  if (error) console.error('createWithdrawRequest error:', error);
  return { data, error };
}

// --- Referrals ---
export async function fetchReferralCount(userId: string) {
  const { count, error } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('referred_by', userId);

  if (error) console.error('fetchReferralCount error:', error);
  return { count: count || 0, error };
}