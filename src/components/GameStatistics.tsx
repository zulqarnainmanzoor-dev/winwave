import React, { useState } from "react";
import { 
  ChevronLeft, 
  FileText, 
  Calendar,
  History,
  TrendingUp,
  Target
} from "lucide-react";
import { motion } from "motion/react";
import { useLanguage } from "../context/LanguageContext";

interface GameStatisticsProps {
  onBack: () => void;
}

type TabType = "today" | "yesterday" | "this_week" | "this_month";

export default function GameStatistics({ onBack }: GameStatisticsProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabType>("today");

  // Mock data for UI demonstration - in production this comes from Supabase
  const stats = {
    today: {
      totalBet: 0,
      betCount: 0,
      winningAmount: 0
    },
    yesterday: {
      totalBet: 67742.00,
      betCount: 32,
      winningAmount: 55226.92
    },
    this_week: {
      totalBet: 145000.00,
      betCount: 84,
      winningAmount: 112000.50
    },
    this_month: {
      totalBet: 450000.00,
      betCount: 210,
      winningAmount: 380000.25
    }
  };

  const currentStats = stats[activeTab];
  const hasRecords = currentStats.totalBet > 0;

  return (
    <div className="flex flex-col h-full bg-[#F5F9FF]">
      {/* Header */}
      <div className="bg-white px-4 py-4 flex items-center justify-between border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <button 
          onClick={onBack}
          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ChevronLeft className="w-6 h-6 text-[#1A1D21]" />
        </button>
        <h1 className="text-[#1A1D21] font-black text-lg tracking-tight">
          Game Statistics
        </h1>
        <div className="w-8" /> {/* Spacer */}
      </div>

      {/* Tabs */}
      <div className="p-4 bg-white shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {(["today", "yesterday", "this_week", "this_month"] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-300 ${
                activeTab === tab 
                  ? "bg-gradient-to-r from-[#4ED3E5] to-[#4B8EF1] text-white shadow-lg shadow-blue-500/20 scale-105" 
                  : "bg-white text-[#4B8EF1] border border-[#4B8EF1]/30 hover:bg-blue-50"
              }`}
            >
              {tab === "today" && "Today"}
              {tab === "yesterday" && "Yesterday"}
              {tab === "this_week" && "This Week"}
              {tab === "this_month" && "This month"}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!hasRecords ? (
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
            <div className="relative mb-6">
              <div className="absolute -inset-4 bg-blue-100/50 rounded-full blur-xl" />
              <History className="w-24 h-24 text-blue-200/80 relative" />
              <FileText className="w-16 h-16 text-gray-300 absolute bottom-0 right-0 translate-x-2 translate-y-2 opacity-50" />
            </div>
            <p className="text-[#4B8EF1] font-bold text-lg">No Records</p>
          </div>
        ) : (
          <div className="space-y-4 animate-slide-up">
            {/* Main Summary Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl p-6 shadow-xl shadow-blue-900/5 border border-white"
            >
              <div className="text-center">
                <p className="text-gray-400 text-sm font-medium mb-2">Total bet</p>
                <p className="text-[#4B8EF1] text-3xl font-black">
                  Rs{currentStats.totalBet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </motion.div>

            {/* Detailed Stats Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl shadow-xl shadow-blue-900/5 border border-white overflow-hidden"
            >
              <div className="p-4 border-b border-gray-50 flex items-center gap-3">
                <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md shadow-red-200">
                  8
                </div>
                <span className="text-[#1A1D21] font-black tracking-wider text-sm">LOTTERY</span>
              </div>

              <div className="p-5 space-y-4">
                <div className="flex justify-between items-center group">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-500 text-sm font-medium">Total bet</span>
                  </div>
                  <span className="text-[#1A1D21] font-bold">
                    Rs{currentStats.totalBet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-center group">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-500 text-sm font-medium">Number of bets</span>
                  </div>
                  <span className="text-[#1A1D21] font-bold">{currentStats.betCount}</span>
                </div>

                <div className="flex justify-between items-center group">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-500 text-sm font-medium">Winning amount</span>
                  </div>
                  <span className="text-emerald-500 font-bold">
                    Rs{currentStats.winningAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
