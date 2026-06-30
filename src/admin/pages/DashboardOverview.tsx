import React from "react";
import { useAdmin } from "../context/AdminContext";
import {
  TrendingUp,
  Users,
  DollarSign,
  CreditCard,
  Wallet,
  Activity,
} from "lucide-react";

interface StatCard {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: number;
  unit?: string;
}

export function DashboardOverview() {
  const { stats } = useAdmin();

  const statCards: StatCard[] = [
    {
      title: "Total Recharge Today",
      value: stats.totalRechargeToday,
      icon: <CreditCard className="w-6 h-6" />,
      trend: 12.5,
      unit: "Rs",
    },
    {
      title: "Total Active Users",
      value: stats.totalActiveUsers,
      icon: <Activity className="w-6 h-6" />,
      trend: 8.2,
    },
    {
      title: "Total Users",
      value: stats.totalUsers,
      icon: <Users className="w-6 h-6" />,
      trend: 5.1,
    },
    {
      title: "Total Withdrawals",
      value: stats.totalWithdrawals,
      icon: <DollarSign className="w-6 h-6" />,
      trend: -3.2,
      unit: "Rs",
    },
    {
      title: "Total Balance",
      value: stats.totalBalance,
      icon: <Wallet className="w-6 h-6" />,
      trend: 15.8,
      unit: "Rs",
    },
  ];

  const formatNumber = (num: number, unit?: string): string => {
    let value = "";
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

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-8">
          {statCards.map((stat, index) => (
            <div
              key={index}
              className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-6 border border-[#0f3460] hover:border-[#e94560] transition-all duration-300 hover:shadow-lg hover:shadow-red-500/20"
            >
              {/* Icon */}
              <div className="w-12 h-12 bg-gradient-to-br from-[#e94560] to-[#ff6b6b] rounded-lg flex items-center justify-center mb-4">
                <div className="text-white">{stat.icon}</div>
              </div>

              {/* Content */}
              <h3 className="text-gray-400 text-sm font-medium mb-2">{stat.title}</h3>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-white">
                  {formatNumber(stat.value as number, stat.unit)}
                </span>
                {stat.trend !== undefined && (
                  <span
                    className={`text-sm font-semibold flex items-center gap-1 ${
                      stat.trend >= 0 ? "text-[#4ade80]" : "text-[#ef4444]"
                    }`}
                  >
                    <TrendingUp className="w-4 h-4" />
                    {stat.trend > 0 ? "+" : ""}
                    {stat.trend}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Charts Section Placeholder */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Chart */}
          <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-6 border border-[#0f3460]">
            <h2 className="text-white font-bold text-lg mb-6">Revenue Trend (7 Days)</h2>
            <div className="h-64 bg-[#0f3460] rounded-lg flex items-center justify-center">
              <div className="text-center">
                <div className="text-gray-500 text-sm">Chart placeholder</div>
                <p className="text-gray-600 text-xs mt-2">Connect to Supabase for real data</p>
              </div>
            </div>
          </div>

          {/* User Activity */}
          <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-6 border border-[#0f3460]">
            <h2 className="text-white font-bold text-lg mb-6">User Activity</h2>
            <div className="space-y-4">
              {[
                { label: "New Users", value: 234, color: "from-[#4ade80] to-[#22c55e]" },
                { label: "Active Sessions", value: 1234, color: "from-[#3b82f6] to-[#1d4ed8]" },
                { label: "Deposits Today", value: 89, color: "from-[#fbbf24] to-[#f59e0b]" },
                { label: "Withdrawals Today", value: 56, color: "from-[#f87171] to-[#dc2626]" },
              ].map((activity, idx) => (
                <div key={idx}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-400 text-sm">{activity.label}</span>
                    <span className="text-white font-bold">{activity.value}</span>
                  </div>
                  <div className="h-2 bg-[#0f3460] rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${activity.color}`}
                      style={{ width: `${(activity.value / 1234) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activities */}
        <div className="mt-8 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-6 border border-[#0f3460]">
          <h2 className="text-white font-bold text-lg mb-6">Recent Activities</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#0f3460]">
                  <th className="text-left text-gray-400 font-semibold py-3 px-4">Time</th>
                  <th className="text-left text-gray-400 font-semibold py-3 px-4">User ID</th>
                  <th className="text-left text-gray-400 font-semibold py-3 px-4">Activity</th>
                  <th className="text-left text-gray-400 font-semibold py-3 px-4">Amount</th>
                  <th className="text-left text-gray-400 font-semibold py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { time: "2 mins ago", uid: "UID#12345", activity: "Deposit", amount: "Rs 5,000", status: "Success" },
                  { time: "5 mins ago", uid: "UID#67890", activity: "Bet Placed", amount: "Rs 1,000", status: "Processing" },
                  { time: "8 mins ago", uid: "UID#11111", activity: "Withdrawal", amount: "Rs 10,000", status: "Pending" },
                  { time: "12 mins ago", uid: "UID#22222", activity: "Deposit", amount: "Rs 2,500", status: "Success" },
                  { time: "15 mins ago", uid: "UID#33333", activity: "Game Won", amount: "Rs 1,950", status: "Success" },
                ].map((activity, idx) => (
                  <tr key={idx} className="border-b border-[#0f3460] hover:bg-[#0f3460] transition-colors">
                    <td className="text-gray-300 py-3 px-4">{activity.time}</td>
                    <td className="text-white font-medium py-3 px-4">{activity.uid}</td>
                    <td className="text-gray-300 py-3 px-4">{activity.activity}</td>
                    <td className="text-[#fbbf24] font-medium py-3 px-4">{activity.amount}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          activity.status === "Success"
                            ? "bg-[#4ade80]/20 text-[#4ade80]"
                            : activity.status === "Processing"
                              ? "bg-[#3b82f6]/20 text-[#3b82f6]"
                              : "bg-[#fbbf24]/20 text-[#fbbf24]"
                        }`}
                      >
                        {activity.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
