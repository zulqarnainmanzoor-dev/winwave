import { useState, useEffect } from "react";
import { ChevronLeft, Clock, Copy, Check } from "lucide-react";

interface DepositRecord {
  id: string;
  orderId: string;
  method: string;
  amount: number;
  bonus: number;
  status: "Completed" | "Pending" | "Failed";
  date: string;
}

export default function DepositHistoryView({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<"1day" | "7days" | "30days">("1day");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [customDeposits, setCustomDeposits] = useState<DepositRecord[]>([]);

  // Load custom deposits from localStorage (to show newly made deposits too!)
  useEffect(() => {
    try {
      const stored = localStorage.getItem("custom_deposits");
      if (stored) {
        setCustomDeposits(JSON.parse(stored));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Static mock deposits exactly matching the screenshot
  const staticDeposits: DepositRecord[] = [
    {
      id: "dep-1",
      orderId: "RC260628193114Ve523v",
      method: "Jazzcash",
      amount: 18000,
      bonus: 360,
      status: "Completed",
      date: "2026-06-28 19:31:14",
    },
    {
      id: "dep-2",
      orderId: "RC260628160904Ve523v",
      method: "Jazzcash",
      amount: 15680,
      bonus: 313.6,
      status: "Completed",
      date: "2026-06-28 16:09:04",
    },
    {
      id: "dep-3",
      orderId: "RC260628121050Ve523v",
      method: "Jazzcash",
      amount: 12896,
      bonus: 257.92,
      status: "Completed",
      date: "2026-06-28 12:10:50",
    },
    {
      id: "dep-4",
      orderId: "RC260622110530Ve492w",
      method: "Easypaisa",
      amount: 5000,
      bonus: 100,
      status: "Completed",
      date: "2026-06-22 11:05:30",
    },
    {
      id: "dep-5",
      orderId: "RC260615091244Ve105x",
      method: "USDT",
      amount: 8000,
      bonus: 160,
      status: "Completed",
      date: "2026-06-15 09:12:44",
    },
  ];

  const allDeposits = [...customDeposits, ...staticDeposits];

  // Helper to filter deposits by date tab
  const getFilteredDeposits = () => {
    const now = new Date();
    return allDeposits.filter((dep) => {
      const depDate = new Date(dep.date.replace(/-/g, "/"));
      const diffTime = Math.abs(now.getTime() - depDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (activeTab === "1day") {
        // Show deposits within 1 day (or the recent 28th-29th deposits)
        return dep.date.startsWith("2026-06-28") || dep.date.startsWith("2026-06-29") || diffDays <= 1;
      } else if (activeTab === "7days") {
        return diffDays <= 7;
      } else {
        return diffDays <= 30;
      }
    });
  };

  const filtered = getFilteredDeposits();

  // Sort deposits: newest first
  filtered.sort((a, b) => b.date.localeCompare(a.date));

  // Calculate dynamic range string and totals
  const getDateRangeString = () => {
    if (activeTab === "1day") {
      return "2026-06-28 to 2026-06-29";
    }
    const today = new Date();
    const pastDate = new Date();
    if (activeTab === "7days") pastDate.setDate(today.getDate() - 7);
    else pastDate.setDate(today.getDate() - 30);

    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    return `${formatDate(pastDate)} to ${formatDate(today)}`;
  };

  // Sum of (amount + bonus) as seen in user's calculation where total is 47,507.52
  const totalSum = filtered.reduce((acc, dep) => acc + dep.amount + dep.bonus, 0);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0A0A0B] h-screen overflow-y-auto relative text-gray-200 no-scrollbar">
      {/* Header matching site style */}
      <div className="flex items-center justify-between p-4 sticky top-0 bg-[#161618] z-40 border-b border-white/5 shadow-md flex-shrink-0">
        <ChevronLeft
          className="w-6 h-6 text-gray-300 hover:text-white cursor-pointer"
          onClick={onBack}
        />
        <h1 className="text-white font-black tracking-widest text-base uppercase">
          Deposit history
        </h1>
        <div className="w-6 h-6" /> {/* Spacer */}
      </div>

      {/* Date Filter Tabs */}
      <div className="flex bg-[#161618] border-b border-white/5 text-sm font-semibold select-none flex-shrink-0">
        <button
          onClick={() => setActiveTab("1day")}
          className={`flex-1 py-3 text-center transition-all relative ${
            activeTab === "1day" ? "text-[#ffa502]" : "text-gray-400 hover:text-white"
          }`}
        >
          1 Day
          {activeTab === "1day" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ffa502]" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("7days")}
          className={`flex-1 py-3 text-center transition-all relative ${
            activeTab === "7days" ? "text-[#ffa502]" : "text-gray-400 hover:text-white"
          }`}
        >
          7 Days
          {activeTab === "7days" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ffa502]" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("30days")}
          className={`flex-1 py-3 text-center transition-all relative ${
            activeTab === "30days" ? "text-[#ffa502]" : "text-gray-400 hover:text-white"
          }`}
        >
          30 Days
          {activeTab === "30days" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ffa502]" />
          )}
        </button>
      </div>

      {/* Info Bar */}
      <div className="flex justify-between items-center px-4 py-3 bg-[#0A0A0B] text-xs font-bold text-gray-400 select-none flex-shrink-0">
        <span>{getDateRangeString()}</span>
        <span>
          Total: <span className="text-[#ffa502]">Rs{totalSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </span>
      </div>

      {/* History List */}
      <div className="p-4 space-y-3 flex-1 pb-10">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Clock className="w-10 h-10 opacity-30 mb-3" />
            <p className="text-sm">No deposits found</p>
          </div>
        ) : (
          filtered.map((dep) => (
            <div
              key={dep.id}
              className="bg-[#161618] border border-white/5 rounded-2xl p-4 flex items-center justify-between shadow-lg relative overflow-hidden"
            >
              <div className="flex items-start gap-3">
                {/* Clock Icon Wrapper */}
                <div className="w-10 h-10 rounded-full bg-[#ffa502] flex items-center justify-center text-black shadow-md flex-shrink-0 mt-0.5">
                  <Clock className="w-5 h-5" strokeWidth={2.5} />
                </div>

                {/* Left Info Column */}
                <div className="flex flex-col gap-0.5 text-left">
                  {/* Date */}
                  <span className="text-blue-400 font-bold text-[13px] tracking-tight">
                    {dep.date}
                  </span>
                  {/* Order ID & Copy Icon */}
                  <div className="flex items-center gap-1.5 text-gray-400 text-xs font-semibold">
                    <span>Order ID: {dep.orderId.substring(0, 8)}...{dep.orderId.substring(dep.orderId.length - 6)}</span>
                    <button
                      onClick={() => handleCopy(dep.orderId)}
                      className="text-gray-400 hover:text-white p-0.5 active:scale-95 transition-all"
                      title="Copy Order ID"
                    >
                      {copiedId === dep.orderId ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  {/* Method */}
                  <span className="text-gray-400 text-xs font-semibold">
                    Method: {dep.method}
                  </span>
                </div>
              </div>

              {/* Right Financial Column */}
              <div className="flex flex-col items-end text-right justify-between h-full min-h-[50px]">
                <div className="flex flex-col gap-0.5">
                  {/* Balance / Amount */}
                  <div className="text-xs font-bold">
                    <span className="text-gray-400">Balance: </span>
                    <span className="text-[#ffa502] font-black">+{dep.amount}</span>
                  </div>
                  {/* Bonus */}
                  <div className="text-[11px] font-bold text-[#38bdf8]">
                    <span className="text-gray-400">Bonus: </span>
                    <span>{dep.bonus}</span>
                  </div>
                </div>

                {/* Status Indicator */}
                <span className="text-emerald-400 font-black text-xs uppercase tracking-wider mt-1.5">
                  {dep.status}
                </span>
              </div>
            </div>
          ))
        )}

        {/* Footer info matching screenshot */}
        <div className="text-center py-6 text-gray-500 font-bold text-xs">
          no more
        </div>
      </div>
    </div>
  );
}
