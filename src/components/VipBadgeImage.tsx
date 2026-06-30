import { useState } from "react";

export function VipBadgeImage({ level, size = "sm" }: { level: number; size?: "sm" | "lg" }) {
  const [hasError, setHasError] = useState(false);
  const isLg = size === "lg";
  const dimension = isLg ? "w-20 h-20" : "w-11 h-11";
  const badgePath = `/assets/Badges/${encodeURIComponent(`VIP ${level}.webp`)}`;

  if (hasError) {
    let gradient = "from-[#2C2C2E] to-[#121214]";
    let textColor = "text-zinc-400";
    let borderColor = "border-zinc-800/60";
    let glowColor = "";

    if (level >= 1 && level <= 3) {
      gradient = "from-[#3A3A3C] to-[#1C1C1E]";
      textColor = "text-amber-500";
      borderColor = "border-amber-500/40";
      glowColor = "shadow-[0_0_12px_rgba(245,158,11,0.15)]";
    } else if (level >= 4 && level <= 7) {
      gradient = "from-[#48484A] to-[#1C1C1E]";
      textColor = "text-orange-500";
      borderColor = "border-orange-500/40";
      glowColor = "shadow-[0_0_12px_rgba(249,115,22,0.15)]";
    } else if (level >= 8) {
      gradient = "from-[#636366] to-[#121214]";
      textColor = "text-[#ffa502]";
      borderColor = "border-[#ffa502]/50";
      glowColor = "shadow-[0_0_15px_rgba(255,165,2,0.25)]";
    }

    return (
      <div
        className={`flex flex-col items-center justify-center relative ${dimension} rounded-2xl bg-gradient-to-br ${gradient} border ${borderColor} ${glowColor} select-none`}
      >
        <span className={`font-black tracking-tighter ${isLg ? "text-2.5xl" : "text-base"} ${textColor}`}>
          V{level}
        </span>
        <div className="absolute -bottom-1.5 px-2 py-0.25 bg-[#0A0A0B] border border-white/5 rounded-full shadow-inner">
          <span className="text-[8px] font-black text-gray-500 uppercase tracking-wider">VIP</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative flex items-center justify-center ${dimension} select-none`}>
      <img
        src={badgePath}
        alt={`VIP ${level}`}
        className="w-full h-full object-contain"
        onError={() => setHasError(true)}
      />
    </div>
  );
}
