import React from "react";
import { ChevronLeft, Megaphone } from "lucide-react";

interface NoticeViewProps {
  onBack: () => void;
}

export default function NoticeView({ onBack }: NoticeViewProps) {
  const notices = [
    {
      id: 1,
      title: "JOIN AS AGENT",
      content: "Join now and start earning with Winwave Team",
      time: "2026-05-17 16:43:23",
    },
    {
      id: 2,
      title: "TRUSTED PLATFORM",
      content: "Fast, safe, and stable withdrawals.",
      time: "2026-05-17 16:43:24",
    },
    {
      id: 3,
      title: "OFFICIAL GROUP",
      content: "Reminder: Join our official group to participate in exclusive event bonuses.",
      time: "2026-05-17 16:53:04",
    },
    {
      id: 4,
      title: "VIP EXTRA BONUS",
      content: "Note: When your VIP level increases, you can receive extra bonuses of up to Rs 15,000,000.",
      time: "2026-05-17 16:53:05",
    },
  ];

  return (
    <div className="flex-1 flex flex-col bg-[#0A0A0B] min-h-screen text-gray-200 animate-slide-up pb-6 no-scrollbar">
      {/* Top Navbar matching website's matte charcoal style */}
      <div className="h-12 bg-[#161618] flex items-center px-4 border-b border-white/5 sticky top-0 z-30 flex-shrink-0">
        <button 
          id="notice-back-btn"
          onClick={onBack} 
          className="p-1 hover:bg-white/10 rounded-full transition-colors cursor-pointer mr-3 text-gray-300 hover:text-white"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-white text-base font-black tracking-widest flex-1 text-center pr-9 uppercase">
          Notice
        </h1>
      </div>

      <div className="flex-1 p-4 space-y-4 overflow-y-auto no-scrollbar">
        {notices.map((notice) => (
          <div 
            key={notice.id}
            className="bg-[#161618] border border-[#ffa502]/15 rounded-3xl p-5 flex gap-4 items-start relative overflow-hidden transition-all hover:border-[#ffa502]/30 shadow-lg"
          >
            {/* Megaphone icon container - orange as requested */}
            <div className="w-11 h-11 bg-[#ffa502]/10 rounded-2xl flex items-center justify-center border border-[#ffa502]/25 flex-shrink-0">
              <Megaphone className="w-5 h-5 text-[#ffa502]" />
            </div>

            {/* Content info */}
            <div className="flex-1 space-y-1">
              <h3 className="text-xs font-black text-[#ffa502] uppercase tracking-wider block">
                {notice.title}
              </h3>
              <p className="text-[11px] font-medium text-gray-300 leading-relaxed">
                {notice.content}
              </p>
              <span className="text-[9px] font-bold text-gray-500 block pt-1">
                {notice.time}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
