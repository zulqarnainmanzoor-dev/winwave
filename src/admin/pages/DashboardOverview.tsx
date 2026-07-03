import React, { useEffect, useState } from "react";
import { adminSupabase } from "../../lib/adminSupabase";
import { Users, DollarSign, CreditCard, Wallet, TrendingUp, Activity } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

type Stats = {
  totalUsers: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
  totalWalletBalance: number;
  totalLifespanRecharge: number;
  todayRecharge: number;
};

export function DashboardOverview() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0, pendingDeposits: 0, pendingWithdrawals: 0, totalWalletBalance: 0,
    totalLifespanRecharge: 0, todayRecharge: 0,
  });
  const [revenueSeries, setRevenueSeries] = useState<{ day: string; revenue: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchStats = async () => {
    setError("");
    try {
      const sb = adminSupabase as any;
      // Use adminSupabase (service_role) for all queries
      const [
        { count: totalUsers },
        { count: pendingWithdrawals },
        { data: balanceRows },
        { data: txRows },
        { count: pendingDeposits },
        { data: lifespanRecharge },
        { data: todayRechargeRows },
      ] = await Promise.all([
        sb.from("users").select("id", { count: "exact", head: true }),
        sb.from("withdraw_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        sb.from("users").select("main_balance, game_balance"),
        sb.from("transactions").select("amount, created_at").eq("type", "deposit").eq("status", "completed").order("created_at", { ascending: true }).limit(50),
        sb.from("transactions").select("id", { count: "exact", head: true }).eq("type", "deposit").eq("status", "pending"),
        // Card A: Total Lifespan Recharge — sum all approved deposits
        sb.from("deposits").select("amount").eq("status", "approved"),
        // Card B: Today's Dynamic Recharge — sum approved deposits from today
        sb.from("deposits").select("amount").eq("status", "approved").gte("created_at", new Date().toISOString().slice(0, 10)),
      ]);

      const totalWalletBalance = (balanceRows || []).reduce(
        (sum: number, r: any) => sum + Number(r.main_balance || 0) + Number(r.game_balance || 0), 0
      );

      const totalLifespanRecharge = (lifespanRecharge || []).reduce(
        (sum: number, r: any) => sum + Number(r.amount || 0), 0
      );

      const todayRecharge = (todayRechargeRows || []).reduce(
        (sum: number, r: any) => sum + Number(r.amount || 0), 0
      );

      // Build 7-day revenue series
      const grouped = new Map<string, number>();
      (txRows || []).forEach((r: any) => {
        const key = new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        grouped.set(key, (grouped.get(key) || 0) + Number(r.amount || 0));
      });
      const series = Array.from(grouped.entries()).map(([day, revenue]) => ({ day, revenue }));
      setRevenueSeries(series.length ? series.slice(-7) : [{ day: "Today", revenue: 0 }]);

      setStats({
        totalUsers: Number(totalUsers ?? 0),
        pendingDeposits: Number(pendingDeposits ?? 0),
        pendingWithdrawals: Number(pendingWithdrawals ?? 0),
        totalWalletBalance,
        totalLifespanRecharge,
        todayRecharge,
      });
    } catch (err: any) {
      setError("Unable to load dashboard stats. Please refresh.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchStats();

    // Realtime: re-fetch whenever users or withdraw_requests change
    const channel = adminSupabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, fetchStats)
      .on("postgres_changes", { event: "*", schema: "public", table: "withdraw_requests" }, fetchStats)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, fetchStats)
      .subscribe();

    return () => { void adminSupabase.removeChannel(channel); };
  }, []);

  const fmt = (n: number, unit?: string) => {
    const v = n >= 1_000_000 ? (n / 1_000_000).toFixed(2) + "M"
            : n >= 1_000     ? (n / 1_000).toFixed(1) + "K"
            : String(n);
    return unit ? `${unit} ${v}` : v;
  };

  const cards = [
    { title: "Total Users",              value: stats.totalUsers,              icon: <Users className="w-6 h-6" /> },
    { title: "Pending Deposits",         value: stats.pendingDeposits,         icon: <CreditCard className="w-6 h-6" /> },
    { title: "Pending Withdrawals",      value: stats.pendingWithdrawals,      icon: <DollarSign className="w-6 h-6" /> },
    { title: "Total Wallet Balance",     value: stats.totalWalletBalance,      icon: <Wallet className="w-6 h-6" />, unit: "Rs" },
    { title: "Total Lifespan Recharge",  value: stats.totalLifespanRecharge,   icon: <TrendingUp className="w-6 h-6" />, unit: "Rs" },
    { title: "Today's Recharge",         value: stats.todayRecharge,           icon: <Activity className="w-6 h-6" />, unit: "Rs" },
  ];

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 md:p-8">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">Dashboard Overview</h1>
          <p className="text-gray-400 text-sm">Real-time platform statistics</p>
        </div>

        {loading ? (
          <div className="rounded-xl border border-[#0f3460] bg-[#12131d] p-8 text-center text-gray-400">
            Loading…
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-red-100">{error}</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
              {cards.map((c, i) => (
                <div key={i} className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-6 border border-[#0f3460] hover:border-[#e94560] transition-all hover:shadow-lg hover:shadow-red-500/20">
                  <div className="w-12 h-12 bg-gradient-to-br from-[#e94560] to-[#ff6b6b] rounded-lg flex items-center justify-center mb-4 text-white">
                    {c.icon}
                  </div>
                  <h3 className="text-gray-400 text-sm font-medium mb-2">{c.title}</h3>
                  <span className="text-2xl font-bold text-white">{fmt(Number(c.value), c.unit)}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-6 border border-[#0f3460]">
                <h2 className="text-white font-bold text-lg mb-6">Revenue Trend (7 Days)</h2>
                <div className="h-64 bg-[#0f3460] rounded-lg p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={revenueSeries}>
                      <CartesianGrid stroke="#1e3a5f" strokeDasharray="3 3" />
                      <XAxis dataKey="day" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip />
                      <Line type="monotone" dataKey="revenue" stroke="#e94560" strokeWidth={3} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-6 border border-[#0f3460]">
                <h2 className="text-white font-bold text-lg mb-4">Activity Summary</h2>
                <p className="text-gray-400 text-sm">Live data synced via Supabase Realtime. Stats update automatically on user/transaction changes.</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
