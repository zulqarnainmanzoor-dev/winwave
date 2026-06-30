import React, { useState } from "react";
import { ChevronLeft, Calendar as CalendarIcon, X } from "lucide-react";

interface CommissionDetailsViewProps {
  onBack: () => void;
}

export default function CommissionDetailsView({ onBack }: CommissionDetailsViewProps) {
  const [selectedDate, setSelectedDate] = useState<string>("Select Date");
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Local calendar state - default to June 29 as in screenshot (current system date is June 28, 2026, so 29 is today/tomorrow)
  const [tempSelectedDay, setTempSelectedDay] = useState<number>(29);
  
  // We mock June 2026
  const year = 2026;
  const month = 6; // June
  const totalDays = 30;
  // June 1st, 2026 is a Monday, so the weekday index is 1 (0 = Sunday, 1 = Monday). 
  // This means there is 1 empty Sunday slot at the start.
  const emptySlotsCount = 1;

  const daysGrid = Array.from({ length: totalDays }, (_, i) => i + 1);

  const handleConfirmDate = () => {
    setSelectedDate(`${year}/${month}/${tempSelectedDay}`);
    setShowDatePicker(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0A0A0B] min-h-screen text-gray-200 animate-slide-up pb-[90px] no-scrollbar">
      {/* Top Navbar matching website's matte charcoal style */}
      <div className="h-12 bg-[#161618] flex items-center px-4 border-b border-white/5 sticky top-0 z-30 flex-shrink-0">
        <button 
          id="commission-back-btn"
          onClick={onBack} 
          className="p-1 hover:bg-white/10 rounded-full transition-colors cursor-pointer mr-3 text-gray-300 hover:text-white"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-white text-base font-black tracking-widest flex-1 text-center pr-9 uppercase">
          Commission Details
        </h1>
      </div>

      <div className="flex-1 p-4 space-y-6 overflow-y-auto no-scrollbar relative">
        {/* Date Filter Input/Button */}
        <div className="relative z-10">
          <button
            onClick={() => setShowDatePicker(true)}
            className="w-full bg-[#1C1C1E] border border-white/5 rounded-2xl py-3.5 px-4 flex items-center justify-between text-left text-xs font-black text-gray-300 hover:text-white transition-colors cursor-pointer"
          >
            <span className={selectedDate !== "Select Date" ? "text-orange-500" : ""}>
              {selectedDate}
            </span>
            <CalendarIcon className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Custom Overlapping Document/Folder Empty State Graphics with exact styling from screenshot */}
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="relative w-28 h-28 select-none flex items-center justify-center">
            {/* Back document */}
            <div className="absolute w-16 h-20 bg-[#1C1C1E]/85 rounded-2xl border border-white/10 rotate-[-12deg] shadow-lg flex flex-col justify-end p-3">
              <div className="w-10 h-1.5 bg-zinc-800 rounded-full mb-1.5" />
              <div className="w-8 h-1.5 bg-zinc-800 rounded-full" />
            </div>
            {/* Front document with frosted glass finish and gray guidelines */}
            <div className="absolute w-16 h-20 bg-[#2C2C2E]/95 rounded-2xl border border-white/20 translate-x-3.5 translate-y-1 rotate-[6deg] shadow-2xl flex flex-col p-3 justify-center gap-2.5 backdrop-blur-sm">
              <div className="w-11 h-1.5 bg-zinc-700/60 rounded-full" />
              <div className="w-9 h-1.5 bg-zinc-700/60 rounded-full" />
              <div className="w-10 h-1.5 bg-zinc-700/60 rounded-full" />
            </div>
          </div>
          <div className="text-center space-y-1">
            <span className="text-xs font-black text-gray-500 uppercase tracking-widest block">No Records</span>
          </div>
        </div>

        {/* Premium Screen-covering Modal Overlay with Exact Bottom Sheet Layout */}
        {showDatePicker && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end justify-center z-50 animate-fade-in">
            {/* Modal Container */}
            <div className="bg-white w-full max-w-md rounded-t-[32px] p-6 pb-8 space-y-6 flex flex-col text-black shadow-2xl border-t border-gray-100 animate-slide-up select-none relative overflow-hidden">
              
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <div className="w-6" /> {/* Spacer to balance title */}
                <h2 className="text-lg font-extrabold text-[#111] tracking-wide text-center">
                  Calendar
                </h2>
                <button 
                  onClick={() => setShowDatePicker(false)}
                  className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-black cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Month Selector Display */}
              <div className="text-center">
                <span className="text-base font-black text-[#111]">
                  {year}/{month}
                </span>
              </div>

              {/* Calendar Grid Container */}
              <div className="relative py-2">
                {/* Huge Subtle Watermark Background "6" mimicking the design perfectly */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                  <span className="text-[150px] font-black text-gray-100/65 leading-none translate-y-2">
                    {month}
                  </span>
                </div>

                {/* Weekday Columns */}
                <div className="grid grid-cols-7 text-center text-xs font-extrabold text-[#111] mb-4">
                  <span>Sun</span>
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span>Sat</span>
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-y-2.5 text-center relative z-10">
                  {/* Empty slots for month offsets */}
                  {Array.from({ length: emptySlotsCount }).map((_, idx) => (
                    <div key={`empty-${idx}`} className="h-10 w-10" />
                  ))}

                  {/* Day Elements */}
                  {daysGrid.map((day) => {
                    const isSelected = tempSelectedDay === day;
                    // For aesthetic detail: show day 30 as slightly muted if needed, or normal
                    const isMuted = day > 29;

                    return (
                      <div key={day} className="flex justify-center items-center">
                        <button
                          onClick={() => setTempSelectedDay(day)}
                          className={`h-10 w-10 flex items-center justify-center text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                            isSelected
                              ? "bg-gradient-to-r from-orange-500 to-amber-500 text-black shadow-md shadow-orange-500/20 scale-105"
                              : isMuted
                              ? "text-gray-300 hover:bg-gray-50"
                              : "text-gray-800 hover:bg-gray-100"
                          }`}
                        >
                          {day}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Confirm Action Button */}
              <div className="pt-2">
                <button
                  onClick={handleConfirmDate}
                  className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:brightness-110 active:brightness-95 text-black font-extrabold py-3.5 px-6 rounded-full text-sm tracking-wide transition-all shadow-lg shadow-orange-500/10 uppercase cursor-pointer"
                >
                  Confirm
                </button>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
