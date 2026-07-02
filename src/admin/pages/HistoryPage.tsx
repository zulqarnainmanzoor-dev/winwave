import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

interface HistoryPageProps {
  historyType: "game" | "recharge" | "bet" | "withdraw";
}

interface HistoryRow {
  id: string;
  user_id: string;
  invite_code: string;
  phone: string;
  amount: number;
  status: string;
  method: string;
  reference: string;
  created_at: string;
}

export function HistoryPage({ historyType }: HistoryPageProps) {
  const [rows, setRows]       = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const config = {
    game:     { title: "Game History",     description: "All game rounds and results" },
    recharge: { title: "Recharge History", description: "All deposit transactions" },
    bet:      { title: "Bet History",      description: "All placed bets" },
    withdraw: { title: "Withdraw History", description: "All withdrawal requests" },
  }[historyType];

  const fetchData = async () => {
    setLoading(true);
    try {
      let rawRows: any[] = [];

      if (historyType === "recharge" || historyType === "bet" || historyType === "game") {
        const txType = historyType === "recharge" ? "deposit" : "withdraw";
        let q = supabase
          .from("transactions")
          .select("id, user_id, amount, status, gateway_ref, created_at, type")
          .order("created_at", { ascending: false })
          .limit(200);

        if (historyType === "recharge") q = q.eq("type", "deposit");
        if (historyType === "bet")      q = q.eq("type", "withdraw");

        const { data, error } = await q;
        if (error) throw error;
        rawRows = data || [];
      } else {
        // withdraw history
        const { data, error } = await (supabase.from("withdraw_requests") as any)
          .select("id, user_id, amount, status, bank_name, account_number, created_at")
          .order("created_at", { ascending: false })
          .limit(200);
        if (error) throw error;
        rawRows = data || [];
      }

      // Enrich with user info
      const userIds = [...new Set(rawRows.map((r: any) => r.user_id).filter(Boolean))];
      let userMap: Record<string, { invite_code: string; phone: string }> = {};
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from("users")
          .select("id, invite_code, phone_number")
          .in("id", userIds);
        (users || []).forEach((u: any) => {
          userMap[u.id] = { invite_code: u.invite_code || "—", phone: u.phone_number || "—" };
        });
      }

      const enriched: HistoryRow[] = rawRows.map((r: any) => ({
        id:          r.id,
        user_id:     r.user_id,
        invite_code: userMap[r.user_id]?.invite_code || "—",
        phone:       userMap[r.user_id]?.phone || "—",
        amount:      Number(r.amount ?? 0),
        status:      r.status || "—",
        method:      r.bank_name || r.gateway_ref || r.type || "—",
        reference:   r.gateway_ref || r.account_number || r.id,
        created_at:  r.created_at || "",
      }));

      // Apply filters
      let filtered = enriched;
      if (statusFilter !== "all") filtered = filtered.filter(r => r.status === statusFilter);
      if (dateFrom) filtered = filtered.filter(r => new Date(r.created_at) >= new Date(dateFrom));
      if (dateTo)   filtered = filtered.filter(r => new Date(r.created_at) <= new Date(dateTo + "T23:59:59"));

      setRows(filtered);
    } catch (err: any) {
      console.error("HistoryPage fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [historyType, statusFilter, dateFrom, dateTo]);

  const statusColor = (s: string) => {
    if (s === "completed" || s === "approved" || s === "success") return "bg-emerald-500/20 text-emerald-400";
    if (s === "pending") return "bg-amber-500/20 text-amber-400";
    return "bg-red-500/20 text-red-400";
  };

  return (
    <div className="flex-1 overflow-auto bg-[#0a0a0b] min-h-screen">
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">{config.title}</h1>
            <p className="text-gray-400 text-sm">{config.description}</p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a1a2e] border border-[#0f3460] text-gray-300 rounded-lg hover:border-amber-500/50 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-4 gap-3 mb-6 bg-[#1a1a2e] rounded-xl p-4 border border-[#0f3460]">
          <div>
            <label className="text-gray-400 text-xs block mb-1">From Date</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="w-full bg-[#0f3460] border border-[#1a5f7a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" />
          </div>
          <div>
            <label className="text-gray-400 text-xs block mb-1">To Date</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="w-full bg-[#0f3460] border border-[#1a5f7a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" />
          </div>
          <div>
            <label className="text-gray-400 text-xs block mb-1">Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="w-full bg-[#0f3460] border border-[#1a5f7a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none">
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="approved">Approved</option>
              <option value="failed">Failed</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={() => { setDateFrom(""); setDateTo(""); setStatusFilter("all"); }}
              className="w-full py-2 bg-[#0f3460] text-gray-300 rounded-lg border border-[#1a5f7a] hover:border-amber-500/50 text-sm">
              Clear Filters
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-[#1a1a2e] rounded-xl border border-[#0f3460] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0f3460] border-b border-[#1a5f7a]">
                  <th className="text-left text-gray-400 font-semibold py-3 px-4 text-xs uppercase">Time</th>
                  <th className="text-left text-gray-400 font-semibold py-3 px-4 text-xs uppercase">UID</th>
                  <th className="text-left text-gray-400 font-semibold py-3 px-4 text-xs uppercase">Phone</th>
                  <th className="text-left text-gray-400 font-semibold py-3 px-4 text-xs uppercase">Amount</th>
                  <th className="text-left text-gray-400 font-semibold py-3 px-4 text-xs uppercase">Method</th>
                  <th className="text-left text-gray-400 font-semibold py-3 px-4 text-xs uppercase">Status</th>
                  <th className="text-left text-gray-400 font-semibold py-3 px-4 text-xs uppercase">Reference</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-500">Loading...</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-500">No records found.</td></tr>
                ) : (
                  rows.map(row => (
                    <tr key={row.id} className="border-b border-[#0f3460]/60 hover:bg-[#0f3460]/40 transition-colors">
                      <td className="py-3 px-4 text-gray-400 text-xs">{new Date(row.created_at).toLocaleString()}</td>
                      <td className="py-3 px-4 text-amber-400 font-black font-mono">{row.invite_code}</td>
                      <td className="py-3 px-4 text-gray-300 font-mono text-xs">{row.phone}</td>
                      <td className="py-3 px-4 text-amber-400 font-bold">Rs {row.amount.toLocaleString()}</td>
                      <td className="py-3 px-4 text-gray-300 text-xs">{row.method}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusColor(row.status)}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs font-mono truncate max-w-[120px]">{row.reference}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-[#0f3460] text-gray-500 text-xs">
            {rows.length} record{rows.length !== 1 ? "s" : ""} found
          </div>
        </div>
      </div>
    </div>
  );
}
