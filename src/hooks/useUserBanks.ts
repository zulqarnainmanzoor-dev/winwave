import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type PaymentMethod = 'jazzcash' | 'easypaisa' | 'usdt';

export interface UserBank {
  id: string;
  user_id: string;
  method_type: PaymentMethod;
  account_name: string;
  account_number: string;
  remarks: string | null;
  is_active: boolean;
  created_at: string;
}

export interface BoundAccount {
  id: string;
  name: string;
  account: string;
  network?: string;
  remarks?: string;
}

export type BoundAccountsMap = {
  easypaisa: BoundAccount | null;
  jazzcash: BoundAccount | null;
  usdt: (BoundAccount & { network: string }) | null;
};

type MutationResult = { ok: boolean; error?: string };

export function mapBanksToBoundAccounts(banks: UserBank[]): BoundAccountsMap {
  const map: BoundAccountsMap = { easypaisa: null, jazzcash: null, usdt: null };
  for (const bank of banks) {
    if (!bank.is_active) continue;
    const base: BoundAccount = {
      id: bank.id,
      name: bank.account_name,
      account: bank.account_number,
      remarks: bank.remarks ?? undefined,
    };
    if (bank.method_type === 'usdt') {
      map.usdt = { ...base, network: 'TRC20' };
    } else if (bank.method_type === 'jazzcash' || bank.method_type === 'easypaisa') {
      map[bank.method_type] = base;
    }
  }
  return map;
}

/**
 * Loads and mutates the current user's saved withdrawal accounts from the
 * `user_banks` table. All queries are scoped to the authenticated user id so
 * they remain correct under Row Level Security.
 */
export function useUserBanks(userId: string) {
  const [banks, setBanks] = useState<UserBank[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBanks = useCallback(async () => {
    if (!userId) {
      setBanks([]);
      return;
    }
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('user_banks')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setBanks([]);
    } else {
      setError(null);
      setBanks((data as UserBank[]) ?? []);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchBanks();
  }, [fetchBanks]);

  const addBank = useCallback(
    async (input: {
      method_type: PaymentMethod;
      account_name: string;
      account_number: string;
      remarks?: string;
    }): Promise<MutationResult> => {
      if (!userId) return { ok: false, error: 'You must be logged in to add an account.' };

      const { error: insertError } = await supabase.from('user_banks').insert({
        user_id: userId,
        method_type: input.method_type,
        account_name: input.account_name,
        account_number: input.account_number,
        remarks: input.remarks ?? null,
        is_active: true,
      });

      if (insertError) {
        const message =
          (insertError as { code?: string }).code === '23505'
            ? 'This account number is already registered.'
            : insertError.message;
        return { ok: false, error: message };
      }

      await fetchBanks();
      return { ok: true };
    },
    [userId, fetchBanks]
  );

  const removeBank = useCallback(
    async (id: string): Promise<MutationResult> => {
      if (!userId) return { ok: false, error: 'You must be logged in to remove an account.' };

      const { error: deleteError } = await supabase
        .from('user_banks')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (deleteError) return { ok: false, error: deleteError.message };

      await fetchBanks();
      return { ok: true };
    },
    [userId, fetchBanks]
  );

  return {
    banks,
    boundAccounts: mapBanksToBoundAccounts(banks),
    loading,
    error,
    addBank,
    removeBank,
    refetch: fetchBanks,
  };
}
