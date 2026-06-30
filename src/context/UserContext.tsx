import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface UserContextType {
  username: string;
  setUsername: (username: string) => void;
  avatar: string;
  setAvatar: (avatar: string) => void;
  uid: string;
  displayId: string;
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
  referralCount: number;
  totalCommissions: number;
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
    profile?: { invite_code?: string; phone?: string },
    wallet?: { main_balance?: number; wagering_required?: number }
  ) => void;
  logout: () => void;
  selectedPaymentMethod: 'jazzcash' | 'easypaisa' | 'usdt';
  setSelectedPaymentMethod: (method: 'jazzcash' | 'easypaisa' | 'usdt') => void;
  withdrawalPassword: string;
  setWithdrawalPassword: (pin: string) => void;
  boundAccounts: {
    easypaisa: { name: string; account: string; remarks?: string } | null;
    jazzcash: { name: string; account: string; remarks?: string } | null;
    usdt: { name: string; account: string; network: string; remarks?: string } | null;
  };
  setBoundAccounts: (accounts: any) => void;
}

export interface VipTier {
  level: number;
  requiredWager: number; // to reach next level
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
  usdt: { min: 3_000, max: 100_000_000, dailyMax: 5 },
} as const;

export type PaymentMethod = keyof typeof PAYMENT_LIMITS;

export function formatDisplayUid(uid: string): string {
  if (!uid) return '------';
  return uid.replace(/-/g, '').slice(0, 6);
}

