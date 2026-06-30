import React, { useState } from "react";
import { ChevronLeft } from "lucide-react";

interface NewInviteesViewProps {
  onBack: () => void;
}

export default function NewInviteesView({ onBack }: NewInviteesViewProps) {
  const [activeTab, setActiveTab] = useState<"today" | "yesterday" | "month">("today");

  return (
    <div className="flex-1 flex flex-col bg-[#0A0A0B] min-h-screen text-gray-200 animate-slide-up pb-[90px] no-scrollbar">
      {/* Top Navbar matching the website's matte charcoal style */}
      <div className="h-12 bg-[#161618] flex items-center px-4 border-b border-white/5 sticky top-0 z-30 flex-shrink-0">
        <button 
          id="new-invitees-back-btn"
          onClick={onBack} 
          className="p-1 hover:bg-white/10 rounded-full transition-colors cursor-pointer mr-3 text-gray-300 hover:text-white"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-white text-base font-black tracking-widest flex-1 text-center pr-9 uppercase">
          New Invitees
        </h1>
      </div>

      <div className="flex-1 p-4 space-y-6 overflow-y-auto no-scrollbar">
        {/* Toggle Pills / Tab Bar Row: Today, Yesterday, This month */}
        <div className="flex justify-between gap-2 select-none">
          <button
            onClick={() => setActiveTab("today")}
            className={`flex-1 py-2.5 px-3 rounded-full text-xs font-black tracking-wider text-center transition-all cursor-pointer ${
              activeTab === "today"
                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-black shadow-lg shadow-orange-500/10"
                : "bg-[#1C1C1E] text-gray-400 border border-white/5 hover:text-white"
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setActiveTab("yesterday")}
            className={`flex-1 py-2.5 px-3 rounded-full text-xs font-black tracking-wider text-center transition-all cursor-pointer ${
              activeTab === "yesterday"
                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-black shadow-lg shadow-orange-500/10"
                : "bg-[#1C1C1E] text-gray-400 border border-white/5 hover:text-white"
            }`}
          >
            Yesterday
          </button>
          <button
            onClick={() => setActiveTab("month")}
            className={`flex-1 py-2.5 px-3 rounded-full text-xs font-black tracking-wider text-center transition-all cursor-pointer ${
              activeTab === "month"
                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-black shadow-lg shadow-orange-500/10"
                : "bg-[#1C1C1E] text-gray-400 border border-white/5 hover:text-white"
            }`}
          >
            This month
          </button>
        </div>

        {/* Custom Overlapping Document/Folder Empty State Graphics with exact styling from screenshot */}
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="relative w-28 h-28 select-none flex items-center justify-center">
            {/* Back document */}
            <div className="absolute w-16 h-20 bg-[#1C1C1E]/85 rounded-2xl border border-white/10 rotate-[-12deg] shadow-lg flex flex-col justify-end p-3">
              <div className="w-10 h-1.5 bg-zinc-800 rounded-full mb-1.5" />
              <div className="w-8 h-1.5 bg-zinc-800 rounded-full" />
            </div>
            {/* Front document with frosted glass finish and gray guidelines */}
            <div className="absolute w-16 h-20 bg-[#2C2C2E]/95 rounded-2xl border border-white/20 translate-x-3.5 translate-y-1 rotate-[6deg] shadow-2xl flex flex-col p-3 justify-center gap-2.5 backdrop-blur-sm">
              <div className="w-11 h-1.5 bg-zinc-700/60 rounded-full" />
              <div className="w-9 h-1.5 bg-zinc-700/60 rounded-full" />
              <div className="w-10 h-1.5 bg-zinc-700/60 rounded-full" />
            </div>
          </div>
          <div className="text-center space-y-1">
            <span className="text-xs font-black text-gray-500 uppercase tracking-widest block">No Records</span>
          </div>
        </div>
      </div>
    </div>
  );
}
