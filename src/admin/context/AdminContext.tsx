import React, { createContext, useContext, useState } from "react";

export type AdminRole = "main-admin" | "sub-admin";

export type AdminPage = 
  | "overview"
  | "wingo"
  | "k3"
  | "trx"
  | "5d"
  | "game-history"
  | "recharge-history"
  | "bet-history"
  | "withdraw-history"
  | "members"
  | "withdraw-requests"
  | "deposit-requests"
  | "gift-codes"
  | "agents"
  | "settings";

interface GameControlSettings {
  gameType: "wingo" | "k3" | "trx" | "5d";
  modes: {
    "30s": GameModeSettings;
    "1m": GameModeSettings;
    "3m": GameModeSettings;
    "5m": GameModeSettings;
  };
}

interface GameModeSettings {
  enabled: boolean;
  smartRiskEnabled: boolean;
  bigBetLimit: number; // Max total bet on Big
  smallBetLimit: number; // Max total bet on Small
  autoSmallWinThreshold: number; // If Big exceeds this AND Small is below smallBetLimit, auto-win Small
  payoutMultiplier: number; // Payout multiplier for winning bets
  lastUpdated: string;
}

interface AdminContextType {
  currentPage: AdminPage;
  setCurrentPage: (page: AdminPage) => void;
  
  // Admin role
  adminRole: AdminRole;
  setAdminRole: (role: AdminRole) => void;
  
  // Game settings
  gameSettings: { [key: string]: GameControlSettings };
  updateGameSettings: (gameType: string, settings: GameControlSettings) => void;
  updateGameMode: (gameType: string, mode: string, settings: Partial<GameModeSettings>) => void;
  
  // Admin stats
  stats: {
    totalRechargeToday: number;
    totalActiveUsers: number;
    totalUsers: number;
    totalWithdrawals: number;
    totalBalance: number;
  };
  
  // Smart Risk Management
  enableSmartRisk: (gameType: string, mode: string, enabled: boolean) => void;
  getSmartRiskStatus: (gameType: string, mode: string) => boolean;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

const defaultGameSettings: GameControlSettings = {
  gameType: "wingo",
  modes: {
    "30s": {
      enabled: true,
      smartRiskEnabled: false,
      bigBetLimit: 100000,
      smallBetLimit: 5000,
      autoSmallWinThreshold: 100000,
      payoutMultiplier: 1.95,
      lastUpdated: new Date().toISOString(),
    },
    "1m": {
      enabled: true,
      smartRiskEnabled: false,
      bigBetLimit: 150000,
      smallBetLimit: 7500,
      autoSmallWinThreshold: 150000,
      payoutMultiplier: 1.95,
      lastUpdated: new Date().toISOString(),
    },
    "3m": {
      enabled: true,
      smartRiskEnabled: false,
      bigBetLimit: 200000,
      smallBetLimit: 10000,
      autoSmallWinThreshold: 200000,
      payoutMultiplier: 1.95,
      lastUpdated: new Date().toISOString(),
    },
    "5m": {
      enabled: true,
      smartRiskEnabled: false,
      bigBetLimit: 250000,
      smallBetLimit: 12500,
      autoSmallWinThreshold: 250000,
      payoutMultiplier: 1.95,
      lastUpdated: new Date().toISOString(),
    },
  },
};

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [currentPage, setCurrentPage] = useState<AdminPage>("overview");
  const [adminRole, setAdminRole] = useState<AdminRole>("main-admin");
  
  const [gameSettings, setGameSettings] = useState<{ [key: string]: GameControlSettings }>({
    wingo: { ...defaultGameSettings, gameType: "wingo" },
    k3: { ...defaultGameSettings, gameType: "k3" },
    trx: { ...defaultGameSettings, gameType: "trx" },
    "5d": { ...defaultGameSettings, gameType: "5d" },
  });

  const [stats] = useState({
    totalRechargeToday: 0,
    totalActiveUsers: 0,
    totalUsers: 0,
    totalWithdrawals: 0,
    totalBalance: 0,
  });

  const updateGameSettings = (gameType: string, settings: GameControlSettings) => {
    setGameSettings((prev) => ({
      ...prev,
      [gameType]: settings,
    }));
  };

  const updateGameMode = (gameType: string, mode: string, updates: Partial<GameModeSettings>) => {
    setGameSettings((prev) => {
      const game = prev[gameType];
      if (!game) return prev;

      const modeSettings = (game.modes as Record<string, GameModeSettings>)[mode];
      if (!modeSettings) return prev;

      return {
        ...prev,
        [gameType]: {
          ...game,
          modes: {
            ...game.modes,
            [mode]: {
              ...modeSettings,
              ...updates,
              lastUpdated: new Date().toISOString(),
            },
          },
        },
      };
    });
  };

  const enableSmartRisk = (gameType: string, mode: string, enabled: boolean) => {
    updateGameMode(gameType, mode, { smartRiskEnabled: enabled });
  };

  const getSmartRiskStatus = (gameType: string, mode: string): boolean => {
    const game = gameSettings[gameType];
    if (!game) return false;
    return (game.modes as Record<string, GameModeSettings>)[mode]?.smartRiskEnabled || false;
  };

  return (
    <AdminContext.Provider
      value={{
        currentPage,
        adminRole,
        setAdminRole,
        setCurrentPage,
        gameSettings,
        updateGameSettings,
        updateGameMode,
        stats,
        enableSmartRisk,
        getSmartRiskStatus,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error("useAdmin must be used within AdminProvider");
  }
  return context;
}
