import React from "react";
import { useAdmin } from "../context/AdminContext";
import { FileText } from "lucide-react";

interface HistoryPageProps {
  historyType: "game" | "recharge" | "bet" | "withdraw";
}

const historyConfig = {
  game: {
    title: "Game History",
    description: "View all completed game rounds and results",
    columns: ["Time", "Game", "Mode", "Result", "Players", "Total Pot"],
  },
  recharge: {
    title: "Recharge History",
    description: "Track all deposit transactions",
    columns: ["Time", "User UID", "Amount", "Method", "Status", "Reference"],
  },
  bet: {
    title: "Bet History",
    description: "Review all placed bets and outcomes",
    columns: ["Time", "User UID", "Game", "Amount", "Bet Type", "Result", "Payout"],
  },
  withdraw: {
    title: "Withdraw History",
    description: "Monitor withdrawal requests and completions",
    columns: ["Time", "User UID", "Amount", "Method", "Status", "Account"],
  },
};

export function HistoryPage({ historyType }: HistoryPageProps) {
  const config = historyConfig[historyType];

  const mockData = [
    { time: "14:23:45", value1: "WG#2024-001", value2: "Rs 125,450", value3: "Big Won", value4: "Completed", value5: "R# 098765" },
    { time: "14:24:15", value1: "User#1234", value2: "Rs 98,500", value3: "Jazzcash", value4: "Success", value5: "JZ# 123456" },
    { time: "14:24:45", value1: "User#5678", value2: "Rs 234,120", value3: "WinGo", value4: "Small Won", value5: "Rs 456,234" },
    { time: "14:25:15", value1: "User#9012", value2: "Rs 156,750", value3: "Easypaisa", value4: "Pending", value5: "EP# 789012" },
    { time: "14:25:45", value1: "User#3456", value2: "Rs 89,200", value3: "K3", value4: "Lost", value5: "Cancelled" },
  ];

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">{config.title}</h1>
          <p className="text-gray-400">{config.description}</p>
        </div>

        {/* Filters */}
        <div className="mb-8 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-6 border border-[#0f3460]">
          <div className="grid grid-cols-4 gap-4">
            <input
              type="date"
              className="bg-[#0f3460] border border-[#1a5f7a] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#e94560]"
            />
            <input
              type="date"
              className="bg-[#0f3460] border border-[#1a5f7a] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#e94560]"
            />
            <select className="bg-[#0f3460] border border-[#1a5f7a] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#e94560]">
              <option>All Status</option>
              <option>Success</option>
              <option>Pending</option>
              <option>Failed</option>
            </select>
            <button className="bg-gradient-to-r from-[#e94560] to-[#ff6b6b] text-white rounded-lg hover:shadow-lg hover:shadow-red-500/30 transition-all font-medium">
              Export
            </button>
          </div>
        </div>

        {/* History Table */}
        <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl border border-[#0f3460] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0f3460] border-b border-[#1a5f7a]">
                  {config.columns.map((col, idx) => (
                    <th key={idx} className="text-left text-gray-400 font-semibold py-4 px-6">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mockData.map((row, idx) => (
                  <tr key={idx} className="border-b border-[#0f3460] hover:bg-[#0f3460] transition-colors">
                    <td className="text-gray-300 py-4 px-6">{row.time}</td>
                    <td className="text-white font-medium py-4 px-6">{row.value1}</td>
                    <td className="text-[#3b82f6] py-4 px-6">{row.value2}</td>
                    <td className="text-[#fbbf24] py-4 px-6">{row.value3}</td>
                    <td className="py-4 px-6">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          row.value4 === "Success" || row.value4 === "Completed"
                            ? "bg-[#4ade80]/20 text-[#4ade80]"
                            : row.value4 === "Pending"
                              ? "bg-[#fbbf24]/20 text-[#fbbf24]"
                              : "bg-[#ef4444]/20 text-[#ef4444]"
                        }`}
                      >
                        {row.value4}
                      </span>
                    </td>
                    <td className="text-gray-300 py-4 px-6">{row.value5}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between p-6 border-t border-[#0f3460]">
            <p className="text-gray-400 text-sm">Showing 1-5 of 1,234 records</p>
            <div className="flex gap-2">
              <button className="px-3 py-1 bg-[#0f3460] text-gray-400 hover:text-white rounded transition-all">
                Previous
              </button>
              {[1, 2, 3, "...", 10].map((page, idx) => (
                <button
                  key={idx}
                  className={`px-3 py-1 rounded transition-all ${
                    page === 1
                      ? "bg-gradient-to-r from-[#e94560] to-[#ff6b6b] text-white"
                      : "bg-[#0f3460] text-gray-400 hover:text-white"
                  }`}
                >
                  {page}
                </button>
              ))}
              <button className="px-3 py-1 bg-[#0f3460] text-gray-400 hover:text-white rounded transition-all">
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
