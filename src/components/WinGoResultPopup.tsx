// src/components/WinGoResultPopup.tsx
import { useEffect, useRef, useState, memo } from "react";
import { X } from "lucide-react";
import { ResultBall } from "./ResultBall";

// ── Types ─────────────────────────────────────────────────────────
interface BetResult {
  isWin:        boolean;
  period:       string;
  resultNumber: number;
  resultColor:  string;
  resultSize:   string;
  winAmount:    number;
  amount:       number;
  bonusAmount?: number;   // optional bonus on top of win
}

interface Props {
  bet:     BetResult;
  onClose: () => void;
}

// ── Coin particle data ────────────────────────────────────────────
interface Coin {
  id:       number;
  x:        number;   // % from left
  delay:    number;   // animation-delay ms
  duration: number;   // animation-duration ms
  size:     number;   // px
  rotate:   number;   // initial rotation deg
  symbol:   string;   // emoji or text
}

function generateCoins(count: number): Coin[] {
  const symbols = ["₹", "💰", "🪙", "★", "◆"];
  return Array.from({ length: count }, (_, i) => ({
    id:       i,
    x:        Math.random() * 100,
    delay:    Math.random() * 1200,
    duration: 1400 + Math.random() * 1000,
    size:     10 + Math.random() * 14,
    rotate:   Math.random() * 360,
    symbol:   symbols[Math.floor(Math.random() * symbols.length)],
  }));
}

const COINS = generateCoins(28);
const AUTO_CLOSE_SECS = 4;

// ── Coin component ────────────────────────────────────────────────
const CoinParticle = memo(({ coin }: { coin: Coin }) => (
  <span
    className="coin-particle"
    style={{
      left:              `${coin.x}%`,
      fontSize:          `${coin.size}px`,
      animationDelay:    `${coin.delay}ms`,
      animationDuration: `${coin.duration}ms`,
      transform:         `rotate(${coin.rotate}deg)`,
    }}
  >
    {coin.symbol}
  </span>
));

