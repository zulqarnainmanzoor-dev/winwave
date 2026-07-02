import { useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronLeft,
  Volume2,
  VolumeX,
  History,
  HeadphonesIcon,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Copy,
} from "lucide-react";
import { useUser } from "../context/UserContext";
import { useLanguage } from "../context/LanguageContext";
import { useSound } from "../hooks/useSound";
import { usePlatformName } from "../hooks/usePlatformName";
import { WinGoResultPopup } from "./WinGoResultPopup";
import { ResultBall } from "./ResultBall";
import { ColorDot } from "./ResultBall";
import { supabase } from "../lib/supabaseClient";

// Simple deterministic RNG based on period string
function getResultForPeriod(periodStr: string) {
  let hash = 0;
  for (let i = 0; i < periodStr.length; i++) {
    hash = (Math.imul(31, hash) + periodStr.charCodeAt(i)) | 0;
  }
  let t = (hash += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const randomVal = ((t ^ (t >>> 14)) >>> 0) / 4294967296;

  const number = Math.floor(randomVal * 10);
  const size = number >= 5 ? "Big" : "Small";
  const color =
    number === 0 || number === 5
      ? "violet"
      : number % 2 === 0
        ? "red"
        : "green";

  return { number, size, color };
}

// Calculate current round data based on real time
const getCurrentRoundData = (intervalSeconds: number) => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const dateStr = `${yyyy}${mm}${dd}`;

  const secondsSinceMidnight =
    now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  const roundNumber = Math.floor(secondsSinceMidnight / intervalSeconds) + 1;
  const roundStr = String(roundNumber).padStart(5, "0");

  let prefix = "1000";
  if (intervalSeconds === 60) prefix = "2000";
  if (intervalSeconds === 180) prefix = "3000";
  if (intervalSeconds === 300) prefix = "4000";

  const period = `${dateStr}${prefix}${roundStr}`;
  const timeLeft = intervalSeconds - (secondsSinceMidnight % intervalSeconds);

  return { period, timeLeft, roundNumber, dateStr, prefix };
};

