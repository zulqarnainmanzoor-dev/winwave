import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { Users, DollarSign, CreditCard, Wallet, Activity } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface StatCard {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  unit?: string;
}

type DashboardStats = {
  totalUsers: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
  totalWalletBalance: number;
};

export function DashboardOverview() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    pendingDeposits: 0,
    pendingWithdrawals: 0,
    totalWalletBalance: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revenueSeries, setRevenueSeries] = useState<Array<{ day: string; revenue: number }>>([]);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError("");

      try {
        const isMissingTableError = (error: any) => ["42P01", "PGRST205"].includes(error?.code) || /table|relation/i.test(error?.message || "");

        const countRows = async (tables: string[], filters: Array<[string, string]> = []) => {
          let lastError: any = null;
          for (const tableName of tables) {
            let query = supabase.from(tableName).select("id", { count: "exact", head: true });
            filters.forEach(([column, value]) => {
              query = query.eq(column, value);
            });
            const { count, error } = await query;
            if (!error) {
              return Number(count ?? 0);
            }
            lastError = error;
            if (!isMissingTableError(error)) {
              break;
            }
          }
          return Number(lastError ? 0 : 0);
        };

        const [{ count: totalUsers }, pendingDeposits, pendingWithdrawals, walletsResult] = await Promise.all([
          supabase.from("users").select("id", { count: "exact", head: true }),
          countRows(["transactions", "deposits", "deposit_requests"], [["status", "pending"], ["type", "deposit"]]),
          countRows(["withdraw_requests", "withdrawals", "transactions"], [["status", "pending"]]),
          (async () => {
            const candidates = ["wallets", "users"] as const;
            for (const tableName of candidates) {
              const { data, error } = await supabase.from(tableName).select("main_balance");
              if (!error && Array.isArray(data)) {
                return data.reduce((sum, row) => sum + Number(row?.main_balance || 0), 0);
              }
            }
            return 0;
          })(),
        ]);

        const { data: revenueData, error: revenueError } = await supabase
          .from("transactions")
          .select("amount, created_at")
          .eq("type", "deposit")
          .order("created_at", { ascending: true })
          .limit(7);

        if (!revenueError && Array.isArray(revenueData)) {
          const grouped = new Map<string, number>();
          revenueData.forEach((row: any) => {
            const key = new Date(row.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
            grouped.set(key, (grouped.get(key) || 0) + Number(row.amount || 0));
          });
          const series = Array.from(grouped.entries()).map(([day, revenue]) => ({ day, revenue }));
          setRevenueSeries(series.length ? series : [{ day: "Today", revenue: 0 }]);
        }

        setStats({
          totalUsers: Number(totalUsers ?? 0),
          pendingDeposits: Number(pendingDeposits ?? 0),
          pendingWithdrawals: Number(pendingWithdrawals ?? 0),
          totalWalletBalance: Number(walletsResult ?? 0),
        });
      } catch (err: any) {
        console.error("Failed to load dashboard stats", err);
        setError("Unable to load dashboard stats. Please refresh.");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards: StatCard[] = [
    {
      title: "Total Users",
      value: stats.totalUsers,
      icon: <Users className="w-6 h-6" />,
    },
    {
      title: "Pending Deposits",
      value: stats.pendingDeposits,
      icon: <CreditCard className="w-6 h-6" />,
    },
    {
      title: "Pending Withdrawals",
      value: stats.pendingWithdrawals,
      icon: <DollarSign className="w-6 h-6" />,
    },
    {
      title: "Total Wallet Balance",
      value: stats.totalWalletBalance,
      icon: <Wallet className="w-6 h-6" />,
      unit: "Rs",
    },
  ];

  const formatNumber = (num: number, unit?: string): string => {
    let value = "0";
    if (num >= 1000000) {
      value = (num / 1000000).toFixed(2) + "M";
    } else if (num >= 1000) {
      value = (num / 1000).toFixed(2) + "K";
    } else {
      value = num.toString();
    }
    return unit ? `${unit} ${value}` : value;
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Dashboard Overview</h1>
          <p className="text-gray-400">Real-time platform statistics and metrics</p>
        </div>

        {loading ? (
          <div className="rounded-xl border border-[#0f3460] bg-[#12131d] p-8 text-center text-gray-400">
            Loading dashboard statistics...
          </div>
        ) : (
          <>
            {error ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-red-100">
                {error}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
                {statCards.map((stat, index) => (
                  <div
                    key={index}
                    className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-6 border border-[#0f3460] hover:border-[#e94560] transition-all duration-300 hover:shadow-lg hover:shadow-red-500/20"
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-[#e94560] to-[#ff6b6b] rounded-lg flex items-center justify-center mb-4">
                      <div className="text-white">{stat.icon}</div>
                    </div>
                    <h3 className="text-gray-400 text-sm font-medium mb-2">{stat.title}</h3>
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-bold text-white">
                        {formatNumber(Number(stat.value), stat.unit)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

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
            <h2 className="text-white font-bold text-lg mb-6">Activity Summary</h2>
            <p className="text-gray-400 text-sm">
              Dashboard data is loaded from the database. Recent activities will appear here as game and transaction events are logged.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