export type ProfileRow = {
  vip_level?: number | null;
  username?: string | null;
  withdrawal_pin?: string | number | null;
  balance?: number | null;
  invite_code?: string | null;
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
  const [displayId, setDisplayId] = useState(savedSession?.displayId || savedSession?.referralCode || '');
  const [username, setUsername] = useState(savedSession?.username || '');
  const [avatar, setAvatar] = useState(savedSession?.avatar || '/assets/avatar/Avatar 1.webp');
  const [soundEnabled, setSoundEnabled] = useState(savedSession?.soundEnabled ?? true);
  const [musicEnabled, setMusicEnabled] = useState(savedSession?.musicEnabled ?? true);
  const [wageringRequired, setWageringRequired] = useState(savedSession?.wageringRequired ?? 0);
  const [wageringCompleted, setWageringCompleted] = useState(savedSession?.wageringCompleted ?? 0);
  const [referralCode, setReferralCode] = useState(savedSession?.referralCode || '');
  const [referralCount, setReferralCount] = useState(savedSession?.referralCount ?? 0);
  const [totalCommissions, setTotalCommissions] = useState(savedSession?.totalCommissions ?? 0);
  const [claimedDailyBonus, setClaimedDailyBonus] = useState(savedSession?.claimedDailyBonus ?? false);
  const [dailyWagerProgress, setDailyWagerProgress] = useState(savedSession?.dailyWagerProgress ?? 0);
  const [lastLogin, setLastLogin] = useState(savedSession?.lastLogin || '');
  const [phoneNumber, setPhoneNumberState] = useState(savedSession?.phoneNumber || '');
  const [selectedPaymentMethod, setSelectedPaymentMethodState] = useState<'jazzcash' | 'easypaisa' | 'usdt'>(
    (savedSession?.selectedPaymentMethod as 'jazzcash' | 'easypaisa' | 'usdt') || 'jazzcash'
  );
  const [withdrawalPassword, setWithdrawalPasswordState] = useState(savedSession?.withdrawalPassword || '');
  const [boundAccounts, setBoundAccountsState] = useState(savedSession?.boundAccounts || {
    easypaisa: null,
    jazzcash: null,
    usdt: null,
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

  const setSelectedPaymentMethod = (method: 'jazzcash' | 'easypaisa' | 'usdt') => {
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
    setMainWalletBalance(value - thirdPartyWalletBalance);
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

  const login = (
    phoneNumberValue: string,
    userId?: string,
    profile?: { invite_code?: string; phone?: string },
    wallet?: { main_balance?: number; wagering_required?: number }
  ) => {
    const suffix = phoneNumberValue.substring(Math.max(0, phoneNumberValue.length - 4));
    setUid(userId || '');
    setPhoneNumber(profile?.phone || phoneNumberValue);
    setUsername(`MEMBER_${suffix}`);
    if (profile?.invite_code) {
      setReferralCode(profile.invite_code);
      setDisplayId(profile.invite_code);
    }
    if (wallet?.main_balance !== undefined) {
      setMainWalletBalanceState(wallet.main_balance);
    }
    if (wallet?.wagering_required !== undefined) {
      setWageringRequired(wallet.wagering_required);
    }
    setLastLogin(new Date().toISOString());
    setIsLoggedIn(true);
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
    // Profile identity fields are sourced from the database, not local storage.
    if (profile.username) {
      setUsername(profile.username);
    }
    if (profile.withdrawal_pin != null) {
      setWithdrawalPasswordState(String(profile.withdrawal_pin));
    }
    if (profile.invite_code) {
      setReferralCode(profile.invite_code);
      setDisplayId(profile.invite_code);
    }
    if (profile.balance != null) {
      setMainWalletBalanceState(profile.balance);
    }

    const level = profile.vip_level;
    if (level != null) {
      setVipLevelState(level);
      setCumulativeWagerState((currentWager) => {
        setVipProgressState(computeVipProgress(level, currentWager));
        return currentWager;
      });
    }
  }, []);

  const refreshUserData = useCallback(async () => {
    let userId = uid;
    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id ?? '';
      if (userId) setUid(userId);
    }
    if (!userId) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('vip_level, username, withdrawal_pin, balance, invite_code')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Failed to refresh profile data:', error);
      return;
    }

    if (data) {
      applyProfileData(data);
    }

    const { data: walletRow } = await supabase
      .from('wallets')
      .select('main_balance, wagering_required, wagering_completed')
      .eq('user_id', userId)
      .maybeSingle();

    if (walletRow) {
      if (walletRow.main_balance != null) setMainWalletBalanceState(walletRow.main_balance);
      if (walletRow.wagering_required != null) setWageringRequired(walletRow.wagering_required);
      if (walletRow.wagering_completed != null) setWageringCompleted(walletRow.wagering_completed);
    }
  }, [uid, applyProfileData]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!isLoggedIn) {
      localStorage.removeItem(USER_SESSION_KEY);
      return;
    }

    const session = {
      uid,
      displayId,
      phoneNumber,
      username,
      avatar,
      balance: totalBalance,
      mainWalletBalance,
      thirdPartyWalletBalance,
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
  }, [avatar, boundAccounts, claimedDailyBonus, cumulativeWager, dailyWagerProgress, displayId, isLoggedIn, lastLogin, mainWalletBalance, musicEnabled, phoneNumber, referralCode, referralCount, selectedPaymentMethod, soundEnabled, thirdPartyWalletBalance, totalCommissions, uid, username, vipLevel, vipProgress, wageringCompleted, wageringRequired, withdrawalPassword]);

  // When a session is restored from storage the uid may be missing; recover it
  // from the Supabase auth session so profile sync can run on load.
  useEffect(() => {
    if (!isLoggedIn || uid) return;
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const recovered = session?.user?.id ?? '';
      if (!cancelled && recovered) setUid(recovered);
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, uid]);

  useEffect(() => {
    if (!isLoggedIn || !uid) return;

    refreshUserData();

    const channel = supabase
      .channel(`profile-changes-${uid}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${uid}`,
        },
        (payload) => {
          if (payload.new) {
            applyProfileData(payload.new as ProfileRow);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isLoggedIn, uid, refreshUserData, applyProfileData]);

  const addCumulativeWager = (amount: number) => {
    setCumulativeWagerState(prev => {
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

  const addWageringProgress = (amount: number) => {
    setWageringCompleted(prev => prev + amount);
    addCumulativeWager(amount);
  };

  const addDailyWagerProgress = (amount: number) => {
    setDailyWagerProgress(prev => prev + amount);
  };

  const addDepositWithBonus = (deposit: number, bonus: number) => {
    setMainWalletBalanceState((prev) => prev + deposit + bonus);
    setWageringRequired((prev) => prev + deposit + bonus);
    setWageringCompleted(0);
  };

  return (
    <UserContext.Provider value={{ 
      username, setUsername, 
      avatar, setAvatar, 
      uid, displayId, phoneNumber, setPhoneNumber,
      lastLogin,
      balance: totalBalance,
      setBalance,
      mainWalletBalance,
      thirdPartyWalletBalance,
      totalBalance,
      transferWallet,
      setThirdPartyWalletBalance,
      soundEnabled, setSoundEnabled,
      musicEnabled, setMusicEnabled,
      wageringRequired, setWageringRequired,
      wageringCompleted, setWageringCompleted,
      addWageringProgress,
      addDepositWithBonus,
      referralCode,
      referralCount,
      totalCommissions,
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
