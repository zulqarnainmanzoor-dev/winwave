import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { adminSupabase } from "../../lib/adminSupabase";

interface HistoryPageProps {
  historyType: "game" | "recharge" | "bet" | "withdraw";
}

export function HistoryPage({ historyType }: HistoryPageProps) {
  const [rows, setRows]       = useState<any[]>([]);
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
      const sb = adminSupabase as any;
      let rawRows: any[] = [];

      // Strict table isolation per history type
      switch (historyType) {
        case "withdraw":
          // STRICTLY query the 'withdrawal_history' table
          // Display: User ID, Amount, Timestamp, Order No, Gateway Provider, Status, Admin Remarks
          let q = sb
            .from("withdrawal_history")
            .select("id, user_id, amount, method, account_number, account_name, status, gateway_ref, reason, remarks, created_at")
            .order("created_at", { ascending: false })
            .limit(200);
          if (statusFilter !== "all") q = q.eq("status", statusFilter);
          if (dateFrom) q = q.gte("created_at", new Date(dateFrom).toISOString());
          if (dateTo) q = q.lte("created_at", new Date(dateTo + "T23:59:59").toISOString());
          const { data: wData } = await q;
          rawRows = (wData || []).map((r: any) => ({
            ...r,
            reference: r.gateway_ref || r.id,
            method: r.method || "—",
          }));
          break;

        case "bet":
          // STRICTLY query the WinGo game betting transaction schema (betting_history)
          // Display: UID, Period Token, Amount, User Pick (Big/Small/Number), and Game Outcome
          let bq = sb
            .from("betting_history")
            .select("id, user_id, amount, period, bet_type, bet_value, payout, status, created_at, game_round:round_id (result_number, result_size, result_color)")
            .order("created_at", { ascending: false })
            .limit(200);
          if (statusFilter !== "all") bq = bq.eq("status", statusFilter);
          if (dateFrom) bq = bq.gte("created_at", new Date(dateFrom).toISOString());
          if (dateTo) bq = bq.lte("created_at", new Date(dateTo + "T23:59:59").toISOString());
          const { data: bData } = await bq;
          rawRows = (bData || []).map((r: any) => ({
            id: r.id,
            user_id: r.user_id,
            amount: r.amount,
            status: r.status,
            created_at: r.created_at,
            // Flatten bet selection
            method: r.bet_type === "size" ? (r.bet_value === "Big" ? "Big" : "Small") : (r.bet_value ? `Number ${r.bet_value}` : "—"),
            // Flatten game outcome
            reference: r.game_round ? `Result: ${r.game_round.result_number ?? "—"} ${r.game_round.result_size ?? ""} ${r.game_round.result_color ?? ""}`.trim() : "—",
          }));
          break;

        case "game":
          // STRICTLY query global round results data logs (game_rounds)
          let gq = sb
            .from("game_rounds")
            .select("id, period, game_type, mode, result_number, result_size, result_color, total_big, total_small, status, started_at, ends_at, created_at")
            .eq("game_type", "wingo")
            .order("created_at", { ascending: false })
            .limit(200);
          if (statusFilter !== "all") gq = gq.eq("status", statusFilter);
          if (dateFrom) gq = gq.gte("created_at", new Date(dateFrom).toISOString());
          if (dateTo) gq = gq.lte("created_at", new Date(dateTo + "T23:59:59").toISOString());
          const { data: gData } = await gq;
          rawRows = (gData || []).map((r: any) => ({
            id: r.id,
            user_id: "—",
            amount: r.total_big + r.total_small,
            status: r.status,
            created_at: r.created_at,
            method: `${r.mode} · ${r.game_type}`,
            reference: r.period,
          }));
          break;

        case "recharge":
          // STRICTLY query the internal 'deposits' system records table
          let dq = sb
            .from("deposits")
            .select("id, user_id, amount, bonus, method, status, gateway_ref, created_at")
            .order("created_at", { ascending: false })
            .limit(200);
          if (statusFilter !== "all") dq = dq.eq("status", statusFilter);
          if (dateFrom) dq = dq.gte("created_at", new Date(dateFrom).toISOString());
          if (dateTo) dq = dq.lte("created_at", new Date(dateTo + "T23:59:59").toISOString());
          const { data: dData } = await dq;
          rawRows = (dData || []).map((r: any) => ({
            id: r.id,
            user_id: r.user_id,
            amount: r.amount,
            status: r.status,
            created_at: r.created_at,
            method: r.method || "Gateway",
            reference: r.gateway_ref || r.id,
          }));
          break;
      }

      // Enrich with user info
      const userIds = [...new Set(rawRows.map((r: any) => r.user_id).filter(Boolean))];
      const userMap: Record<string, { invite_code: string; phone: string }> = {};
      if (userIds.length > 0) {
        const { data: users } = await sb
          .from("users")
          .select("id, invite_code, phone_number")
          .in("id", userIds);
        (users || []).forEach((u: any) => {
          userMap[u.id] = { invite_code: u.invite_code || "—", phone: u.phone_number || "—" };
        });
      }

      const enriched = rawRows.map((r: any) => ({
        id:          r.id,
        user_id:     r.user_id,
        invite_code: userMap[r.user_id]?.invite_code || "—",
        phone:       userMap[r.user_id]?.phone || "—",
        amount:      Number(r.amount ?? 0),
        status:      r.status || "—",
        method:      r.method || "—",
        reference:   r.reference || "—",
        created_at:  r.created_at || "",
      }));

      setRows(enriched);
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
                  <th className="text-left text-gray-400 font-semibold py-3 px-4 text-xs uppercase">Method / Selection</th>
                  <th className="text-left text-gray-400 font-semibold py-3 px-4 text-xs uppercase">Status</th>
                  <th className="text-left text-gray-400 font-semibold py-3 px-4 text-xs uppercase">Reference / Outcome</th>
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
                      <td className="py-3 px-4 text-gray-500 text-xs font-mono truncate max-w-[200px]">{row.reference}</td>
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