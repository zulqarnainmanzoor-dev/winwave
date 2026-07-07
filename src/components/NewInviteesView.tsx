import React, { useEffect, useState } from "react";
import { ChevronLeft, AlertCircle, ChevronRight } from "lucide-react";
import { useUser } from "../context/UserContext";
import { adminSupabase } from "../lib/adminSupabase";

interface Invitee {
  id: string;
  phone_number: string | null;
  referral_code?: string | null;
  invite_code?: string | null;
  created_at: string;
}

const PAGE_SIZE = 20;

export default function NewInviteesView({ onBack }: { onBack: () => void }) {
  const { uid } = useUser();
  const [activeTab, setActiveTab] = useState<"today" | "yesterday" | "month">("today");
  const [invitees, setInvitees] = useState<Invitee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (!uid) {
      setInvitees([]);
      setError(null);
      setHasMore(false);
      setPage(0);
      return;
    }

    let cancelled = false;
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    const yestStart = new Date(todayStart.getTime() - 86400000);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    let from: string;
    let to: string;
    if (activeTab === "today") {
      from = todayStart.toISOString();
      to = todayEnd.toISOString();
    } else if (activeTab === "yesterday") {
      from = yestStart.toISOString();
      to = todayStart.toISOString();
    } else {
      from = monthStart.toISOString();
      to = todayEnd.toISOString();
    }

    const fetchInvitees = async () => {
      setLoading(true);
      setError(null);
      const offset = page * PAGE_SIZE;

      try {
        let query = (adminSupabase as any)
          .from('users')
          .select('id, phone_number, referral_code, invite_code, created_at', { count: 'exact' })
          .eq('referred_by', uid)
          .order('created_at', { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);

        if (activeTab === 'today') {
          query = query.gte('created_at', from).lt('created_at', to);
        } else if (activeTab === 'yesterday') {
          query = query.gte('created_at', from).lt('created_at', to);
        } else {
          query = query.gte('created_at', from).lt('created_at', to);
        }

        const { data, error } = await query;

        if (cancelled) return;
        if (error) throw error;

        const rows = (data || []).map((u: any) => {
          // Use 9-digit numeric UID from referral_code
          const numericUid = u.referral_code || '000000000';
          
          return {
            id: u.id,
            phone_number: u.phone_number,
            referral_code: u.referral_code,
            invite_code: numericUid, // Store 9-digit numeric UID
            created_at: u.created_at,
          };
        }) as Invitee[];
        setInvitees(page === 0 ? rows : (prev) => [...prev, ...rows]);
        setHasMore((rows.length || 0) === PAGE_SIZE);
      } catch (queryError: any) {
        console.error("Supabase Error:", queryError);
        if (cancelled) return;
        setError(queryError.message || "Unable to load invitees right now.");
        setInvitees([]);
        setHasMore(false);
      }

      setLoading(false);
    };

    void fetchInvitees();
    return () => {
      cancelled = true;
    };
  }, [uid, activeTab, page]);

  const maskPhone = (p: string | null) =>
    p ? p.slice(0, 4) + "****" + p.slice(-2) : "---";

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });

  const tabs = [
    { key: "today", label: "Today" },
    { key: "yesterday", label: "Yesterday" },
    { key: "month", label: "This month" },
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
              onClick={() => {
                setActiveTab(key);
                setPage(0);
              }}
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

        {loading && page === 0 ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-4 text-center text-sm text-red-300">
            {error}
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
            <div className="text-center">
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest">No Records</p>
              <p className="mt-1 text-[11px] text-gray-600">Your direct invitees will appear here once they register.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
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
                    <span className="text-[#ffa502] font-bold">{u.invite_code || u.referral_code || "—"}</span>
                    <span className="text-gray-400">{fmtDate(u.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>

            {hasMore ? (
              <button
                onClick={() => setPage((prev) => prev + 1)}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-4 py-3 text-sm font-black uppercase tracking-[0.2em] text-orange-300"
              >
                Load more
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : null}

            {loading && page > 0 ? (
              <div className="flex justify-center py-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
