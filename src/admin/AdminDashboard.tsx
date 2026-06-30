import React from "react";
import { AdminProvider, useAdmin } from "./context/AdminContext";
import { Sidebar } from "./components/Sidebar";
import { DashboardOverview } from "./pages/DashboardOverview";
import { GamePage } from "./pages/GamePage";
import { MemberManagement } from "./pages/MemberManagement";
import { HistoryPage } from "./pages/HistoryPage";
import { FundsManagement } from "./pages/FundsManagement";
import { AgentManagement } from "./pages/AgentManagement";
import { Settings } from "./pages/Settings";

function AdminDashboardContent() {
  const { currentPage } = useAdmin();

  const renderPage = () => {
    switch (currentPage) {
      case "overview":
        return <DashboardOverview />;
      case "wingo":
        return (
          <GamePage
            gameType="wingo"
            gameTitle="WinGo Game Controller"
            gameDescription="Manage WinGo game modes (30s, 1m, 3m, 5m) and configure smart risk management"
          />
        );
      case "k3":
        return (
          <GamePage
            gameType="k3"
            gameTitle="K3 Game Controller"
            gameDescription="Manage K3 game modes and configure smart risk management"
          />
        );
      case "trx":
        return (
          <GamePage
            gameType="trx"
            gameTitle="TRX Game Controller"
            gameDescription="Manage TRX game modes and configure smart risk management"
          />
        );
      case "5d":
        return (
          <GamePage
            gameType="5d"
            gameTitle="5D Game Controller"
            gameDescription="Manage 5D game modes and configure smart risk management"
          />
        );
      case "members":
        return <MemberManagement />;
      case "game-history":
        return <HistoryPage historyType="game" />;
      case "recharge-history":
        return <HistoryPage historyType="recharge" />;
      case "bet-history":
        return <HistoryPage historyType="bet" />;
      case "withdraw-history":
        return <HistoryPage historyType="withdraw" />;
      case "deposit-requests":
        return <FundsManagement type="deposit" />;
      case "withdraw-requests":
        return <FundsManagement type="withdraw" />;
      case "agents":
        return <AgentManagement />;
      case "settings":
        return <Settings />;
      default:
        return <DashboardOverview />;
    }
  };

  return (
    <div className="flex h-screen bg-[#0f0f1e]">
      <Sidebar />
      {renderPage()}
    </div>
  );
}

export function AdminDashboard() {
  return (
    <AdminProvider>
      <AdminDashboardContent />
    </AdminProvider>
  );
}
