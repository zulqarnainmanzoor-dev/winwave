import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { adminSupabase } from '../lib/adminSupabase';

export interface BankDetails {
  easypaisa: { name: string; account: string; remarks: string; } | null;
  jazzcash: { name: string; account: string; remarks: string; } | null;
}

export interface UserProfileSchema {
  id: string;
  uid?: string;
  invite_code?: string;
  referral_code?: string;
  phone_number?: string;
  phone?: string;
  main_balance: number;
  game_balance: number;
  wallet_balance?: number;
  wagering_required: number;
  wagering_completed: number;
  withdrawal_pin?: string;
  referral_count?: number;
  total_invitees?: number;
  bank_details?: BankDetails;
  amount?: number;
}

interface UserContextType {
  username: string;
  setUsername: (username: string) => void;
  avatar: string;
  setAvatar: (avatar: string) => void;
  uid: string;
  phoneNumber: string;
  setPhoneNumber: (phone: string) => void;
  lastLogin: string;
  balance: number;
  setBalance: (balance: number) => void;
  mainWalletBalance: number;
  thirdPartyWalletBalance: number;
  totalBalance: number;
  transferWallet: (direction: 'to-game' | 'to-main', amount: number) => boolean;
  setThirdPartyWalletBalance: (balance: number) => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  musicEnabled: boolean;
  setMusicEnabled: (enabled: boolean) => void;
  wageringRequired: number;
  setWageringRequired: (wagering: number) => void;
  wageringCompleted: number;
  setWageringCompleted: (wagering: number) => void;
  addWageringProgress: (amount: number) => void;
  addDepositWithBonus: (deposit: number, bonus: number) => void;
  referralCode: string;
  setReferralCode: (code: string) => void;
  referralCount: number;
  totalCommissions: number;
  setTotalCommissions: (amount: number) => void;
  claimedDailyBonus: boolean;
  setClaimedDailyBonus: (v: boolean) => void;
  dailyWagerProgress: number;
  addDailyWagerProgress: (amount: number) => void;
  cumulativeWager: number;
  setCumulativeWager: (wager: number) => void;
  addCumulativeWager: (amount: number) => void;
  vipLevel: number;
  vipProgress: number;
  refreshUserData: () => Promise<void>;
  isLoggedIn: boolean;
  setIsLoggedIn: (v: boolean) => void;
  login: (
    phoneNumber: string,
    userId?: string,
    profile?: { referral_code?: string; phone_number?: string; vip_level?: number; wagered_amount?: number },
    wallet?: { main_balance?: number; wagering_required?: number }
  ) => Promise<void>;
  logout: () => void;
  selectedPaymentMethod: 'jazzcash' | 'easypaisa';
  setSelectedPaymentMethod: (method: 'jazzcash' | 'easypaisa') => void;
  withdrawalPassword: string;
  setWithdrawalPassword: (pin: string) => void;
  boundAccounts: {
    easypaisa: { name: string; account: string; remarks?: string } | null;
    jazzcash: { name: string; account: string; remarks?: string } | null;
  };
  setBoundAccounts: (accounts: any) => void;
  registerUser: (phone: string, password: string, inviteCode?: string) => Promise<{ success: boolean; error?: string }>;
  fetchReferrals: () => Promise<Array<{ id: string; phone: string; joined_at: string }>>;
  fetchTotalCommissions: () => Promise<number>;
  submitWithdrawal: (params: {
    amount: number;
    method: 'jazzcash' | 'easypaisa';
    accountName: string;
    accountNumber: string;
    remarks?: string;
  }) => Promise<{ success: boolean; error?: string }>;
}

export interface VipTier {
  level: number;
  requiredWager: number;
  maintenance: number;
  weeklyReward: number;
  monthlyReward: number;
  levelUpReward: number;
}