export default function WinGoView({ onBack }: { onBack: () => void }) {
  const { t } = useLanguage();
  const { thirdPartyWalletBalance, setThirdPartyWalletBalance, addWageringProgress, wageringRequired, wageringCompleted } = useUser();
  const { isMuted, toggleMute, play } = useSound();
  const platformName = usePlatformName("WinWave");
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Track which seconds (5,4,3,2,1) have already fired a tick for the current period+tab
  const tickFiredRef = useRef<Set<string>>(new Set());

  const [timeLeft, setTimeLeft] = useState(30);
  const [period, setPeriod] = useState("");
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState("Win Go 30s");
  const [activeHistoryTab, setActiveHistoryTab] = useState("Game history");
  const [isRandomizing, setIsRandomizing] = useState(false);
  const [highlightedNumber, setHighlightedNumber] = useState<number | null>(
    null,
  );
  const [showBetModal, setShowBetModal] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [selectedBet, setSelectedBet] = useState<{
    type: string;
    value: string | number;
  }>({ type: "number", value: 0 });
  const [betAmount, setBetAmount] = useState<number>(1);
  const [betQuantity, setBetQuantity] = useState<number>(1);
  const [betMultiplier, setBetMultiplier] = useState<number>(1);
  const [myBets, setMyBets] = useState<any[]>([]);
  const [expandedBetId, setExpandedBetId] = useState<string | null>(null);
  const [resultPopup, setResultPopup] = useState<any | null>(null);
  // Admin-injected target result from DB (null = auto)
  const targetResultRef = useRef<string | null>(null);
  const roundIdRef      = useRef<string | null>(null);

  // ── Register round in DB + subscribe to target_result changes ───
  const getMode = (tab: string) => {
    if (tab === "Win Go 1Min") return "1m";
    if (tab === "Win Go 3Min") return "3m";
    if (tab === "Win Go 5Min") return "5m";
    return "30s";
  };

  // ── Build local RNG history (instant fallback, always 10 rows) ──
  const buildLocalHistory = useCallback((currentPeriod: string, intervalSeconds: number) => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}`;
    let prefix = "1000";
    if (intervalSeconds === 60)  prefix = "2000";
    if (intervalSeconds === 180) prefix = "3000";
    if (intervalSeconds === 300) prefix = "4000";
    const secs = now.getHours()*3600 + now.getMinutes()*60 + now.getSeconds();
    const currentRoundNum = Math.floor(secs / intervalSeconds) + 1;
    const rows = [];
    for (let i = 1; i <= 10; i++) {
      const rn = currentRoundNum - i;
      if (rn <= 0) continue;
      const p = `${dateStr}${prefix}${String(rn).padStart(5,"0")}`;
      rows.push({ period: p, ...getResultForPeriod(p) });
    }
    return rows;
  }, []);

  // ── Fetch last 10 completed rounds from DB; fall back to local RNG ──
  const fetchHistory = useCallback(async (currentPeriod: string, intervalSeconds: number) => {
    try {
      const { data, error } = await supabase
        .from("game_rounds")
        .select("period,result_number,result_size,result_color")
        .eq("game_type", "wingo")
        .eq("mode", getMode(activeTab))
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(10);

      if (!error && data && data.length > 0) {
        setHistory(data.map((r: any) => ({
          period: r.period,
          number: r.result_number,
          size:   r.result_size,
          color:  r.result_color,
        })));
      } else {
        // DB empty or error — use deterministic local RNG so history is never blank
        setHistory(buildLocalHistory(currentPeriod, intervalSeconds));
      }
    } catch {
      setHistory(buildLocalHistory(currentPeriod, intervalSeconds));
    }
  }, [activeTab, buildLocalHistory]);

  // Fetch history on tab change + every new period
  useEffect(() => {
    const intervalSeconds = activeTab === "Win Go 1Min" ? 60 : activeTab === "Win Go 3Min" ? 180 : activeTab === "Win Go 5Min" ? 300 : 30;
    void fetchHistory(period, intervalSeconds);
  }, [activeTab, period, fetchHistory]);

  // ── Sync with server-side active round (DB is authoritative) ───
  const upsertRound = useCallback(async (currentPeriod: string, _endsAt: Date) => {
    try {
      const { data } = await supabase.rpc("get_active_round", {
        p_game_type: "wingo",
        p_mode:      getMode(activeTab),
      });
      if (data?.[0]) {
        roundIdRef.current      = data[0].id;
        targetResultRef.current = data[0].target_result ?? null;
      }
    } catch { /* non-critical */ }
  }, [activeTab]);

  // Realtime listener: when admin sets target_result, update our ref
  useEffect(() => {
    if (!period) return;
    const channel = supabase
      .channel(`wingo-round-${period}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_rounds",
          filter: `period=eq.${period}` },
        (payload) => {
          targetResultRef.current = (payload.new as any)?.target_result ?? null;
        }
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [period]);

  // Hide BottomNav while bet modal or result popup is open
  useEffect(() => {
    const nav = document.querySelector('[data-bottomnav]') as HTMLElement | null;
    if (nav) nav.style.display = (showBetModal || !!resultPopup) ? 'none' : '';
    return () => {
      const n = document.querySelector('[data-bottomnav]') as HTMLElement | null;
      if (n) n.style.display = '';
    };
  }, [showBetModal, resultPopup]);

  useEffect(() => {
    const getIntervalSeconds = (tab: string) => {
      switch (tab) {
        case "Win Go 1Min":
          return 60;
        case "Win Go 3Min":
          return 180;
        case "Win Go 5Min":
          return 300;
        default:
          return 30;
      }
    };

    const updateGame = () => {
      const intervalSeconds = getIntervalSeconds(activeTab);
      const {
        period: currentPeriod,
        timeLeft: currentRemaining,
        roundNumber,
        dateStr,
        prefix,
      } = getCurrentRoundData(intervalSeconds);

      setTimeLeft(currentRemaining);

      if (currentRemaining <= 5) {
        setIsTimeUp(true);
        setShowBetModal(false);
        // Fire a tick at each of 5,4,3,2,1 — once per second per period+tab
        if (currentRemaining >= 1 && currentRemaining <= 5) {
          const tickKey = `${currentPeriod}-${activeTab}-${currentRemaining}`;
          if (!tickFiredRef.current.has(tickKey)) {
            tickFiredRef.current.add(tickKey);
            play("tick");
            // Prune old keys to avoid unbounded growth
            if (tickFiredRef.current.size > 50) tickFiredRef.current.clear();
          }
        }
      } else {
        setIsTimeUp(false);
      }

      if (currentPeriod !== period) {
        setPeriod(currentPeriod);
        // Register new round in DB (fire-and-forget)
        const endsAt = new Date(Date.now() + currentRemaining * 1000);
        void upsertRound(currentPeriod, endsAt);
      }
    };

    updateGame(); // Initial run
    const timer = setInterval(updateGame, 1000);
    return () => clearInterval(timer);
  }, [activeTab, period]);

  // Track the last period we resolved bets for — prevents re-resolving on history refresh
  const lastResolvedPeriodRef = useRef<string>("");

  useEffect(() => {
    if (history.length === 0) return;
    const latestResult = history[0];
    // Only resolve once per period, and only for periods that have actually ended
    if (!latestResult.period || latestResult.period === lastResolvedPeriodRef.current) return;
    // Don't resolve if this is the current live period (still active)
    if (latestResult.period === period) return;
    lastResolvedPeriodRef.current = latestResult.period;

      // Apply admin-forced target_result at resolution time
      const forced = targetResultRef.current; // 'BIG' | 'SMALL' | 'NUM:X' | null
      let effectiveResult = { ...latestResult };
      if (forced === "BIG" && latestResult.size !== "Big") {
        // Safe Big range: 6-9 (avoids 5=violet)
        const bigNum = [6, 7, 8, 9][latestResult.number % 4];
        effectiveResult = {
          number: bigNum,
          size:   "Big",
          color:  bigNum % 2 === 0 ? "red" : "green",
          period: latestResult.period,
        };
      } else if (forced === "SMALL" && latestResult.size !== "Small") {
        // Safe Small range: 1-4 (avoids 0=violet)
        const smallNum = [1, 2, 3, 4][latestResult.number % 4];
        effectiveResult = {
          number: smallNum,
          size:   "Small",
          color:  smallNum % 2 === 0 ? "red" : "green",
          period: latestResult.period,
        };
      } else if (forced?.startsWith("NUM:")) {
        // Exact number forced via chat command
        const exactNum = parseInt(forced.slice(4), 10);
        if (!isNaN(exactNum) && exactNum >= 0 && exactNum <= 9) {
          effectiveResult = {
            number: exactNum,
            size:   exactNum >= 5 ? "Big" : "Small",
            color:  exactNum === 0 || exactNum === 5 ? "violet" : exactNum % 2 === 0 ? "red" : "green",
            period: latestResult.period,
          };
        }
      }
      // Clear the forced target after consuming it
      if (forced) targetResultRef.current = null;

      setMyBets((prev) => {
        let hasUpdates = false;
        let latestResolvedBet = null;
        let totalWinAmount = 0;

        const newBets = prev.map((bet) => {
          // If the bet is for the period that just ended and is pending
          if (bet.status === "pending" && bet.period === effectiveResult.period) {
            hasUpdates = true;
            let isWin = false;

            if (bet.type === "size" && bet.value === effectiveResult.size)
              isWin = true;
            if (bet.type === "number" && Number(bet.value) === effectiveResult.number)
              isWin = true;
            if (bet.type === "color") {
              if (bet.value === "Green" && (effectiveResult.color === "green" || effectiveResult.number === 5)) isWin = true;
              if (bet.value === "Red"   && (effectiveResult.color === "red"   || effectiveResult.number === 0)) isWin = true;
              if (bet.value === "Violet" && effectiveResult.color === "violet") isWin = true;
            }

            // For color and size, win is 1.96 * total amount. (Profit is 96%).
            // For numbers, typical win is 9 * total amount.
            const winAmount = isWin
              ? bet.amount * (bet.type === "number" ? 9 : 1.96)
              : 0;
            if (isWin) {
              totalWinAmount += winAmount;
            }

            const resolvedBet = {
              ...bet,
              status: isWin ? "win" : "lose",
              isWin,
              winAmount,
              resultNumber: effectiveResult.number,
              resultColor:  effectiveResult.color,
              resultSize:   effectiveResult.size,
            };

            if (bet.tab === activeTab) {
              latestResolvedBet = resolvedBet;
            }

            return resolvedBet;
          }
          return bet;
        });

        if (latestResolvedBet) {
          setResultPopup(latestResolvedBet);
          play(latestResolvedBet.isWin ? "win" : "lose");
        }

        if (totalWinAmount > 0) {
          setThirdPartyWalletBalance(thirdPartyWalletBalance + totalWinAmount);
        }

        return hasUpdates ? newBets : prev;
      });
  }, [history, period, activeTab, thirdPartyWalletBalance, setThirdPartyWalletBalance]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const timeString = formatTime(timeLeft);
  const digits = timeString.split("");

  const handleRandomBet = () => {
    if (isTimeUp || isRandomizing) return;
    setIsRandomizing(true);
    let count = 0;
    const interval = setInterval(() => {
      setHighlightedNumber(Math.floor(Math.random() * 10));
      count++;
      if (count > 10) {
        clearInterval(interval);
        const finalNum = Math.floor(Math.random() * 10);
        setHighlightedNumber(null);
        setIsRandomizing(false);
        handleBetSelect("number", finalNum);
      }
    }, 100);
  };


  const handleBetSelect = (type: string, value: string | number) => {
    if (isTimeUp || isRandomizing) return;
    play("click");
    setSelectedBet({ type, value });
    setBetAmount(1);
    setBetQuantity(1);
    setBetMultiplier(1);
    setShowBetModal(true);
  };

  const handlePlaceBet = () => {
    const total = betAmount * betQuantity * betMultiplier;
    if (thirdPartyWalletBalance < total) return;

    play("cash");
    setThirdPartyWalletBalance(thirdPartyWalletBalance - total);
    addWageringProgress(total);

    const betRecord = {
      id: `WG${Date.now()}${Math.floor(Math.random() * 100000)}`,
      tab: activeTab,
      type: selectedBet.type,
      period,
      date: new Date().toLocaleString(),
      size: selectedBet.type === "size" ? selectedBet.value : "-",
      value: selectedBet.value,
      amount: total,
      quantity: betQuantity,
      amountAfterTax: total * 0.98,
      tax: total * 0.02,
      isWin: false,
      status: "pending",
    };

    setMyBets((prev) => [betRecord, ...prev]);

    // Persist to betting_history table (fire-and-forget)
    supabase.from("betting_history").insert({
      period,
      game_type: "wingo",
      mode:      getMode(activeTab),
      bet_type:  selectedBet.type,
      bet_value: String(selectedBet.value),
      amount:    total,
      round_id:  roundIdRef.current ?? undefined,
    }).then(({ error }) => { if (error) console.warn("betting_history insert:", error.message); });

    setShowBetModal(false);
  };

  const getModalHeaderClass = () => {
    if (selectedBet.type === "color") {
      if (selectedBet.value === "Green") return "bg-[#2ed573]";
      if (selectedBet.value === "Violet") return "bg-[#9c27b0]";
      if (selectedBet.value === "Red") return "bg-[#ff4757]";
    }
    if (selectedBet.type === "size") {
      if (selectedBet.value === "Big") return "bg-[#fba846]";
      if (selectedBet.value === "Small") return "bg-[#5c9df5]";
    }
    if (selectedBet.type === "number") {
      const num = Number(selectedBet.value);
      if (num === 0) return "bg-gradient-to-r from-[#9c27b0] to-[#ff4757]";
      if (num === 5) return "bg-gradient-to-r from-[#9c27b0] to-[#2ed573]";
      if ([1, 3, 7, 9].includes(num)) return "bg-[#2ed573]";
      if ([2, 4, 6, 8].includes(num)) return "bg-[#ff4757]";
    }
    return "bg-[#ff4757]";
  };

  return (
    <div className="flex-1 flex flex-col bg-[#1A1A1D] min-h-screen overflow-y-auto pb-20 relative">
      {/* Header */}
      <div className="flex items-center justify-between p-4 sticky top-0 bg-[#1A1A1D] z-40 border-b border-white/5">
        <ChevronLeft
          className="w-6 h-6 text-white cursor-pointer"
          onClick={onBack}
        />
        {/* Dynamic platform name from Supabase platform_settings */}
        <span className="text-[#ffa502] font-black text-lg tracking-widest uppercase">
          {platformName}
        </span>
        <div className="flex gap-4 items-center">
          <HeadphonesIcon className="w-5 h-5 text-gray-400 cursor-pointer" />
          <img
            src="/assets/svg/icon_sevice.png"
            alt="support"
            className="w-5 h-5 cursor-pointer"
            style={{ filter: "brightness(0) saturate(100%) invert(62%) sepia(97%) saturate(1200%) hue-rotate(1deg) brightness(103%) contrast(104%)" }}
          />
          {isMuted ? (
            <VolumeX className="w-5 h-5 text-gray-400 cursor-pointer" onClick={toggleMute} />
          ) : (
            <Volume2 className="w-5 h-5 text-gray-400 cursor-pointer" onClick={toggleMute} />
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Wallet Card — background image from assets */}
        {(() => {
          const remainingWager = Math.max(0, wageringRequired - wageringCompleted);
          const hasWager = remainingWager > 0;
          return (
            <div
              className="rounded-xl overflow-hidden shadow-lg relative"
              style={{
                backgroundImage: "url('/assets/svg/WinGoView-walletbg for the balacne background.png')",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              {/* Dark overlay for text readability */}
              <div className="absolute inset-0 bg-black/45" />

              <div className="relative z-10 p-5">
                <div className="flex flex-col items-center justify-center mb-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-bold text-2xl drop-shadow">
                      Rs.{thirdPartyWalletBalance.toFixed(2)}
                    </span>
                    <RefreshCw
                      className={`w-4 h-4 text-white/70 cursor-pointer hover:text-white transition-colors ${isRefreshing ? "animate-spin" : ""}`}
                      onClick={() => { setIsRefreshing(true); setTimeout(() => setIsRefreshing(false), 1000); }}
                    />
                  </div>
                  <span className="text-[#ffa502] text-xs font-bold bg-black/30 px-3 py-0.5 rounded-full">
                    {hasWager ? "Cash Balance" : "Game Wallet"}
                  </span>
                </div>

                {/* Wagering indicator */}
                <div className="flex justify-center mb-3">
                  <span className="text-white/60 text-[10px]">
                    Wager remaining:&nbsp;
                    <span className="text-[#ffa502] font-bold">
                      {hasWager ? `Rs ${remainingWager.toFixed(2)}` : "Rs 0.00"}
                    </span>
                  </span>
                </div>

                <div className="flex gap-4">
                  {/* Withdraw disabled when wager remaining */}
                  <button
                    className={`flex-1 font-bold py-3 rounded-full transition-colors shadow-md text-sm ${
                      hasWager
                        ? "bg-gray-600 text-gray-400 cursor-not-allowed opacity-60"
                        : "bg-[#ff4757] hover:bg-[#ff6b81] text-white"
                    }`}
                    disabled={hasWager}
                    onClick={() => !hasWager && (window.location.hash = "#/withdraw")}
                  >
                    Withdraw
                  </button>
                  <button
                    className="flex-1 bg-[#2ed573] hover:bg-[#7bed9f] text-white font-bold py-3 rounded-full transition-colors shadow-md text-sm"
                    onClick={() => (window.location.hash = "#/deposit")}
                  >
                    Deposit
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Notice Bar */}
        <div className="bg-[#2B2735] rounded-xl p-3 flex items-center justify-between shadow-sm border border-white/5">
          <div className="flex items-center gap-3">
            <Volume2 className="w-5 h-5 text-amber-500" />
            <span className="text-white/80 text-xs truncate max-w-[200px]">
                Welcome to WINWAVE platform, we will serve you wholeheartedly!
              </span>
          </div>
          <button className="bg-gradient-to-r from-[#fcd34d] to-[#fbbf24] text-black text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap">
            Detail
          </button>
        </div>

        {/* Time Tabs — PNG icons: time.png (normal) / time_a-orange.png (active) */}
        <div className="bg-[#2B2735] rounded-xl p-2 flex border border-white/5 shadow-sm">
          {["Win Go 30s", "Win Go 1Min", "Win Go 3Min", "Win Go 5Min"].map((tab) => {
            const isActive = activeTab === tab;
            return (
              <div
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 flex flex-col items-center justify-center py-2 rounded-lg cursor-pointer transition-colors ${
                  isActive
                    ? "bg-gradient-to-b from-[#ffa502] to-[#ff7f00] text-white"
                    : "text-gray-400 hover:bg-white/5"
                }`}
              >
                <img
                  src={isActive ? "/assets/svg/time_a-orange.png" : "/assets/svg/time.png"}
                  alt="time"
                  className="w-7 h-7 mb-1 object-contain"
                  style={isActive ? { filter: "drop-shadow(0 0 4px #ffa502)" } : undefined}
                />
                <span className="text-[10px] font-bold text-center leading-tight whitespace-pre-wrap">
                  {tab.replace(" ", "\n")}
                </span>
              </div>
            );
          })}
        </div>

        {/* Play Banner */}
        <div className="bg-gradient-to-r from-[#fbbf24] to-[#fcd34d] rounded-xl p-3 flex relative overflow-hidden">
          <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-[#1A1A1D] rounded-full"></div>
          <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-[#1A1A1D] rounded-full"></div>
          <div className="absolute left-1/2 top-0 bottom-0 w-px border-l-2 border-dashed border-black/10"></div>

          <div className="flex-1 flex flex-col items-center justify-center pr-4">
            <button
              onClick={() => setShowHowToPlay(true)}
              className="border border-black/30 rounded-full px-4 py-1 flex items-center gap-2 mb-2 text-black/70 hover:bg-black/5 transition-colors"
            >
              <History className="w-3 h-3" />
              <span className="text-[10px] font-bold">How to play</span>
            </button>
            <span className="text-black text-[11px] font-bold mb-2">
              Win Go 30s
            </span>

            <div className="flex gap-1 justify-center w-full">
              {[4, 1, 7, 1, 8].map((num, i) => (
                <div
                  key={i}
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-sm bg-gradient-to-br ${
                    num % 2 === 0
                      ? "from-[#ff4757] to-[#ff6b6b]"
                      : "from-[#2ed573] to-[#7bed9f]"
                  }`}
                >
                  {num}
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center pl-4">
            <span className="text-black text-xs font-bold mb-2 text-right w-full">
              Time remaining
            </span>
            <div className="flex gap-1 mb-2">
              {digits.map((d, i) => (
                <div
                  key={i}
                  className={`${d === ":" ? "text-black font-bold pt-1" : "bg-black text-amber-500"} w-6 h-8 rounded flex items-center justify-center text-xl font-mono font-bold shadow-md`}
                >
                  {d}
                </div>
              ))}
            </div>
            <span className="text-black font-black text-sm tracking-widest text-right w-full">
              {period}
            </span>
          </div>
        </div>

        {/* Game Board */}
        <div className="bg-[#2B2735] rounded-xl p-4 border border-white/5 relative">
          {/* Overlay when time is up */}
          {isTimeUp && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-20 rounded-xl flex items-center justify-center gap-4">
              <div className="w-24 h-32 bg-white rounded-xl flex items-center justify-center text-[#5c9df5] text-8xl font-bold shadow-2xl">
                {Math.floor(timeLeft / 10)}
              </div>
              <div className="w-24 h-32 bg-white rounded-xl flex items-center justify-center text-[#5c9df5] text-8xl font-bold shadow-2xl">
                {timeLeft % 10}
              </div>
            </div>
          )}

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => handleBetSelect("color", "Green")}
              className="flex-1 bg-green-600 hover:bg-green-500 text-white py-2.5 rounded-lg font-bold text-sm transition-colors shadow-md shadow-green-900/50"
            >
              Green
            </button>
            <button
              onClick={() => handleBetSelect("color", "Violet")}
              className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-2.5 rounded-lg font-bold text-sm transition-colors shadow-md shadow-purple-900/50"
            >
              Violet
            </button>
            <button
              onClick={() => handleBetSelect("color", "Red")}
              className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-lg font-bold text-sm transition-colors shadow-md shadow-red-900/50"
            >
              Red
            </button>
          </div>

          <div className="bg-[#1A1A1D] rounded-xl p-4 mb-4 grid grid-cols-5 gap-3 shadow-inner relative">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
              const isHighlighted = highlightedNumber === num;
              return (
                <button
                  key={num}
                  onClick={() => handleBetSelect("number", num)}
                  className={`aspect-square flex items-center justify-center transition-all ${
                    isHighlighted
                      ? "scale-125 z-10 drop-shadow-[0_0_8px_rgba(255,165,2,0.9)]"
                      : "hover:scale-110"
                  }`}
                >
                  {/* PNG asset — number already baked into image */}
                  <ResultBall number={num} size="lg" />
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mb-4 gap-2">
            <button
              onClick={handleRandomBet}
              className="border border-[#ffa502] text-[#ffa502] px-3 py-1.5 rounded-md text-xs font-bold hover:bg-[#ffa502]/10 transition-colors bg-white"
            >
              Random
            </button>
            <div className="flex gap-1 flex-1 justify-between">
              {["X1", "X5", "X10", "X20", "X50", "X100"].map((x) => (
                <button
                  key={x}
                  className={`text-[10px] font-bold px-2 py-1.5 rounded-md ${x === "X1" ? "bg-[#2ed573] text-white" : "bg-[#eef2f6] text-[#74839e] hover:bg-gray-200"}`}
                >
                  {x}
                </button>
              ))}
            </div>
          </div>

          <div className="flex rounded-full overflow-hidden shadow-md">
            <button
              onClick={() => handleBetSelect("size", "Big")}
              className="flex-1 bg-[#fba846] hover:bg-[#fba846]/90 text-white py-2.5 font-bold text-sm transition-colors"
            >
              Big
            </button>
            <button
              onClick={() => handleBetSelect("size", "Small")}
              className="flex-1 bg-[#5c9df5] hover:bg-[#5c9df5]/90 text-white py-2.5 font-bold text-sm transition-colors"
            >
              Small
            </button>
          </div>
        </div>

        {/* History Section */}
        <div className="bg-[#2B2735] rounded-xl border border-white/5 overflow-hidden">
          <div className="flex">
            {["Game history", "Chart", "My history"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveHistoryTab(tab)}
                className={`flex-1 py-3 text-xs font-bold transition-colors ${
                  activeHistoryTab === tab
                    ? "bg-gradient-to-r from-[#fbbf24] to-[#fcd34d] text-black"
                    : "text-gray-400 hover:bg-white/5"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="p-0">
            {activeHistoryTab === "Game history" && (
              <>
                {/* Table Header */}
                <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] py-3 bg-[#b45309] text-white font-bold text-xs text-center">
                  <div className="flex justify-center items-center">Period</div>
                  <div className="flex justify-center items-center">Number</div>
                  <div className="flex justify-center items-center">Big Small</div>
                  <div className="flex justify-center items-center">Color</div>
                </div>

                {/* Table Body */}
                <div className="flex flex-col">
                  {history.map((row, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[1.5fr_1fr_1fr_1fr] py-3 border-b border-white/5 text-xs text-center items-center hover:bg-white/5"
                    >
                      <div className="flex justify-center items-center text-white text-[10px] font-mono">{row.period}</div>
                      {/* Number column — ResultBall with correct color split */}
                      <div className="flex justify-center items-center">
                        <ResultBall number={row.number} size="md" />
                      </div>
                      {/* Big/Small column */}
                      <div className="flex justify-center items-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          row.size === "Big" ? "bg-[#fba846]/20 text-[#fba846]" : "bg-[#5c9df5]/20 text-[#5c9df5]"
                        }`}>{row.size}</span>
                      </div>
                      {/* Color column — ColorDot only, no number */}
                      <div className="flex justify-center items-center">
                        <ColorDot
                          color={row.color as "red" | "green" | "violet"}
                          number={row.number}
                          sizePx={16}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {activeHistoryTab === "Chart" && (
              <div className="bg-white pb-4">
                <div className="flex bg-[#5c9df5] text-white font-bold text-xs py-3 rounded-t-lg">
                  <div className="w-1/3 text-center">Period</div>
                  <div className="w-2/3 text-center">Number</div>
                </div>

                {/* Statistics section */}
                <div className="flex flex-col gap-2 p-3 text-xs border-b border-gray-200">
                  <div className="flex justify-between items-center text-gray-500 mb-1">
                    <span className="w-1/3 text-left">Statistic</span>
                    <span className="w-2/3 text-left pl-2">
                      (last 100 Periods)
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="w-1/3 text-left text-gray-600">
                      Winning Numbers
                    </span>
                    <div className="w-2/3 flex justify-between pr-8">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                        <span
                          key={n}
                          className="w-4 h-4 flex items-center justify-center rounded-full border border-[#ff4757] text-[#ff4757] text-[10px]"
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="w-1/3 text-left text-gray-600">
                      Missing
                    </span>
                    <div className="w-2/3 flex justify-between pr-8 text-gray-400">
                      <span className="w-4 text-center">22</span>
                      <span className="w-4 text-center">9</span>
                      <span className="w-4 text-center">11</span>
                      <span className="w-4 text-center">34</span>
                      <span className="w-4 text-center">2</span>
                      <span className="w-4 text-center">3</span>
                      <span className="w-4 text-center">10</span>
                      <span className="w-4 text-center">0</span>
                      <span className="w-4 text-center">1</span>
                      <span className="w-4 text-center">4</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="w-1/3 text-left text-gray-600">
                      Avg missing
                    </span>
                    <div className="w-2/3 flex justify-between pr-8 text-gray-400">
                      <span className="w-4 text-center">6</span>
                      <span className="w-4 text-center">10</span>
                      <span className="w-4 text-center">10</span>
                      <span className="w-4 text-center">8</span>
                      <span className="w-4 text-center">8</span>
                      <span className="w-4 text-center">7</span>
                      <span className="w-4 text-center">8</span>
                      <span className="w-4 text-center">8</span>
                      <span className="w-4 text-center">8</span>
                      <span className="w-4 text-center">7</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="w-1/3 text-left text-gray-600">
                      Frequency
                    </span>
                    <div className="w-2/3 flex justify-between pr-8 text-gray-400">
                      <span className="w-4 text-center">12</span>
                      <span className="w-4 text-center">8</span>
                      <span className="w-4 text-center">8</span>
                      <span className="w-4 text-center">10</span>
                      <span className="w-4 text-center">10</span>
                      <span className="w-4 text-center">11</span>
                      <span className="w-4 text-center">10</span>
                      <span className="w-4 text-center">10</span>
                      <span className="w-4 text-center">10</span>
                      <span className="w-4 text-center">11</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="w-1/3 text-left text-gray-600">
                      Max consecutive
                    </span>
                    <div className="w-2/3 flex justify-between pr-8 text-gray-400">
                      <span className="w-4 text-center">3</span>
                      <span className="w-4 text-center">2</span>
                      <span className="w-4 text-center">1</span>
                      <span className="w-4 text-center">2</span>
                      <span className="w-4 text-center">2</span>
                      <span className="w-4 text-center">2</span>
                      <span className="w-4 text-center">2</span>
                      <span className="w-4 text-center">1</span>
                      <span className="w-4 text-center">1</span>
                      <span className="w-4 text-center">2</span>
                    </div>
                  </div>
                </div>

                {/* History list with line */}
                <div className="relative">
                  <div className="flex flex-col">
                    {history.map((row, i) => (
                      <div
                        key={i}
                        className="flex py-3 border-b border-gray-100 items-center"
                      >
                        <div className="w-1/3 text-gray-600 text-[11px] text-center">
                          {row.period}
                        </div>
                        <div className="w-2/3 flex justify-between items-center pl-2 pr-4 relative z-10">
                          <div className="flex justify-between w-full pr-4">
                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                              <div
                                key={n}
                                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                                  row.number === n
                                    ? row.color === "red"
                                      ? "bg-[#ff4757] text-white"
                                      : row.color === "green"
                                        ? "bg-[#2ed573] text-white"
                                        : "bg-[#9c27b0] text-white"
                                    : "text-gray-300 font-medium"
                                }`}
                              >
                                {n}
                              </div>
                            ))}
                          </div>
                          <div
                            className={`w-4 h-4 flex-shrink-0 rounded-full flex items-center justify-center text-[8px] font-bold text-white ${
                              row.size === "Big"
                                ? "bg-[#fba846]"
                                : "bg-[#5c9df5]"
                            }`}
                          >
                            {row.size === "Big" ? "B" : "S"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Draw connecting lines via absolute divs to avoid SVG complexity */}
                  <svg
                    className="absolute top-0 left-0 w-full h-full pointer-events-none"
                    style={{ zIndex: 0 }}
                  >
                    {history.map((row, i) => {
                      if (i === history.length - 1) return null;
                      const nextRow = history[i + 1];

                      // Exact center coordinates for flex justify-between nodes
                      const startX = `calc(33.33% + 0.5rem + 8px + (66.66% - 2.5rem - 16px) * ${row.number} / 9)`;
                      const startY = `${i * 41 + 20.5}px`;
                      const endX = `calc(33.33% + 0.5rem + 8px + (66.66% - 2.5rem - 16px) * ${nextRow.number} / 9)`;
                      const endY = `${(i + 1) * 41 + 20.5}px`;

                      return (
                        <line
                          key={i}
                          x1={startX}
                          y1={startY}
                          x2={endX}
                          y2={endY}
                          stroke="#ff4757"
                          strokeWidth="1"
                        />
                      );
                    })}
                  </svg>
                </div>
              </div>
            )}

            {activeHistoryTab === "My history" && (
              <div className="flex flex-col gap-2 p-3 bg-white">
                {myBets.filter((b) => b.tab === activeTab).length === 0 ? (
                  <div className="text-center text-gray-500 py-8">No data</div>
                ) : (
                  myBets
                    .filter((b) => b.tab === activeTab)
                    .map((bet, i) => (
                      <div
                        key={i}
                        className="flex flex-col rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden mb-2"
                      >
                        {/* Header row (clickable) */}
                        <div
                          className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
                          onClick={() =>
                            setExpandedBetId(
                              expandedBetId === bet.id ? null : bet.id,
                            )
                          }
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-md ${
                                bet.type === "color"
                                  ? bet.value === "Green"
                                    ? "bg-[#2ed573]"
                                    : bet.value === "Red"
                                      ? "bg-[#ff4757]"
                                      : "bg-[#9c27b0]"
                                  : bet.type === "size"
                                    ? bet.value === "Big"
                                      ? "bg-[#fba846]"
                                      : "bg-[#5c9df5]"
                                    : "bg-gradient-to-br from-purple-500 to-red-500" // number generic
                              }`}
                            >
                              {bet.value}
                            </div>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1 text-black font-bold text-sm">
                                {bet.period}
                                {expandedBetId === bet.id ? (
                                  <ChevronUp className="w-3 h-3 bg-[#ff4757] text-white rounded-[2px]" />
                                ) : (
                                  <ChevronDown className="w-3 h-3 bg-[#ff4757] text-white rounded-[2px]" />
                                )}
                              </div>
                              <span className="text-gray-400 text-xs">
                                {bet.date}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span
                              className={`px-3 py-0.5 rounded text-xs font-bold border ${
                                bet.status === "pending"
                                  ? "text-amber-500 border-amber-500"
                                  : bet.isWin
                                    ? "text-[#2ed573] border-[#2ed573]"
                                    : "text-gray-500 border-gray-500"
                              }`}
                            >
                              {bet.status === "pending"
                                ? "Pending"
                                : bet.isWin
                                  ? "Win"
                                  : "Lose"}
                            </span>
                            <span
                              className={`text-sm font-bold ${bet.status === "pending" ? "text-amber-500" : bet.isWin ? "text-[#2ed573]" : "text-red-500"}`}
                            >
                              {bet.status === "pending"
                                ? ""
                                : bet.isWin
                                  ? "+"
                                  : "-"}
                              Rs
                              {bet.status === "pending"
                                ? bet.amount.toFixed(2)
                                : bet.isWin
                                  ? bet.winAmount.toFixed(2)
                                  : bet.amount.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {expandedBetId === bet.id && (
                          <div className="p-3 border-t border-gray-100 bg-[#f8fafc] text-xs">
                            <div className="font-bold text-black mb-3">
                              Details
                            </div>
                            <div className="space-y-2.5">
                              <div className="flex flex-col bg-[#eef2f6] p-2 rounded">
                                <span className="text-gray-500 mb-1">
                                  Order Number
                                </span>
                                <div className="flex items-center gap-1 font-mono text-gray-700">
                                  {bet.id}{" "}
                                  <Copy className="w-3.5 h-3.5 text-gray-400 cursor-pointer" />
                                </div>
                              </div>

                              <div className="flex justify-between items-center">
                                <span className="text-gray-500">Period</span>
                                <span className="text-gray-700">
                                  {bet.period}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-500">Amount</span>
                                <span className="text-gray-700">
                                  Rs{bet.amount.toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-500">Quantity</span>
                                <span className="text-gray-700">
                                  {bet.quantity}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-500">
                                  Amount After Tax
                                </span>
                                <span className="text-[#ff4757]">
                                  Rs{bet.amountAfterTax.toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-500">Tax</span>
                                <span className="text-gray-700">
                                  Rs{bet.tax.toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-500">Result</span>
                                <div className="flex gap-1 items-center">
                                  {bet.status === "pending" ? (
                                    <span className="text-gray-400">
                                      Pending
                                    </span>
                                  ) : (
                                    <>
                                      <span className="text-gray-700">
                                        {bet.resultNumber}
                                      </span>
                                      <span
                                        className={
                                          bet.resultColor === "red"
                                            ? "text-[#ff4757]"
                                            : bet.resultColor === "green"
                                              ? "text-[#2ed573]"
                                              : "text-[#9c27b0]"
                                        }
                                      >
                                        {bet.resultColor
                                          .charAt(0)
                                          .toUpperCase() +
                                          bet.resultColor.slice(1)}
                                      </span>
                                      <span
                                        className={
                                          bet.resultSize === "Big"
                                            ? "text-[#fba846]"
                                            : "text-[#5c9df5]"
                                        }
                                      >
                                        {bet.resultSize}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-500">Select</span>
                                <span className="text-gray-700">
                                  {bet.value}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-500">Status</span>
                                <span
                                  className={
                                    bet.status === "pending"
                                      ? "text-amber-500"
                                      : bet.isWin
                                        ? "text-[#2ed573]"
                                        : "text-gray-500"
                                  }
                                >
                                  {bet.status === "pending"
                                    ? "Pending"
                                    : bet.isWin
                                      ? "Win"
                                      : "Lose"}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-500">
                                  Win Or Lose
                                </span>
                                <span
                                  className={
                                    bet.status === "pending"
                                      ? "text-amber-500"
                                      : bet.isWin
                                        ? "text-[#2ed573]"
                                        : "text-red-500"
                                  }
                                >
                                  {bet.status === "pending"
                                    ? "Rs0.00"
                                    : bet.isWin
                                      ? "+ Rs" +
                                        (bet.winAmount - bet.amount).toFixed(2)
                                      : "- Rs" + bet.amount.toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-500">
                                  Create Time
                                </span>
                                <span className="text-gray-700">
                                  {bet.date}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                )}

                <div className="flex justify-center items-center gap-4 mt-2">
                  <button className="w-8 h-8 rounded bg-[#1C1C1F] text-gray-500 flex items-center justify-center border border-white/5">
                    &lt;
                  </button>
                  <span className="text-gray-400 text-xs">1/1</span>
                  <button className="w-8 h-8 rounded bg-[#1C1C1F] text-gray-500 flex items-center justify-center border border-white/5">
                    &gt;
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bet Modal */}
        {showBetModal && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowBetModal(false)}
          >
            <div
              className="w-full max-w-md bg-white rounded-t-3xl overflow-hidden animate-in slide-in-from-bottom-full duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className={`${getModalHeaderClass()} p-4 text-center rounded-b-[2rem] shadow-md relative`}
              >
                <h3 className="text-white font-bold text-lg">{activeTab}</h3>
                <div className="bg-white mx-12 py-2 rounded mt-2 shadow-sm">
                  <span className="text-black font-bold">
                    Select {selectedBet.value}
                  </span>
                </div>
              </div>

              <div className="p-6 bg-blue-50/50">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-gray-600 font-medium">Amount</span>
                  <div className="flex gap-2">
                    {[1, 10, 100, 1000].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setBetAmount(amt)}
                        className={`w-12 h-8 rounded flex items-center justify-center font-bold text-sm ${betAmount === amt ? `${getModalHeaderClass()} text-white` : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                      >
                        {amt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center mb-6">
                  <span className="text-gray-600 font-medium">Quantity</span>
                  <div className="flex gap-2 items-center">
                    <button
                      onClick={() =>
                        setBetQuantity(Math.max(1, betQuantity - 1))
                      }
                      className={`w-8 h-8 rounded ${getModalHeaderClass()} text-white flex items-center justify-center font-bold text-lg`}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={betQuantity}
                      onChange={(e) =>
                        setBetQuantity(
                          Math.max(1, parseInt(e.target.value) || 1),
                        )
                      }
                      className="w-16 text-center font-bold text-black border border-gray-200 py-1 bg-white focus:outline-none"
                    />
                    <button
                      onClick={() => setBetQuantity(betQuantity + 1)}
                      className={`w-8 h-8 rounded ${getModalHeaderClass()} text-white flex items-center justify-center font-bold text-lg`}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="flex gap-1 justify-end mb-6">
                  {[1, 5, 10, 20, 50, 100].map((x) => (
                    <button
                      key={x}
                      onClick={() => setBetMultiplier(x)}
                      className={`px-2 py-1.5 rounded text-xs font-bold ${betMultiplier === x ? `${getModalHeaderClass()} text-white` : "bg-[#eef2f6] text-gray-500 hover:bg-gray-200"}`}
                    >
                      X{x}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 mb-6">
                  <input
                    type="checkbox"
                    id="agree"
                    className="w-4 h-4 rounded text-blue-500"
                    defaultChecked
                  />
                  <label htmlFor="agree" className="text-gray-500 text-sm">
                    Agree{" "}
                    <span
                      className={`${selectedBet.type === "color" && selectedBet.value === "Red" ? "text-red-500" : "text-blue-500"}`}
                    >
                      Presale Rules
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex w-full h-14 border-t border-gray-200">
                <button
                  onClick={() => setShowBetModal(false)}
                  className="flex-1 bg-[#f8fafc] text-gray-500 font-bold hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePlaceBet}
                  className={`flex-[2] ${getModalHeaderClass()} text-white font-bold hover:opacity-90 transition-colors`}
                >
                  Total Amount Rs
                  {(betAmount * betQuantity * betMultiplier).toFixed(2)}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Result Popup */}
        {resultPopup && (
          <WinGoResultPopup bet={resultPopup} onClose={() => setResultPopup(null)} />
        )}

        {/* How To Play Popup */}
        {showHowToPlay && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-[#1C1C1F] rounded-2xl w-full max-w-sm overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">
              <div className="bg-gradient-to-b from-[#fcd34d] to-[#fbbf24] p-4 text-center">
                <h2 className="text-black text-xl font-bold">How to play</h2>
              </div>

              <div className="p-5 max-h-[60vh] overflow-y-auto text-sm text-gray-300 space-y-4 font-medium">
                <p>
                  30 sec 1 issue, 25 seconds to order, 5 seconds waiting for the
                  draw. It opens all day. The total number of trade is 2880
                  issues.
                </p>
                <p>
                  If you spend 100 to trade, after deducting 2 service fee, your
                  contract amount is 98:
                </p>
                <p>
                  <span className="text-white">1. Select green:</span> if the
                  result shows 1,3,7,9 you will get (98*2) 196; If the result
                  shows 5, you will get (98*1.5) 147
                </p>
                <p>
                  <span className="text-white">2. Select red:</span> if the
                  result shows 2,4,6,8 you will get (98*2) 196; If the result
                  shows 0, you will get (98*1.5) 147
                </p>
                <p>
                  <span className="text-white">3. Select violet:</span> if the
                  result shows 0 or 5, you will get (98*4.5) 441
                </p>
                <p>
                  <span className="text-white">4. Select number:</span> if the
                  result is the same as the number you selected, you will get
                  (98*9) 882
                </p>
                <p>
                  <span className="text-white">5. Select big:</span> if the
                  result shows 5,6,7,8,9 you will get (98 * 2) 196
                </p>
                <p>
                  <span className="text-white">6. Select small:</span> if the
                  result shows 0,1,2,3,4 you will get (98 * 2) 196
                </p>
              </div>

              <div className="p-4 border-t border-white/10 flex justify-center bg-[#1C1C1F]">
                <button
                  onClick={() => setShowHowToPlay(false)}
                  className="w-3/4 bg-gradient-to-b from-[#fcd34d] to-[#fbbf24] text-black font-bold py-2.5 rounded-full hover:brightness-110 transition-all shadow-lg shadow-amber-500/20"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
