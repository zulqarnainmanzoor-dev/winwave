import React, { useState, useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useUser } from "../context/UserContext";

interface Invitee {
  id: string;
  phone_number: string | null;
  invite_code: string | null;
  created_at: string;
}

export default function NewInviteesView({ onBack }: { onBack: () => void }) {
  const { uid } = useUser();
  const [activeTab, setActiveTab] = useState<"today" | "yesterday" | "month">("today");
  const [invitees, setInvitees] = useState<Invitee[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!uid) return;
    setLoading(true);

    const now = new Date();
    const todayStart  = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayEnd    = new Date(todayStart.getTime() + 86400000);
    const yestStart   = new Date(todayStart.getTime() - 86400000);
    const monthStart  = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    let from: string, to: string;
    if (activeTab === "today") {
      from = todayStart.toISOString(); to = todayEnd.toISOString();
    } else if (activeTab === "yesterday") {
      from = yestStart.toISOString();  to = todayStart.toISOString();
    } else {
      from = monthStart.toISOString(); to = todayEnd.toISOString();
    }

    supabase
      .from("users")
      .select("id, phone_number, invite_code, created_at")
      .eq("referred_by", uid)
      .gte("created_at", from)
      .lt("created_at", to)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setInvitees((data as Invitee[]) ?? []);
        setLoading(false);
      });
  }, [uid, activeTab]);

  const maskPhone = (p: string | null) =>
    p ? p.slice(0, 4) + "****" + p.slice(-2) : "---";

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });

  const tabs = [
    { key: "today",     label: "Today" },
    { key: "yesterday", label: "Yesterday" },
    { key: "month",     label: "This month" },
  ] as const;

  return (
    <div className="flex-1 flex flex-col bg-[#0A0A0B] min-h-screen text-gray-200 animate-slide-up pb-[90px] no-scrollbar">
      <div className="h-12 bg-[#161618] flex items-center px-4 border-b border-white/5 sticky top-0 z-30 flex-shrink-0">
        <button onClick={onBack} className="p-1 hover:bg-white/10 rounded-full transition-colors cursor-pointer mr-3 text-gray-300 hover:text-white">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-white text-base font-black tracking-widest flex-1 text-center pr-9 uppercase">New Invitees</h1>
      </div>

      <div className="flex-1 p-4 space-y-4 overflow-y-auto no-scrollbar">
        <div className="flex justify-between gap-2 select-none">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 py-2.5 px-3 rounded-full text-xs font-black tracking-wider text-center transition-all cursor-pointer ${
                activeTab === key
                  ? "bg-gradient-to-r from-orange-500 to-amber-500 text-black shadow-lg shadow-orange-500/10"
                  : "bg-[#1C1C1E] text-gray-400 border border-white/5 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : invitees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="relative w-28 h-28 select-none flex items-center justify-center">
              <div className="absolute w-16 h-20 bg-[#1C1C1E]/85 rounded-2xl border border-white/10 rotate-[-12deg] shadow-lg flex flex-col justify-end p-3">
                <div className="w-10 h-1.5 bg-zinc-800 rounded-full mb-1.5" />
                <div className="w-8 h-1.5 bg-zinc-800 rounded-full" />
              </div>
              <div className="absolute w-16 h-20 bg-[#2C2C2E]/95 rounded-2xl border border-white/20 translate-x-3.5 translate-y-1 rotate-[6deg] shadow-2xl flex flex-col p-3 justify-center gap-2.5">
                <div className="w-11 h-1.5 bg-zinc-700/60 rounded-full" />
                <div className="w-9 h-1.5 bg-zinc-700/60 rounded-full" />
                <div className="w-10 h-1.5 bg-zinc-700/60 rounded-full" />
              </div>
            </div>
            <span className="text-xs font-black text-gray-500 uppercase tracking-widest">No Records</span>
          </div>
        ) : (
          <div className="bg-[#1C1C1E] border border-white/5 rounded-3xl overflow-hidden">
            <div className="grid grid-cols-3 bg-[#2C2C2E] p-3 text-[10px] font-black uppercase text-gray-400 tracking-wider text-center">
              <span>Phone</span>
              <span>Invite Code</span>
              <span>Joined</span>
            </div>
            <div className="divide-y divide-white/5">
              {invitees.map((u) => (
                <div key={u.id} className="grid grid-cols-3 p-3 text-xs text-center items-center">
                  <span className="font-mono text-white font-bold">{maskPhone(u.phone_number)}</span>
                  <span className="text-[#ffa502] font-bold">{u.invite_code ?? "—"}</span>
                  <span className="text-gray-400">{fmtDate(u.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