export const VIP_TIERS: VipTier[] = [
  { level: 0, requiredWager: 125000, maintenance: 0, weeklyReward: 0, monthlyReward: 0, levelUpReward: 0 },
  { level: 1, requiredWager: 250000, maintenance: 62500, weeklyReward: 10, monthlyReward: 150, levelUpReward: 150 },
  { level: 2, requiredWager: 500000, maintenance: 112500, weeklyReward: 20, monthlyReward: 350, levelUpReward: 150 },
  { level: 3, requiredWager: 1000000, maintenance: 225000, weeklyReward: 30, monthlyReward: 750, levelUpReward: 300 },
  { level: 4, requiredWager: 5000000, maintenance: 2250000, weeklyReward: 100, monthlyReward: 7500, levelUpReward: 3000 },
  { level: 5, requiredWager: 10000000, maintenance: 22500000, weeklyReward: 300, monthlyReward: 75000, levelUpReward: 30000 },
  { level: 6, requiredWager: 50000000, maintenance: 75000000, weeklyReward: 1000, monthlyReward: 150000, levelUpReward: 90000 },
  { level: 7, requiredWager: 100000000, maintenance: 150000000, weeklyReward: 3000, monthlyReward: 300000, levelUpReward: 180000 },
  { level: 8, requiredWager: 500000000, maintenance: 1500000000, weeklyReward: 10000, monthlyReward: 750000, levelUpReward: 1800000 },
  { level: 9, requiredWager: 1000000000, maintenance: 7500000000, weeklyReward: 30000, monthlyReward: 4500000, levelUpReward: 9000000 },
  { level: 10, requiredWager: 1000000000, maintenance: 15000000000, weeklyReward: 50000, monthlyReward: 15000000, levelUpReward: 18000000 },
];

export const PAYMENT_LIMITS = {
  easypaisa: { min: 500, max: 50_000, dailyMax: 3 },
  jazzcash: { min: 500, max: 50_000, dailyMax: 3 },
} as const;

export type PaymentMethod = keyof typeof PAYMENT_LIMITS;

export function formatDisplayUid(uid: string): string {
  if (!uid) return '------';
  return uid.replace(/-/g, '').slice(0, 8).toUpperCase();
}

export type ProfileRow = {
  invite_code?: string | null;
  phone_number?: string | null;
  vip_level?: number | null;
  total_bets?: number | null;
};

export function computeVipProgress(vipLevel: number, wageredAmount: number): number {
  const currentTier = VIP_TIERS[vipLevel] || VIP_TIERS[0];
  const experiencePoints = wageredAmount / 100;
  const requiredExp = currentTier.requiredWager / 100;
  if (requiredExp <= 0) return 0;
  return Math.min(100, (experiencePoints / requiredExp) * 100);
}

export function getVipLevelFromWager(wager: number): number {
  if (wager < 125000) return 0;
  if (wager < 250000) return 1;
  if (wager < 500000) return 2;
  if (wager < 1000000) return 3;
  if (wager < 5000000) return 4;
  if (wager < 10000000) return 5;
  if (wager < 50000000) return 6;
  if (wager < 100000000) return 7;
  if (wager < 500000000) return 8;
  if (wager < 1000000000) return 9;
  return 10;
}

const USER_SESSION_KEY = 'winwave_user_session';
const USERS_STORAGE_KEY = 'winwave_users';