// ── Main component ────────────────────────────────────────────────
export function WinGoResultPopup({ bet, onClose }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(AUTO_CLOSE_SECS);
  const [paused,      setPaused]      = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-close countdown
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (paused) return;
    timerRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { clearInterval(timerRef.current!); onClose(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [paused, onClose]);

  const profit     = bet.winAmount - bet.amount;
  const bonus      = bet.bonusAmount ?? 0;
  const totalWin   = bet.winAmount + bonus;

  // SVG countdown ring
  const R           = 16;
  const circumference = 2 * Math.PI * R;
  const dashOffset    = circumference * (1 - secondsLeft / AUTO_CLOSE_SECS);

  const colorLabel =
    bet.resultColor === "red"    ? "text-[#ff4757]" :
    bet.resultColor === "green"  ? "text-[#2ed573]" :
                                   "text-[#ce93d8]";

  return (
    <>
      {/* ── Keyframe styles injected once ── */}
      <style>{`
        @keyframes coinFall {
          0%   { transform: translateY(-40px) rotate(0deg) scale(1);   opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(420px) rotate(720deg) scale(0.6); opacity: 0; }
        }
        @keyframes popIn {
          0%   { transform: scale(0.6) translateY(40px); opacity: 0; }
          70%  { transform: scale(1.04) translateY(-4px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes pulseRing {
          0%,100% { box-shadow: 0 0 0 0 rgba(255,165,0,0.5); }
          50%     { box-shadow: 0 0 0 14px rgba(255,165,0,0); }
        }
        @keyframes floatBadge {
          0%,100% { transform: translateY(0px); }
          50%     { transform: translateY(-5px); }
        }
        @keyframes countdownShrink {
          from { stroke-dashoffset: 0; }
          to   { stroke-dashoffset: ${circumference}; }
        }
        .coin-particle {
          position: absolute;
          top: 0;
          pointer-events: none;
          animation: coinFall linear infinite;
          will-change: transform, opacity;
          user-select: none;
        }
        .popup-card {
          animation: popIn 0.38s cubic-bezier(0.34,1.56,0.64,1) forwards;
        }
        .shimmer-text {
          background: linear-gradient(90deg,#fff 0%,#ffd700 40%,#ff8c00 60%,#fff 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 2s linear infinite;
        }
        .pulse-ring { animation: pulseRing 1.6s ease-in-out infinite; }
        .float-badge { animation: floatBadge 2.4s ease-in-out infinite; }
      `}</style>

      {/* ── Backdrop ── */}
      <div
        className="fixed inset-0 z-[80] flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(6px)" }}
        onClick={onClose}
      >
        {/* ── Coin rain (win only) ── */}
        {bet.isWin && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {COINS.map(c => <CoinParticle key={c.id} coin={c} />)}
          </div>
        )}

        {/* ── Card ── */}
        <div
          className="popup-card relative w-full max-w-[320px] rounded-3xl overflow-hidden"
          style={{
            boxShadow: bet.isWin
              ? "0 0 0 1px rgba(255,165,0,0.3), 0 32px 64px rgba(0,0,0,0.7), 0 0 80px rgba(255,140,0,0.25)"
              : "0 0 0 1px rgba(255,255,255,0.08), 0 32px 64px rgba(0,0,0,0.7)",
          }}
          onClick={e => e.stopPropagation()}
        >

          {/* ══ WIN HEADER ══ */}
          {bet.isWin ? (
            <div
              className="relative flex flex-col items-center pt-8 pb-12 overflow-hidden"
              style={{
                background: "linear-gradient(160deg, #ff8c00 0%, #ff5500 45%, #cc2200 100%)",
              }}
            >
              {/* Radial glow */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: "radial-gradient(ellipse at 50% 0%, rgba(255,220,80,0.35) 0%, transparent 70%)",
                }}
              />

              {/* Decorative top arc dots */}
              <div className="absolute top-3 left-0 right-0 flex justify-center gap-1.5 opacity-40">
                {[...Array(7)].map((_, i) => (
                  <div key={i} className="w-1 h-1 rounded-full bg-white" />
                ))}
              </div>

              {/* Trophy / star badge */}
              <div
                className="float-badge pulse-ring w-20 h-20 rounded-full flex items-center justify-center mb-3 relative z-10"
                style={{
                  background: "linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)",
                  border: "3px solid rgba(255,255,255,0.4)",
                }}
              >
                <span style={{ fontSize: 38 }}>🏆</span>
              </div>

              {/* Congratulations */}
              <p className="text-white/80 text-[10px] font-bold uppercase tracking-[0.25em] mb-0.5 z-10">
                Congratulations!
              </p>
              <h2 className="shimmer-text text-3xl font-black tracking-wide z-10">
                You Won!
              </h2>

              {/* Period badge */}
              <div
                className="mt-2 px-3 py-0.5 rounded-full z-10"
                style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.2)" }}
              >
                <span className="text-white/70 text-[10px] font-mono">Period: {bet.period}</span>
              </div>

              {/* Bottom notch cutouts */}
              <div className="absolute bottom-0 left-0 w-5 h-5 rounded-full"
                style={{ background: "#0f0f0f", transform: "translate(-50%, 50%)" }} />
              <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full"
                style={{ background: "#0f0f0f", transform: "translate(50%, 50%)" }} />
              {/* Dashed divider */}
              <div className="absolute bottom-0 left-5 right-5 border-t border-dashed border-white/20" />
            </div>

          ) : (
            /* ══ LOSS HEADER ══ */
            <div
              className="relative flex flex-col items-center pt-8 pb-12 overflow-hidden"
              style={{ background: "linear-gradient(160deg, #1f2937 0%, #111827 100%)" }}
            >
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.04) 0%, transparent 70%)" }} />

              <div
                className="w-20 h-20 rounded-full flex items-center justify-center mb-3 relative z-10"
                style={{
                  background: "linear-gradient(135deg, #374151 0%, #1f2937 100%)",
                  border: "3px solid rgba(255,255,255,0.1)",
                }}
              >
                <span style={{ fontSize: 38 }}>😔</span>
              </div>

              <p className="text-white/50 text-[10px] font-bold uppercase tracking-[0.2em] mb-0.5 z-10">
                Better Luck Next Time
              </p>
              <h2 className="text-white text-3xl font-black tracking-wide z-10">Sorry!</h2>

              <div className="mt-2 px-3 py-0.5 rounded-full z-10"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <span className="text-white/40 text-[10px] font-mono">Period: {bet.period}</span>
              </div>

              <div className="absolute bottom-0 left-0 w-5 h-5 rounded-full"
                style={{ background: "#0f0f0f", transform: "translate(-50%, 50%)" }} />
              <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full"
                style={{ background: "#0f0f0f", transform: "translate(50%, 50%)" }} />
              <div className="absolute bottom-0 left-5 right-5 border-t border-dashed border-white/10" />
            </div>
          )}

          {/* ══ BODY ══ */}
          <div
            className="px-5 pt-5 pb-4 space-y-3"
            style={{ background: "#0f0f0f" }}
          >

            {/* ── Lottery Result row ── */}
            <div
              className="flex items-center justify-between rounded-2xl px-4 py-3"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">
                Lottery Result
              </span>
              <div className="flex items-center gap-2.5">
                <ResultBall number={bet.resultNumber} size="md" />
                <div className="flex flex-col items-end gap-0.5">
                  <span className={`text-[11px] font-black capitalize ${colorLabel}`}>
                    {bet.resultColor}
                  </span>
                  <span className={`text-[10px] font-bold ${bet.resultSize === "Big" ? "text-[#fba846]" : "text-[#5c9df5]"}`}>
                    {bet.resultSize}
                  </span>
                </div>
              </div>
            </div>

            {bet.isWin ? (
              <>
                {/* ── Bonus amount (if any) ── */}
                {bonus > 0 && (
                  <div
                    className="flex items-center justify-between rounded-2xl px-4 py-3"
                    style={{ background: "rgba(255,140,0,0.08)", border: "1px solid rgba(255,140,0,0.2)" }}
                  >
                    <span className="text-orange-400/70 text-[10px] font-bold uppercase tracking-wider">
                      Bonus
                    </span>
                    <span className="text-orange-400 text-sm font-black">
                      +Rs {bonus.toFixed(2)}
                    </span>
                  </div>
                )}

                {/* ── Total Win Amount — hero row ── */}
                <div
                  className="flex items-center justify-between rounded-2xl px-4 py-4"
                  style={{
                    background: "linear-gradient(135deg, rgba(255,140,0,0.18) 0%, rgba(255,60,0,0.12) 100%)",
                    border: "1px solid rgba(255,140,0,0.35)",
                  }}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-orange-400/70 text-[10px] font-bold uppercase tracking-wider">
                      Total Win Amount
                    </span>
                    <span className="text-gray-500 text-[9px]">
                      Bet Rs {bet.amount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span
                      className="text-2xl font-black"
                      style={{
                        background: "linear-gradient(90deg, #ffd700, #ff8c00)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                      }}
                    >
                      +Rs {totalWin.toFixed(2)}
                    </span>
                    <span className="text-[#2ed573] text-[10px] font-bold">
                      Profit +Rs {profit.toFixed(2)}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              /* ── Loss body ── */
              <div
                className="flex flex-col items-center justify-center rounded-2xl px-4 py-4 gap-1"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <span className="text-gray-600 text-[10px] font-bold uppercase tracking-wider">
                  Amount Lost
                </span>
                <span className="text-red-500 text-xl font-black">
                  -Rs {bet.amount.toFixed(2)}
                </span>
                <span className="text-gray-600 text-[10px] mt-0.5">
                  No bonus this round — try again!
                </span>
              </div>
            )}

            {/* ── Footer: countdown + close ── */}
            <div className="flex items-center justify-between pt-1">
              {/* Countdown ring */}
              <button
                className="flex items-center gap-2 group"
                onClick={() => { setPaused(v => !v); if (paused) setSecondsLeft(AUTO_CLOSE_SECS); }}
              >
                <div className="relative w-9 h-9">
                  <svg className="w-9 h-9 -rotate-90" viewBox="0 0 40 40">
                    <circle cx="20" cy="20" r={R} fill="none"
                      stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                    {!paused && (
                      <circle cx="20" cy="20" r={R} fill="none"
                        stroke={bet.isWin ? "#ff8c00" : "#4b5563"}
                        strokeWidth="3"
                        strokeDasharray={circumference}
                        strokeDashoffset={dashOffset}
                        strokeLinecap="round"
                        style={{ transition: "stroke-dashoffset 1s linear" }}
                      />
                    )}
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-white text-[10px] font-black">
                    {paused ? "⏸" : secondsLeft}
                  </span>
                </div>
                <span className="text-gray-600 text-[10px] group-hover:text-gray-400 transition-colors">
                  {paused ? "Paused" : `Auto-close`}
                </span>
              </button>

              {/* Close button */}
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-bold transition-all"
                style={{
                  background: bet.isWin
                    ? "linear-gradient(135deg, #ff8c00, #ff5500)"
                    : "rgba(255,255,255,0.08)",
                  color: "white",
                  border: bet.isWin ? "none" : "1px solid rgba(255,255,255,0.12)",
                }}
              >
                <X className="w-3 h-3" />
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
