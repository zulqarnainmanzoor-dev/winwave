// src/components/WinGoResultPopup.tsx
import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { ResultBall } from "./ResultBall";

interface BetResult {
  isWin: boolean;
  period: string;
  resultNumber: number;
  resultColor: string;
  resultSize: string;
  winAmount: number;
  amount: number;
}

interface Props {
  bet: BetResult;
  onClose: () => void;
}

const AUTO_CLOSE_SECS = 3;

export function WinGoResultPopup({ bet, onClose }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(AUTO_CLOSE_SECS);
  const [autoClose, setAutoClose] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!autoClose) return;
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearInterval(timerRef.current!); onClose(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoClose, onClose]);

  const profit = bet.winAmount - bet.amount;
  const r = 18;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - secondsLeft / AUTO_CLOSE_SECS);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[300px] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-250"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ribbon ── */}
        {bet.isWin ? (
          <div className="relative flex flex-col items-center pt-7 pb-10"
            style={{ background: "linear-gradient(135deg,#f59e0b 0%,#ef4444 55%,#7c3aed 100%)" }}>
            {/* Glow ring */}
            <div className="w-20 h-20 rounded-full bg-white/15 flex items-center justify-center mb-3 ring-4 ring-white/30 shadow-xl">
              <img src="/assets/svg/Winning Pop up.jpg" alt="win"
                className="w-16 h-16 rounded-full object-cover" />
            </div>
            <p className="text-white/80 text-[10px] font-semibold uppercase tracking-widest mb-0.5">Congratulations!</p>
            <h2 className="text-white text-2xl font-black tracking-wide">You Won!</h2>
            <p className="text-white/60 text-[10px] mt-1">Period: {bet.period}</p>
            {/* Ribbon notch */}
            <div className="absolute bottom-0 left-0 w-0 h-0 border-l-[18px] border-l-transparent border-b-[18px] border-b-[#111]" />
            <div className="absolute bottom-0 right-0 w-0 h-0 border-r-[18px] border-r-transparent border-b-[18px] border-b-[#111]" />
          </div>
        ) : (
          <div className="relative flex flex-col items-center pt-7 pb-10"
            style={{ background: "linear-gradient(135deg,#1f2937 0%,#374151 100%)" }}>
            <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mb-3 ring-4 ring-white/10 shadow-xl">
              <img src="/assets/svg/Loss Pop up.jpg" alt="loss"
                className="w-16 h-16 rounded-full object-cover" />
            </div>
            <p className="text-white/60 text-[10px] font-semibold uppercase tracking-widest mb-0.5">Better Luck Next Time</p>
            <h2 className="text-white text-2xl font-black tracking-wide">Sorry!</h2>
            <p className="text-white/40 text-[10px] mt-1">Period: {bet.period}</p>
            <div className="absolute bottom-0 left-0 w-0 h-0 border-l-[18px] border-l-transparent border-b-[18px] border-b-[#111]" />
            <div className="absolute bottom-0 right-0 w-0 h-0 border-r-[18px] border-r-transparent border-b-[18px] border-b-[#111]" />
          </div>
        )}

        {/* ── Body ── */}
        <div className="bg-[#111] px-4 py-4 space-y-2.5">

          {/* Result ball + info */}
          <div className="flex items-center justify-between bg-white/5 rounded-2xl px-4 py-3">
            <span className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider">Result</span>
            <div className="flex items-center gap-2">
              <ResultBall number={bet.resultNumber} size="md" />
              <div className="flex flex-col items-end">
                <span className={`text-[10px] font-bold capitalize ${
                  bet.resultColor === "red" ? "text-[#ff4757]"
                  : bet.resultColor === "green" ? "text-[#2ed573]"
                  : "text-[#b39ddb]"
                }`}>{bet.resultColor}</span>
                <span className={`text-[10px] font-bold ${bet.resultSize === "Big" ? "text-[#fba846]" : "text-[#5c9df5]"}`}>
                  {bet.resultSize}
                </span>
              </div>
            </div>
          </div>

          {/* Win amount / loss message */}
          {bet.isWin ? (
            <>
              <div className="flex items-center justify-between bg-white/5 rounded-2xl px-4 py-3">
                <span className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider">Bonus</span>
                <span className="text-[#2ed573] text-lg font-black">+Rs {bet.winAmount.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between bg-white/5 rounded-2xl px-4 py-2.5">
                <span className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider">Profit</span>
                <span className="text-[#2ed573] text-sm font-bold">+Rs {profit.toFixed(2)}</span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center bg-white/5 rounded-2xl px-4 py-3">
              <span className="text-gray-500 text-sm font-semibold">No bonus this round — try again!</span>
            </div>
          )}

          {/* Auto-close row */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none" onClick={() => { setAutoClose(v => !v); setSecondsLeft(AUTO_CLOSE_SECS); }}>
              <div className="relative w-9 h-9">
                <svg className="w-9 h-9 -rotate-90" viewBox="0 0 44 44">
                  <circle cx="22" cy="22" r={r} fill="none" stroke="#2a2a2a" strokeWidth="3.5" />
                  {autoClose && (
                    <circle cx="22" cy="22" r={r} fill="none"
                      stroke={bet.isWin ? "#f59e0b" : "#6b7280"}
                      strokeWidth="3.5"
                      strokeDasharray={circumference}
                      strokeDashoffset={dashOffset}
                      strokeLinecap="round"
                      style={{ transition: "stroke-dashoffset 1s linear" }}
                    />
                  )}
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-white text-[10px] font-black">
                  {autoClose ? secondsLeft : "–"}
                </span>
              </div>
              <span className="text-gray-500 text-[10px]">Auto-close {AUTO_CLOSE_SECS}s</span>
            </label>

            <button
              onClick={onClose}
              className="flex items-center gap-1 px-3.5 py-1.5 rounded-full border border-white/15 text-gray-400 hover:text-white hover:border-white/30 text-[10px] font-semibold transition-all bg-transparent"
            >
              <X className="w-3 h-3" /> Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