const readStoredSession = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const readRegisteredUsers = () => {
  if (typeof window === 'undefined') return [] as Array<{ phone: string; balance: number }>;
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const persistRegisteredUser = (phone: string, data: Record<string, unknown>) => {
  if (typeof window === 'undefined') return;
  const users = readRegisteredUsers();
  const existingIndex = users.findIndex((u: any) => u.phone === phone);
  const entry = { phone, ...data };
  if (existingIndex >= 0) {
    users[existingIndex] = { ...users[existingIndex], ...entry };
  } else {
    users.push(entry);
  }
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const savedSession = readStoredSession();

  const [uid, setUid] = useState(savedSession?.uid || '');
  const [username, setUsername] = useState(savedSession?.username || '');
  const [avatar, setAvatar] = useState(savedSession?.avatar || '/assets/avatar/Avatar 1.webp');
  const [soundEnabled, setSoundEnabled] = useState(savedSession?.soundEnabled ?? true);
  const [musicEnabled, setMusicEnabled] = useState(savedSession?.musicEnabled ?? true);
  const [wageringRequired, setWageringRequired] = useState(savedSession?.wageringRequired ?? 0);
  const [wageringCompleted, setWageringCompleted] = useState(savedSession?.wageringCompleted ?? 0);
  const [referralCode, setReferralCodeState] = useState(savedSession?.referralCode || '');
  const [referralCount, setReferralCount] = useState(savedSession?.referralCount ?? 0);

  const setReferralCode = useCallback((code: string) => {
    setReferralCodeState(code);
    if (typeof window !== 'undefined' && code) {
      localStorage.setItem('winwave_referral_code', code);
    }
  }, []);
  const [totalCommissions, setTotalCommissions] = useState(savedSession?.totalCommissions ?? 0);
  const [claimedDailyBonus, setClaimedDailyBonus] = useState(savedSession?.claimedDailyBonus ?? false);
  const [dailyWagerProgress, setDailyWagerProgress] = useState(savedSession?.dailyWagerProgress ?? 0);

  const [lastLogin, setLastLogin] = useState(savedSession?.lastLogin || '');
  const [phoneNumber, setPhoneNumberState] = useState(savedSession?.phoneNumber || '');
  const [selectedPaymentMethod, setSelectedPaymentMethodState] = useState<'jazzcash' | 'easypaisa'>(
    (savedSession?.selectedPaymentMethod as 'jazzcash' | 'easypaisa') || 'jazzcash'
  );
  const [withdrawalPassword, setWithdrawalPasswordState] = useState(savedSession?.withdrawalPassword || '');
  const [boundAccounts, setBoundAccountsState] = useState(savedSession?.boundAccounts || {
    easypaisa: null,
    jazzcash: null,
  });

  const [isLoggedIn, setIsLoggedInState] = useState<boolean>(() => {
    const stored = localStorage.getItem("b9_logged_in");
    return stored === "true" || Boolean(savedSession?.isLoggedIn);
  });

  const setIsLoggedIn = (val: boolean) => {
    setIsLoggedInState(val);
    localStorage.setItem("b9_logged_in", val ? "true" : "false");
  };

  const setPhoneNumber = (phone: string) => {
    setPhoneNumberState(phone);
    if (phone) {
      localStorage.setItem('winwave_last_phone', phone);
    }
  };

  const setSelectedPaymentMethod = (method: 'jazzcash' | 'easypaisa') => {
    setSelectedPaymentMethodState(method);
  };

  const setWithdrawalPassword = (pin: string) => {
    setWithdrawalPasswordState(pin);
  };

  const setBoundAccounts = (accounts: any) => {
    setBoundAccountsState(accounts);
  };

  const [mainWalletBalance, setMainWalletBalanceState] = useState<number>(
    savedSession?.mainWalletBalance ?? savedSession?.balance ?? 0
  );
  const [thirdPartyWalletBalance, setThirdPartyWalletBalanceState] = useState<number>(
    savedSession?.thirdPartyWalletBalance ?? 0
  );
  const totalBalance = mainWalletBalance + thirdPartyWalletBalance;

  const setMainWalletBalance = (value: number) => {
    setMainWalletBalanceState(value);
    if (phoneNumber) {
      persistRegisteredUser(phoneNumber, { balance: value, mainWalletBalance: value });
    }
  };

  const setThirdPartyWalletBalance = (value: number) => {
    setThirdPartyWalletBalanceState(value);
  };

  const setBalance = (value: number) => {
    setMainWalletBalance(value);
  };

  const transferWallet = useCallback((direction: 'to-game' | 'to-main', amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return false;

    if (direction === 'to-game') {
      if (amount > mainWalletBalance) return false;
      setMainWalletBalanceState((prev) => prev - amount);
      setThirdPartyWalletBalanceState((prev) => prev + amount);
      return true;
    }

    if (amount > thirdPartyWalletBalance) return false;
    setThirdPartyWalletBalanceState((prev) => prev - amount);
    setMainWalletBalanceState((prev) => prev + amount);
    return true;
  }, [mainWalletBalance, thirdPartyWalletBalance]);

  const login = async (
    phoneNumberValue: string,
    userId?: string,
    profile?: { referral_code?: string; phone_number?: string; vip_level?: number; total_bets?: number },
    wallet?: { main_balance?: number; game_balance?: number }
  ) => {
    const suffix = phoneNumberValue.substring(Math.max(0, phoneNumberValue.length - 4));
    setUid(userId || '');
    setPhoneNumber(profile?.phone_number || phoneNumberValue);
    setUsername(`MEMBER_${suffix}`);
    if (profile?.referral_code) {
      setReferralCode(profile.referral_code);
    }
    if (wallet?.main_balance !== undefined) {
      setMainWalletBalanceState(wallet.main_balance);
    }
    if (wallet?.game_balance !== undefined) {
      setThirdPartyWalletBalanceState(wallet.game_balance);
    }
    setLastLogin(new Date().toISOString());
    setIsLoggedIn(true);

    void refreshUserData(userId);
  };

  const logout = () => {
    setPhoneNumberState("");
    setIsLoggedIn(false);
    localStorage.removeItem(USER_SESSION_KEY);
    localStorage.removeItem('winwave_last_phone');
  };

  const [cumulativeWager, setCumulativeWagerState] = useState<number>(() => {
    const stored = localStorage.getItem("cumulative_wager");
    return stored ? parseFloat(stored) : (savedSession?.cumulativeWager ?? 0);
  });

  const [vipLevel, setVipLevelState] = useState<number>(
    savedSession?.vipLevel ?? getVipLevelFromWager(savedSession?.cumulativeWager ?? 0)
  );
  const [vipProgress, setVipProgressState] = useState<number>(savedSession?.vipProgress ?? 0);

  const setCumulativeWager = (wager: number) => {
    setCumulativeWagerState(wager);
    localStorage.setItem("cumulative_wager", wager.toString());
  };

  const applyProfileData = useCallback((profile: ProfileRow) => {
    const level = profile.vip_level;
    const wagered = profile.total_bets;

    if (level != null) setVipLevelState(level);
    if (wagered != null) {
      setCumulativeWagerState(wagered);
      localStorage.setItem('cumulative_wager', wagered.toString());
    }

    const resolvedLevel = level ?? undefined;
    const resolvedWagered = wagered ?? undefined;
    if (resolvedLevel != null && resolvedWagered != null) {
      setVipProgressState(computeVipProgress(resolvedLevel, resolvedWagered));
    }
  }, []);

  const refreshUserData = useCallback(async (providedUserId?: string) => {
    let userId = providedUserId || uid;
    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id ?? '';
      if (userId) setUid(userId);
    }
    if (!userId) return;

    const { data, error } = await supabase
      .from('users')
      .select('referral_code, phone_number, vip_level, total_bets, main_balance, game_balance, wagering_required, wagering_completed, withdrawal_pin, bank_details, invite_code, referred_by')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Failed to refresh profile data:', error);
    } else if (data) {
      const userData = data as unknown as UserProfileSchema & { withdrawal_pin?: string; bank_details?: any; invite_code?: string; referred_by?: string };
      
      // Set referral code from either field
      const refCode = userData.referral_code || userData.invite_code || '';
      if (refCode) setReferralCode(refCode);
      
      if (userData.phone_number) setPhoneNumber(userData.phone_number);
      
      // Load balances
      if (userData.main_balance != null) setMainWalletBalanceState(userData.main_balance);
      if (userData.game_balance != null) setThirdPartyWalletBalanceState(userData.game_balance);
      
      // Load wagering
      if (userData.wagering_required != null) setWageringRequired(userData.wagering_required);
      if (userData.wagering_completed != null) setWageringCompleted(userData.wagering_completed);
      
      // Load withdrawal PIN if it exists
      if (userData.withdrawal_pin) {
        setWithdrawalPasswordState(userData.withdrawal_pin);
      }
      
      // Load bank/wallet details if they exist
      if (userData.bank_details) {
        const bd = userData.bank_details;
        const accounts: any = { easypaisa: null, jazzcash: null };
        if (bd.easypaisa?.account) {
          accounts.easypaisa = { name: bd.easypaisa.name, account: bd.easypaisa.account, remarks: bd.easypaisa.remarks || '' };
        }
        if (bd.jazzcash?.account) {
          accounts.jazzcash = { name: bd.jazzcash.name, account: bd.jazzcash.account, remarks: bd.jazzcash.remarks || '' };
        }
        setBoundAccountsState(accounts);
      }
      
      applyProfileData(userData as ProfileRow);
    }

    const { count: refCount } = await adminSupabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('referred_by', userId);
    if (refCount != null) setReferralCount(refCount);
  }, [uid, applyProfileData]);

  useEffect(() => {
    if (!withdrawalPassword || !uid) return;
    const persistWithdrawalPin = async () => {
      try {
        const { error } = await (supabase as any)
          .from('users')
          .update({ withdrawal_pin: withdrawalPassword } as UserProfileSchema)
          .eq('id', uid);
        if (error) console.error('Failed to persist withdrawal_pin:', error);
        else console.log('✅ Withdrawal PIN persisted to public.users');
      } catch (err) {
        console.error('Error persisting withdrawal_pin:', err);
      }
    };
    persistWithdrawalPin();
  }, [withdrawalPassword, uid]);

  useEffect(() => {
    if (!uid) return;
    if (!boundAccounts.easypaisa && !boundAccounts.jazzcash) return;
    const persistBankDetails = async () => {
      try {
        const bankDetails = {
          easypaisa: boundAccounts.easypaisa ? {
            name: boundAccounts.easypaisa.name,
            account: boundAccounts.easypaisa.account,
            remarks: boundAccounts.easypaisa.remarks || null,
          } : null,
          jazzcash: boundAccounts.jazzcash ? {
            name: boundAccounts.jazzcash.name,
            account: boundAccounts.jazzcash.account,
            remarks: boundAccounts.jazzcash.remarks || null,
          } : null,
        };
        const { error } = await (supabase as any)
          .from('users')
          .update({ bank_details: bankDetails } as UserProfileSchema)
          .eq('id', uid);
        if (error) {
          const code = (error as any).code;
          if (code === 'PGRST204') {
            console.warn('⚠️ bank_details column not in schema cache — skipping persist. Run: NOTIFY pgrst, \'reload schema\';');
          } else {
            console.error('Failed to persist bank details:', error);
          }
        } else {
          console.log('✅ Bank details persisted to public.users');
        }
      } catch (err) {
        console.error('Error persisting bank details:', err);
      }
    };
    persistBankDetails();
  }, [boundAccounts, uid]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isLoggedIn) {
      localStorage.removeItem(USER_SESSION_KEY);
      return;
    }
    const session = {
      uid,
      phoneNumber,
      username,
      avatar,
      balance: totalBalance,
      mainWalletBalance,
      thirdPartyWalletBalance,
      referralCode,
      soundEnabled,
      musicEnabled,
      wageringRequired,
      wageringCompleted,
      referralCount,
      totalCommissions,
      claimedDailyBonus,
      dailyWagerProgress,
      cumulativeWager,
      vipLevel,
      vipProgress,
      isLoggedIn,
      selectedPaymentMethod,
      withdrawalPassword,
      boundAccounts,
      lastLogin: new Date().toISOString(),
    };
    localStorage.setItem(USER_SESSION_KEY, JSON.stringify(session));
  }, [avatar, boundAccounts, claimedDailyBonus, cumulativeWager, dailyWagerProgress, isLoggedIn, lastLogin, mainWalletBalance, musicEnabled, phoneNumber, referralCode, referralCount, selectedPaymentMethod, soundEnabled, thirdPartyWalletBalance, totalCommissions, uid, username, vipLevel, vipProgress, wageringCompleted, wageringRequired, withdrawalPassword]);

  // On mount, if logged in, refresh user data from DB (handles page refresh)
  useEffect(() => {
    if (isLoggedIn && uid) {
      void refreshUserData(uid);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for auth state changes to load user data on login/refresh
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const userId = session?.user?.id;
        if (userId) {
          setUid(userId);
          void refreshUserData(userId);
        }
      }
    });
    return () => subscription?.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isLoggedIn || !uid) return;
    const channel = supabase
      .channel(`profile-changes-${uid}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${uid}`,
        },
        (payload) => {
          const row = payload.new as any;
          if (row) {
            applyProfileData(row as ProfileRow);
            if (row.main_balance != null) setMainWalletBalanceState(row.main_balance);
            if (row.game_balance != null) setThirdPartyWalletBalanceState(row.game_balance);
            if (row.wagering_required != null) setWageringRequired(row.wagering_required);
            if (row.wagering_completed != null) setWageringCompleted(row.wagering_completed);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isLoggedIn, uid, refreshUserData, applyProfileData]);

  // ── 1. CUMULATIVE WAGER FUNCTION ──
  const addCumulativeWager = (amount: number) => {
    setCumulativeWagerState((prev: number) => {
      const next = prev + amount;
      localStorage.setItem("cumulative_wager", next.toString());
      const session = readStoredSession();
      if (session) {
        session.cumulativeWager = next;
        localStorage.setItem(USER_SESSION_KEY, JSON.stringify(session));
      }
      return next;
    });
  };

  // ── 2. CLEAN ASYNC WAGERING PROGRESS FUNCTION ──
  const addWageringProgress = async (amount: number) => {
    setWageringCompleted((prev: number) => prev + amount);
    addCumulativeWager(amount);
    
    if (uid && amount > 0) {
      // Write wagering_completed to DB directly (trg_wagering_on_bet_insert is broken
      // because it fires only when status='completed' but bets are inserted as 'pending')
      try {
        await (supabase as any)
          .from('users')
          .update({ wagering_completed: (wageringCompleted + amount) })
          .eq('id', uid);
      } catch (wagerErr) {
        console.warn('wagering_completed DB update failed:', wagerErr);
      }

      try {
        const { error } = await (supabase.rpc as any)('process_team_commission', {
          p_subordinate_id: uid,
          p_processing_amount: amount
        });

        if (error) {
          console.warn('Commission distribution function returned an error:', error.message);
        }
      } catch (commissionErr) {
        console.warn('Commission distribution execution failed:', commissionErr);
      }
    }
  };
  const addDailyWagerProgress = (amount: number) => {
    setDailyWagerProgress((prev: number) => prev + amount);
  };

  const addDepositWithBonus = (deposit: number, bonus: number) => {
    setMainWalletBalanceState((prev: number) => prev + deposit + bonus);
    setWageringRequired((prev: number) => prev + deposit + bonus);
    setWageringCompleted(0);
    
    if (uid) {
      try {
        (supabase.rpc as any)('process_team_commission', {
          p_subordinate_id: uid,
          p_processing_amount: deposit + bonus
        }).catch((commissionErr: any) => {
          console.warn('Commission distribution failed:', commissionErr);
        });
      } catch (commissionErr) {
        console.warn('Commission distribution failed:', commissionErr);
      }
    }
  };

  const registerUser = useCallback(async (_phone: string, _password: string, _inviteCode?: string): Promise<{ success: boolean; error?: string }> => {
    return {
      success: false,
      error: 'Registration is handled by the auth flow in AuthViewReact.',
    };
  }, []);

  const fetchReferrals = useCallback(async (): Promise<Array<{ id: string; phone: string; joined_at: string }>> => {
    if (!uid) return [];
    const { data, error } = await adminSupabase
      .from('users')
      .select('id, phone_number, created_at')
      .eq('referred_by', uid)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching referrals:', error);
      return [];
    }
    return data.map((row: any) => ({
      id: row.id,
      phone: row.phone_number || 'Unknown',
      joined_at: row.created_at,
    }));
  }, [uid]);

  const fetchTotalCommissions = useCallback(async (): Promise<number> => {
    if (!uid) return 0;
    const { data, error } = await supabase
      .from('referral_commissions')
      .select('amount, inviter_id')
      .eq('inviter_id', uid);
    if (error) {
      console.error('Error fetching commissions:', error);
      return 0;
    }
    const total = (data as Array<{ amount: number }>).reduce((sum, row) => sum + (row.amount || 0), 0);
    setTotalCommissions(total);
    return total;
  }, [uid]);

  const submitWithdrawal = useCallback(async (params: {
    amount: number;
    method: 'jazzcash' | 'easypaisa';
    accountName: string;
    accountNumber: string;
    remarks?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    if (!uid) return { success: false, error: 'User not logged in' };
    try {
      const { data, error } = await (supabase.rpc as any)('submit_withdrawal', {
        p_user_id: uid,
        p_amount: params.amount,
        p_method: params.method.toUpperCase(),
        p_account_name: params.accountName,
        p_account_number: params.accountNumber,
        p_remarks: params.remarks?.trim() || null,
      });

      if (error || !data?.success) {
        return { success: false, error: data?.error || error?.message || 'Withdrawal failed' };
      }

      setMainWalletBalanceState((prev: number) => prev - params.amount);
      
      try {
        await (supabase.rpc as any)('process_team_commission', {
          p_subordinate_id: uid,
          p_processing_amount: params.amount
        });
      } catch (commissionErr) {
        console.warn('Commission distribution failed:', commissionErr);
      }
      
      return { success: true };
    } catch (err: any) {
      console.error('Withdrawal error:', err);
      return { success: false, error: err.message || 'Withdrawal failed' };
    }
  }, [uid]);

  return (
    <UserContext.Provider value={{
      username, setUsername,
      avatar, setAvatar,
      uid, phoneNumber, setPhoneNumber,
      lastLogin,
      balance: totalBalance,
      setBalance,
      mainWalletBalance,
      thirdPartyWalletBalance,
      totalBalance,
      transferWallet,
      setThirdPartyWalletBalance,
      setReferralCode,
      referralCode,
      soundEnabled, setSoundEnabled,
      musicEnabled, setMusicEnabled,
      wageringRequired, setWageringRequired,
      wageringCompleted, setWageringCompleted,
      addWageringProgress,
      addDepositWithBonus,
      referralCount,
      totalCommissions,
      setTotalCommissions,
      claimedDailyBonus,
      setClaimedDailyBonus,
      dailyWagerProgress,
      addDailyWagerProgress,
      cumulativeWager,
      setCumulativeWager,
      addCumulativeWager,
      vipLevel,
      vipProgress,
      refreshUserData,
      isLoggedIn,
      setIsLoggedIn,
      login,
      logout,
      selectedPaymentMethod,
      setSelectedPaymentMethod,
      withdrawalPassword,
      setWithdrawalPassword,
      boundAccounts,
      setBoundAccounts,
      registerUser,
      fetchReferrals,
      fetchTotalCommissions,
      submitWithdrawal,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}