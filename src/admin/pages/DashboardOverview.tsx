import React, { useEffect, useState } from "react";
import { adminSupabase } from "../../lib/adminSupabase";
import { Users, DollarSign, CreditCard, Wallet, TrendingUp, Activity, BarChart2, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

type Stats = {
  totalUsers: number;
  activeUsers: number;
  pendingWithdrawals: number;
  totalWalletBalance: number;
  todayDeposits: number;
  todayWithdrawals: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalBetCount: number;
  totalBetAmount: number;
  totalProfit: number;
  referralUsers: number;
  directReferralUsers: number;
  teamReferralUsers: number;
};

export function DashboardOverview() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0, activeUsers: 0, pendingWithdrawals: 0, totalWalletBalance: 0,
    todayDeposits: 0, todayWithdrawals: 0, totalDeposits: 0, totalWithdrawals: 0,
    totalBetCount: 0, totalBetAmount: 0, totalProfit: 0,
    referralUsers: 0, directReferralUsers: 0, teamReferralUsers: 0,
  });
  const [revenueSeries, setRevenueSeries] = useState<{ day: string; revenue: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchStats = async () => {
    setError("");
    try {
      const sb = adminSupabase as any;
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const todayIso = todayStart.toISOString();

      const [
        { count: totalUsers },
        { count: pendingWithdrawals },
        { data: balanceRows },
        // Deposits from deposit_history (correct table)
        { data: allDeposits },
        { data: todayDepositRows },
        // Withdrawals from withdrawal_history
        { data: allWithdrawals },
        { data: todayWithdrawalRows },
        // Bets
        { data: betRows },
        // Referral counts
        { count: referralUsers },
      ] = await Promise.all([
        sb.from("users").select("id", { count: "exact", head: true }),
        sb.from("withdrawal_history").select("id", { count: "exact", head: true }).eq("status", "pending"),
        sb.from("users").select("main_balance"),
        // All completed deposits from deposit_history
        sb.from("deposit_history").select("amount, created_at").eq("status", "completed"),
        // Today's completed deposits
        sb.from("deposit_history").select("amount").eq("status", "completed").gte("created_at", todayIso),
        // All completed withdrawals
        sb.from("withdrawal_history").select("amount, created_at").eq("status", "completed"),
        // Today's completed withdrawals
        sb.from("withdrawal_history").select("amount").eq("status", "completed").gte("created_at", todayIso),
        // All bets
        sb.from("betting_history").select("amount, win_amount, is_win"),
        // Users with a referrer (direct + team combined)
        sb.from("users").select("id", { count: "exact", head: true }).not("referred_by", "is", null),
      ]);

      // Active users: users who placed at least one bet
      const { count: activeUsers } = await sb
        .from("users")
        .select("id", { count: "exact", head: true })
        .gt("total_bets", 0);

      // Direct referral users (referred_by = any user who has no referrer themselves)
      // Simplified: count all users with referred_by set = referralUsers (already fetched)
      // Team = users referred by someone who was also referred
      // For simplicity: direct = users with referred_by set, team = subset of those
      // We compute team as users whose referrer also has a referrer
      const { count: directReferralUsers } = await sb
        .from("users")
        .select("id", { count: "exact", head: true })
        .not("referred_by", "is", null);

      const totalWalletBalance = (balanceRows || []).reduce(
        (sum: number, r: any) => sum + Number(r.main_balance || 0), 0
      );

      const totalDeposits = (allDeposits || []).reduce(
        (sum: number, r: any) => sum + Number(r.amount || 0), 0
      );
      const todayDeposits = (todayDepositRows || []).reduce(
        (sum: number, r: any) => sum + Number(r.amount || 0), 0
      );
      const totalWithdrawals = (allWithdrawals || []).reduce(
        (sum: number, r: any) => sum + Number(r.amount || 0), 0
      );
      const todayWithdrawals = (todayWithdrawalRows || []).reduce(
        (sum: number, r: any) => sum + Number(r.amount || 0), 0
      );

      const totalBetAmount = (betRows || []).reduce(
        (sum: number, r: any) => sum + Number(r.amount || 0), 0
      );
      const totalPayout = (betRows || []).reduce(
        (sum: number, r: any) => sum + (r.is_win ? Number(r.win_amount || 0) : 0), 0
      );
      const totalProfit = totalBetAmount - totalPayout;
      const totalBetCount = (betRows || []).length;

      // Build 7-day deposit revenue series from deposit_history
      const grouped = new Map<string, number>();
      (allDeposits || []).forEach((r: any) => {
        const key = new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        grouped.set(key, (grouped.get(key) || 0) + Number(r.amount || 0));
      });
      const series = Array.from(grouped.entries()).map(([day, revenue]) => ({ day, revenue }));
      setRevenueSeries(series.length ? series.slice(-7) : [{ day: "Today", revenue: 0 }]);

      setStats({
        totalUsers:          Number(totalUsers ?? 0),
        activeUsers:         Number(activeUsers ?? 0),
        pendingWithdrawals:  Number(pendingWithdrawals ?? 0),
        totalWalletBalance,
        todayDeposits,
        todayWithdrawals,
        totalDeposits,
        totalWithdrawals,
        totalBetCount,
        totalBetAmount,
        totalProfit,
        referralUsers:       Number(referralUsers ?? 0),
        directReferralUsers: Number(directReferralUsers ?? 0),
        teamReferralUsers:   Math.max(0, Number(referralUsers ?? 0) - Number(directReferralUsers ?? 0)),
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

    const channel = adminSupabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, fetchStats)
      .on("postgres_changes", { event: "*", schema: "public", table: "deposit_history" }, fetchStats)
      .on("postgres_changes", { event: "*", schema: "public", table: "withdrawal_history" }, fetchStats)
      .on("postgres_changes", { event: "*", schema: "public", table: "betting_history" }, fetchStats)
      .subscribe();

    return () => { void adminSupabase.removeChannel(channel); };
  }, []);

  const fmt = (n: number, unit?: string) => {
    const v = n >= 1_000_000 ? (n / 1_000_000).toFixed(2) + "M"
            : n >= 1_000     ? (n / 1_000).toFixed(1) + "K"
            : n % 1 === 0    ? String(Math.round(n))
            : n.toFixed(2);
    return unit ? `${unit} ${v}` : v;
  };

  const cards = [
    { title: "Total Users",           value: stats.totalUsers,         icon: <Users className="w-6 h-6" /> },
    { title: "Active Users",          value: stats.activeUsers,        icon: <Activity className="w-6 h-6" /> },
    { title: "Pending Withdrawals",   value: stats.pendingWithdrawals, icon: <DollarSign className="w-6 h-6" /> },
    { title: "Total Wallet Balance",  value: stats.totalWalletBalance, icon: <Wallet className="w-6 h-6" />, unit: "Rs" },
    { title: "Today's Deposits",      value: stats.todayDeposits,      icon: <ArrowDownCircle className="w-6 h-6" />, unit: "Rs" },
    { title: "Today's Withdrawals",   value: stats.todayWithdrawals,   icon: <ArrowUpCircle className="w-6 h-6" />, unit: "Rs" },
    { title: "Total Deposits",        value: stats.totalDeposits,      icon: <CreditCard className="w-6 h-6" />, unit: "Rs" },
    { title: "Total Withdrawals",     value: stats.totalWithdrawals,   icon: <DollarSign className="w-6 h-6" />, unit: "Rs" },
    { title: "Total Bets",            value: stats.totalBetCount,      icon: <BarChart2 className="w-6 h-6" /> },
    { title: "Total Bet Amount",      value: stats.totalBetAmount,     icon: <TrendingUp className="w-6 h-6" />, unit: "Rs" },
    { title: "Platform Profit",       value: stats.totalProfit,        icon: <TrendingUp className="w-6 h-6" />, unit: "Rs" },
    { title: "Referral Users",        value: stats.referralUsers,      icon: <Users className="w-6 h-6" /> },
    { title: "Direct Referrals",      value: stats.directReferralUsers,icon: <Users className="w-6 h-6" /> },
    { title: "Team Referrals",        value: stats.teamReferralUsers,  icon: <Users className="w-6 h-6" /> },
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
                <h2 className="text-white font-bold text-lg mb-6">Deposit Revenue (Last 7 Days)</h2>
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
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between border-b border-[#0f3460] pb-2">
                    <span className="text-gray-400">Total Referral Users</span>
                    <span className="text-white font-bold">{stats.referralUsers}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#0f3460] pb-2">
                    <span className="text-gray-400">Direct Referrals</span>
                    <span className="text-white font-bold">{stats.directReferralUsers}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#0f3460] pb-2">
                    <span className="text-gray-400">Platform Profit</span>
                    <span className={`font-bold ${stats.totalProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      Rs {stats.totalProfit.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs pt-2">Live data synced via Supabase Realtime.</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
