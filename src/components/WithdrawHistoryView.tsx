import { useState, useEffect } from "react";
import { ChevronLeft, Clock, Copy, Check, RefreshCw } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useUser } from "../context/UserContext";

interface WithdrawRecord {
  id: string;
  amount: number;
  method: string;
  account_no: string | null;
  status: string;
  created_at: string;
  order_id: string | null;
}

export default function WithdrawHistoryView({ onBack }: { onBack: () => void }) {
  const { uid } = useUser();
  const [activeTab, setActiveTab] = useState<"1day" | "7days" | "30days">("7days");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [records, setRecords] = useState<WithdrawRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWithdrawals = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const daysMap = { "1day": 1, "7days": 7, "30days": 30 };
      const since = new Date();
      since.setDate(since.getDate() - daysMap[activeTab]);

      const { data, error } = await supabase
        .from("withdrawal_history")
        .select("id, amount, method, account_no, status, created_at, order_id")
        .eq("user_id", uid)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setRecords(
        (data || []).map((r) => ({
          ...r,
          status:
            r.status === "completed"
              ? "Completed"
              : r.status === "processing"
              ? "Processing"
              : r.status === "failed"
              ? "Failed"
              : "Pending",
        }))
      );
    } catch (e) {
      console.error("fetchWithdrawals error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWithdrawals(); }, [uid, activeTab]);

  const totalSum = records.reduce((acc, r) => acc + r.amount, 0);
  const tabLabel = { "1day": "1 Day", "7days": "7 Days", "30days": "30 Days" };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0A0A0B] h-screen overflow-y-auto relative text-gray-200 no-scrollbar">
      <div className="flex items-center justify-between p-4 sticky top-0 bg-[#161618] z-40 border-b border-white/5 shadow-md flex-shrink-0">
        <ChevronLeft className="w-6 h-6 text-gray-300 hover:text-white cursor-pointer" onClick={onBack} />
        <h1 className="text-white font-black tracking-widest text-base uppercase">Withdraw History</h1>
        <RefreshCw
          className={`w-5 h-5 text-[#ffa502] cursor-pointer ${loading ? "animate-spin" : ""}`}
          onClick={fetchWithdrawals}
        />
      </div>

      <div className="flex bg-[#161618] border-b border-white/5 text-sm font-semibold select-none flex-shrink-0">
        {(["1day", "7days", "30days"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-center transition-all relative ${
              activeTab === tab ? "text-[#ffa502]" : "text-gray-400 hover:text-white"
            }`}
          >
            {tabLabel[tab]}
            {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ffa502]" />}
          </button>
        ))}
      </div>

      <div className="flex justify-between items-center px-4 py-3 bg-[#0A0A0B] text-xs font-bold text-gray-400 select-none flex-shrink-0">
        <span>{records.length} record{records.length !== 1 ? "s" : ""}</span>
        <span>
          Total:{" "}
          <span className="text-[#ffa502]">
            Rs{totalSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </span>
      </div>

      <div className="p-4 space-y-3 flex-1 pb-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <RefreshCw className="w-8 h-8 animate-spin opacity-40 mb-3" />
            <p className="text-sm">Loading...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Clock className="w-10 h-10 opacity-30 mb-3" />
            <p className="text-sm">No withdrawals found</p>
          </div>
        ) : (
          records.map((rec) => (
            <div
              key={rec.id}
              className="bg-[#161618] border border-white/5 rounded-2xl p-4 flex items-center justify-between shadow-lg"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#ff4757] flex items-center justify-center text-white shadow-md flex-shrink-0 mt-0.5">
                  <Clock className="w-5 h-5" strokeWidth={2.5} />
                </div>
                <div className="flex flex-col gap-0.5 text-left">
                  <span className="text-blue-400 font-bold text-[13px] tracking-tight">
                    {new Date(rec.created_at).toLocaleString()}
                  </span>
                  <div className="flex items-center gap-1.5 text-gray-400 text-xs font-semibold">
                    <span>ID: {rec.id.substring(0, 8)}...{rec.id.slice(-4)}</span>
                    <button onClick={() => handleCopy(rec.id)} className="text-gray-400 hover:text-white p-0.5 active:scale-95">
                      {copiedId === rec.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <span className="text-gray-400 text-xs font-semibold">Method: {rec.method || "—"}</span>
                  {rec.account_no && (
                    <span className="text-gray-500 text-xs font-mono">Acc: {rec.account_no}</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end text-right justify-between min-h-[50px]">
                <div className="text-xs font-bold">
                  <span className="text-gray-400">Amount: </span>
                  <span className="text-[#ff4757] font-black">-{rec.amount.toLocaleString()}</span>
                </div>
                <span
                  className={`font-black text-xs uppercase tracking-wider mt-1.5 ${
                    rec.status === "Completed"
                      ? "text-emerald-400"
                      : rec.status === "Processing"
                      ? "text-blue-400"
                      : rec.status === "Failed"
                      ? "text-red-400"
                      : "text-amber-400"
                  }`}
                >
                  {rec.status}
                </span>
              </div>
            </div>
          ))
        )}
        <div className="text-center py-6 text-gray-500 font-bold text-xs">— end —</div>
      </div>
    </div>
  );
}
