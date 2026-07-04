import React from "react";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface RebateLevel {
  level: string;
  color: string;
  rates: {
    level: number;
    percentage: string;
  }[];
}

const rebateData: RebateLevel[] = [
  {
    level: "L0",
    color: "#f97316",
    rates: [
      { level: 1, percentage: "0.3%" },
      { level: 2, percentage: "0.09%" },
      { level: 3, percentage: "0.027%" },
      { level: 4, percentage: "0.0081%" },
      { level: 5, percentage: "0.00243%" },
      { level: 6, percentage: "0.000729%" },
    ],
  },
  {
    level: "L1",
    color: "#f97316",
    rates: [
      { level: 1, percentage: "0.35%" },
      { level: 2, percentage: "0.1225%" },
      { level: 3, percentage: "0.042875%" },
      { level: 4, percentage: "0.015006%" },
      { level: 5, percentage: "0.005252%" },
      { level: 6, percentage: "0.001838%" },
    ],
  },
  {
    level: "L2",
    color: "#f97316",
    rates: [
      { level: 1, percentage: "0.375%" },
      { level: 2, percentage: "0.140625%" },
      { level: 3, percentage: "0.052734%" },
      { level: 4, percentage: "0.019775%" },
      { level: 5, percentage: "0.007416%" },
      { level: 6, percentage: "0.002781%" },
    ],
  },
  {
    level: "L3",
    color: "#f97316",
    rates: [
      { level: 1, percentage: "0.4%" },
      { level: 2, percentage: "0.16%" },
      { level: 3, percentage: "0.064%" },
      { level: 4, percentage: "0.0256%" },
      { level: 5, percentage: "0.01024%" },
      { level: 6, percentage: "0.004096%" },
    ],
  },
  {
    level: "L4",
    color: "#f97316",
    rates: [
      { level: 1, percentage: "0.425%" },
      { level: 2, percentage: "0.180625%" },
      { level: 3, percentage: "0.076766%" },
      { level: 4, percentage: "0.032625%" },
      { level: 5, percentage: "0.013866%" },
      { level: 6, percentage: "0.005893%" },
    ],
  },
  {
    level: "L5",
    color: "#f97316",
    rates: [
      { level: 1, percentage: "0.45%" },
      { level: 2, percentage: "0.2025%" },
      { level: 3, percentage: "0.091125%" },
      { level: 4, percentage: "0.041006%" },
      { level: 5, percentage: "0.018453%" },
      { level: 6, percentage: "0.008304%" },
    ],
  },
  {
    level: "L6",
    color: "#f97316",
    rates: [
      { level: 1, percentage: "0.5%" },
      { level: 2, percentage: "0.25%" },
      { level: 3, percentage: "0.125%" },
      { level: 4, percentage: "0.0625%" },
      { level: 5, percentage: "0.03125%" },
      { level: 6, percentage: "0.015625%" },
    ],
  },
];

export default function RebateRatioPage() {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex flex-col bg-[#1a1a1a] min-h-screen text-gray-200">
      {/* Header */}
      <div className="h-12 bg-[#252525] flex items-center px-4 border-b border-white/5 sticky top-0 z-20">
        <button 
          onClick={() => navigate(-1)}
          className="p-1 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-white text-base font-black tracking-widest flex-1 text-center uppercase">
          8 Ball Pool Rebate Rates
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* 8 Ball Pool Icon Section */}
        <div className="bg-[#252525] border border-white/5 rounded-3xl p-6 mb-4 text-center">
          <div className="w-24 h-24 mx-auto mb-4 relative">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              {/* 8 Ball Pool Icon */}
              <circle cx="50" cy="50" r="45" fill="#1a1a1a" stroke="#f97316" strokeWidth="3"/>
              <circle cx="50" cy="50" r="38" fill="#0a0a0a"/>
              <circle cx="50" cy="50" r="20" fill="#ffffff"/>
              <text x="50" y="58" textAnchor="middle" fill="#000000" fontSize="24" fontWeight="bold">8</text>
              <circle cx="50" cy="50" r="45" fill="none" stroke="#f97316" strokeWidth="1" opacity="0.3"/>
            </svg>
          </div>
          <h2 className="text-xl font-black text-white mb-2">8 Ball Pool</h2>
          <p className="text-xs text-gray-400">Rebate commission rates by level</p>
        </div>

        {/* Rebate Levels List */}
        <div className="space-y-3">
          {rebateData.map((levelData) => (
            <div 
              key={levelData.level}
              className="bg-[#252525] border border-white/5 rounded-2xl p-4"
            >
              {/* Level Header */}
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/5">
                <h3 className="text-sm font-black text-[#f97316]">
                  Rebate level {levelData.level}
                </h3>
                <div className="w-8 h-8 rounded-full bg-[#f97316]/20 flex items-center justify-center">
                  <span className="text-xs font-black text-[#f97316]">
                    {levelData.level}
                  </span>
                </div>
              </div>

              {/* Rates List */}
              <div className="space-y-2">
                {levelData.rates.map((rate, index) => (
                  <div 
                    key={rate.level}
                    className="flex items-center justify-between py-2 border-b border-white/5 last:border-b-0"
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-6 h-6 rounded-full border-2 flex items-center justify-center"
                        style={{ 
                          borderColor: levelData.color,
                          opacity: 1 - (index * 0.15)
                        }}
                      >
                        <div 
                          className="w-2 h-2 rounded-full"
                          style={{ 
                            backgroundColor: levelData.color,
                            opacity: 1 - (index * 0.15)
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-300">
                        {rate.level} level lower level commission rebate
                      </span>
                    </div>
                    <span className="text-sm font-black text-white">
                      {rate.percentage}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Note */}
        <div className="mt-6 p-4 bg-[#252525] border border-white/5 rounded-2xl">
          <p className="text-xs text-gray-400 text-center">
            Commission rates are calculated based on your team's betting activity. 
            The more your team plays, the higher your rebate.
          </p>
        </div>
      </div>
    </div>
  );
}