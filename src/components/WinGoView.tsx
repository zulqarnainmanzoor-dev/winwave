import { useState, useEffect } from "react";
import {
  ChevronLeft,
  Volume2,
  VolumeX,
  History,
  BarChart2,
  User,
  Wallet,
  HeadphonesIcon,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Copy,
} from "lucide-react";
import { useUser } from "../context/UserContext";
import { useLanguage } from "../context/LanguageContext";

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
  const { thirdPartyWalletBalance, setThirdPartyWalletBalance, addWageringProgress, totalBalance } = useUser();
  const [isMuted, setIsMuted] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
        setShowBetModal(false); // Close modal when time is up
      } else {
        setIsTimeUp(false);
      }

      // Generate history for the last 10 rounds
      const newHistory = [];
      for (let i = 1; i <= 10; i++) {
        const histRound = roundNumber - i;
        if (histRound > 0) {
          const histPeriod = `${dateStr}${prefix}${String(histRound).padStart(5, "0")}`;
          newHistory.push({
            period: histPeriod,
            ...getResultForPeriod(histPeriod),
          });
        }
      }
      setHistory(newHistory);

      if (currentPeriod !== period) {
        setPeriod(currentPeriod);
      }
    };

    updateGame(); // Initial run
    const timer = setInterval(updateGame, 1000);
    return () => clearInterval(timer);
  }, [activeTab, period]);

  useEffect(() => {
    if (history.length > 0) {
      const latestResult = history[0];
      setMyBets((prev) => {
        let hasUpdates = false;
        let latestResolvedBet = null;
        let totalWinAmount = 0;

        const newBets = prev.map((bet) => {
          // If the bet is for the period that just ended and is pending
          if (bet.status === "pending" && bet.period === latestResult.period) {
            hasUpdates = true;
            let isWin = false;
            // Base multiplier applied to the after-tax stake, matching the
            // advertised "How to play" payouts:
            //   color full 2x, color partial (green on 5 / red on 0) 1.5x,
            //   violet 4.5x, exact number 9x, big/small 2x.
            let multiplier = 0;
            const resultNumber = latestResult.number;

            if (bet.type === "size") {
              if (bet.value === latestResult.size) {
                isWin = true;
                multiplier = 2;
              }
            } else if (bet.type === "number") {
              if (Number(bet.value) === resultNumber) {
                isWin = true;
                multiplier = 9;
              }
            } else if (bet.type === "color") {
              if (bet.value === "Green") {
                if (resultNumber === 5) {
                  isWin = true;
                  multiplier = 1.5; // 5 is green+violet -> partial payout
                } else if (latestResult.color === "green") {
                  isWin = true;
                  multiplier = 2;
                }
              } else if (bet.value === "Red") {
                if (resultNumber === 0) {
                  isWin = true;
                  multiplier = 1.5; // 0 is red+violet -> partial payout
                } else if (latestResult.color === "red") {
                  isWin = true;
                  multiplier = 2;
                }
              } else if (bet.value === "Violet") {
                if (latestResult.color === "violet") {
                  isWin = true;
                  multiplier = 4.5;
                }
              }
            }

            // amountAfterTax already has the 2% service fee removed.
            const stakeAfterTax =
              bet.amountAfterTax != null ? bet.amountAfterTax : bet.amount * 0.98;
            const winAmount = isWin ? stakeAfterTax * multiplier : 0;
            if (isWin) {
              totalWinAmount += winAmount;
            }

            const resolvedBet = {
              ...bet,
              status: isWin ? "win" : "lose",
              isWin,
              winAmount,
              resultNumber: latestResult.number,
              resultColor: latestResult.color,
              resultSize: latestResult.size,
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
          playSound(latestResolvedBet.isWin ? "win" : "lose");
        }

        if (totalWinAmount > 0) {
          setThirdPartyWalletBalance(thirdPartyWalletBalance + totalWinAmount);
        }

        return hasUpdates ? newBets : prev;
      });
    }
  }, [history, activeTab, thirdPartyWalletBalance, setThirdPartyWalletBalance]);

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

  const playSound = (type: "click" | "win" | "lose" | "cash") => {
    if (isMuted) return;

    try {
      const AudioContext =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "click") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === "win") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.setValueAtTime(600, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(800, ctx.currentTime + 0.2);
        osc.frequency.setValueAtTime(1200, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      } else if (type === "lose") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      } else if (type === "cash") {
        osc.type = "square";
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.setValueAtTime(1200, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      }
    } catch (e) {
      console.log("Audio playback failed", e);
    }
  };

  const handleBetSelect = (type: string, value: string | number) => {
    if (isTimeUp || isRandomizing) return;
    playSound("click");
    setSelectedBet({ type, value });
    setBetAmount(1);
    setBetQuantity(1);
    setBetMultiplier(1);
    setShowBetModal(true);
  };

  const handlePlaceBet = () => {
    const total = betAmount * betQuantity * betMultiplier;
    if (thirdPartyWalletBalance < total) {
      alert("Insufficient game wallet balance. Transfer funds from ARWallet first.");
      return;
    }

    playSound("cash");
    setThirdPartyWalletBalance(thirdPartyWalletBalance - total);
    addWageringProgress(total);
    setMyBets((prev) => [
      {
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
      },
      ...prev,
    ]);
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
    <div className="flex-1 flex flex-col bg-[#1A1A1D] h-screen overflow-y-auto pb-20 relative">
      {/* Header */}
      <div className="flex items-center justify-between p-4 sticky top-0 bg-[#1A1A1D] z-40 border-b border-white/5">
        <ChevronLeft
          className="w-6 h-6 text-white cursor-pointer"
          onClick={onBack}
        />
        <div className="flex items-center justify-center flex-1">
          <img
            src="/assets/gameCategories/vip.webp"
            alt="WinWave"
            className="h-6 object-contain"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              e.currentTarget.nextElementSibling?.classList.remove("hidden");
            }}
          />
          {/* Fallback text logo with orange flash */}
          <span className="hidden">
            <span className="text-[#F59E0B] font-black text-lg tracking-widest uppercase relative">
              <span className="absolute -top-1 -left-1 text-amber-500 opacity-40 blur-[1px]">WinWave</span>
              <span className="relative inline-block animate-pulseOrange">
                <span className="translate-y-[-2px]">WinWave</span>
              </span>
            </span>
          </span>
        </div>
        <div className="flex gap-4">
          <HeadphonesIcon className="w-5 h-5 text-gray-400 cursor-pointer" />
          {isMuted ? (
            <VolumeX
              className="w-5 h-5 text-gray-400 cursor-pointer"
              onClick={() => setIsMuted(false)}
            />
          ) : (
            <Volume2
              className="w-5 h-5 text-gray-400 cursor-pointer"
              onClick={() => setIsMuted(true)}
            />
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Wallet Card */}
        <div className="bg-[#2B2735] rounded-xl p-5 shadow-lg border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl"></div>

          <div className="flex flex-col items-center justify-center relative z-10 mb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-white font-bold text-2xl">
                Rs.{thirdPartyWalletBalance.toFixed(2)}
              </span>
              <RefreshCw
                className={`w-4 h-4 text-gray-400 cursor-pointer hover:text-white transition-colors ${isRefreshing ? "animate-spin" : ""}`}
                onClick={() => {
                  setIsRefreshing(true);
                  setTimeout(() => setIsRefreshing(false), 1000);
                }}
              />
            </div>
            <div className="flex items-center gap-2 text-amber-500 text-xs font-bold bg-amber-500/10 px-3 py-1 rounded-full">
              <Wallet className="w-3 h-3" />
              Game wallet balance
            </div>
          </div>

          <div className="flex gap-4 relative z-10">
            <button className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-full transition-colors shadow-md text-sm" onClick={() => {}}>\r\n              Withdraw\r\n            </button>
            <button className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-full transition-colors shadow-md text-sm">
              Deposit
            </button>
          </div>
        </div>

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

        {/* Time Tabs */}
        <div className="bg-[#2B2735] rounded-xl p-2 flex border border-white/5 shadow-sm">
          {["Win Go 30s", "Win Go 1Min", "Win Go 3Min", "Win Go 5Min"].map(
            (tab) => (
              <div
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 flex flex-col items-center justify-center py-2 rounded-lg cursor-pointer transition-colors ${
                  activeTab === tab
                    ? "bg-gradient-to-b from-[#fcd34d] to-[#fbbf24] text-black"
                    : "text-gray-400 hover:bg-white/5"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${activeTab === tab ? "bg-white/20" : "bg-gray-600"}`}
                >
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${activeTab === tab ? "border-black/50 text-black/50" : "border-gray-400"}`}
                  >
                    {/* Clock hands simulation */}
                    <div className="w-2 h-2 relative">
                      <div
                        className={`absolute top-0 left-1/2 w-0.5 h-1.5 -ml-[0.5px] ${activeTab === tab ? "bg-black/50" : "bg-gray-400"}`}
                      ></div>
                      <div
                        className={`absolute top-1 left-1/2 w-1.5 h-0.5 ${activeTab === tab ? "bg-black/50" : "bg-gray-400"}`}
                      ></div>
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-center leading-tight whitespace-pre-wrap">
                  {tab.replace(" ", "\n")}
                </span>
              </div>
            ),
          )}
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

          <div className="bg-white rounded-xl p-4 mb-4 grid grid-cols-5 gap-3 shadow-inner relative">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
              let colorClass = "";
              if (num === 0 || num === 5) {
                colorClass = "from-purple-500 to-purple-400";
              } else if (num % 2 === 0) {
                colorClass = "from-red-500 to-red-400";
              } else {
                colorClass = "from-green-500 to-green-400";
              }

              const isHighlighted = highlightedNumber === num;

              return (
                <button
                  key={num}
                  onClick={() => handleBetSelect("number", num)}
                  className={`aspect-square rounded-full flex items-center justify-center bg-gradient-to-br ${colorClass} text-white font-bold text-lg shadow-md transition-all ${isHighlighted ? "scale-125 z-10 shadow-xl ring-4 ring-white" : "hover:scale-105"}`}
                >
                  {num}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mb-4 gap-2">
            <button
              onClick={handleRandomBet}
              className="border border-[#ff4757] text-[#ff4757] px-3 py-1.5 rounded-md text-xs font-bold hover:bg-[#ff4757]/10 transition-colors bg-white"
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
                      <div className="flex justify-center items-center text-white">{row.period}</div>
                      <div
                        className={`flex justify-center items-center font-black text-lg ${
                          row.color === "red"
                            ? "text-red-500"
                            : row.color === "green"
                              ? "text-green-500"
                              : "text-purple-500"
                        }`}
                      >
                        {row.number}
                      </div>
                      <div className="flex justify-center items-center text-white">{row.size}</div>
                      <div className="flex justify-center items-center">
                        <div
                          className={`w-3 h-3 rounded-full ${
                            row.color === "red"
                              ? "bg-red-500"
                              : row.color === "green"
                                ? "bg-green-500"
                                : "bg-purple-500"
                          }`}
                        ></div>
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
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white rounded-t-3xl overflow-hidden animate-in slide-in-from-bottom-full duration-300">
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
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
              <div
                className={`p-6 text-center ${resultPopup.isWin ? "bg-gradient-to-br from-[#2ed573] to-green-600" : "bg-gradient-to-br from-gray-500 to-gray-700"}`}
              >
                <h2 className="text-white text-3xl font-bold uppercase tracking-wider mb-2">
                  {resultPopup.isWin ? "WINNER" : "SORRY"}
                </h2>
                <p className="text-white/80 font-medium">
                  Period: {resultPopup.period}
                </p>
              </div>

              <div className="p-6 bg-white text-center flex flex-col items-center">
                <div className="flex gap-2 justify-center items-center mb-6">
                  <span className="text-gray-500 font-medium">Result:</span>
                  <div className="flex gap-1 items-center font-bold">
                    <span className="text-gray-800 text-lg">
                      {resultPopup.resultNumber}
                    </span>
                    <span
                      className={
                        resultPopup.resultColor === "red"
                          ? "text-[#ff4757]"
                          : resultPopup.resultColor === "green"
                            ? "text-[#2ed573]"
                            : "text-[#9c27b0]"
                      }
                    >
                      {resultPopup.resultColor.charAt(0).toUpperCase() +
                        resultPopup.resultColor.slice(1)}
                    </span>
                    <span
                      className={
                        resultPopup.resultSize === "Big"
                          ? "text-[#fba846]"
                          : "text-[#5c9df5]"
                      }
                    >
                      {resultPopup.resultSize}
                    </span>
                  </div>
                </div>

                {resultPopup.isWin ? (
                  <div className="flex flex-col items-center gap-1 mb-6">
                    <span className="text-gray-500">Bonus</span>
                    <span className="text-3xl font-bold text-[#2ed573]">
                      +{resultPopup.winAmount.toFixed(2)}
                    </span>
                    <span className="text-sm text-gray-400">
                      Profit: +
                      {(resultPopup.winAmount - resultPopup.amount).toFixed(2)}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 mb-6">
                    <span className="text-gray-500">Loss</span>
                    <span className="text-3xl font-bold text-gray-500">
                      -{resultPopup.amount.toFixed(2)}
                    </span>
                  </div>
                )}

                <button
                  onClick={() => setResultPopup(null)}
                  className="w-full bg-[#1A1A1D] text-white font-bold py-3 rounded-xl hover:bg-black transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
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
