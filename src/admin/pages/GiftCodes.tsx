import { useEffect, useState } from "react";
import { adminSupabase } from "../../lib/adminSupabase";
import { Plus, Pause, Play, Trash2, RefreshCw } from "lucide-react";

type GiftCodeRow = {
  id: string;
  code: string;
  amount: number;
  status: string;
  claimed_by: string | null;
  created_at: string;
  expires_at: string | null;
  admin_remarks: string | null;
};

export function GiftCodes() {
  const supabase = adminSupabase as any;
  const [codes, setCodes]         = useState<GiftCodeRow[]>([]);
  const [loading, setLoading]     = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newCode, setNewCode]     = useState("");
  const [newAmount, setNewAmount] = useState<number>(300);
  const [error, setError]         = useState("");

  const fetchCodes = async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error } = await (adminSupabase as any)
        .from("gift_codes")
        .select("*")
        .neq("status", "deleted")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      setCodes(data || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load gift codes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchCodes(); }, []);

  const generateCode = () =>
    `GC-${Math.random().toString(36).slice(2, 6).toUpperCase()}${Math.floor(1000 + Math.random() * 9000)}`;

  const handleCreate = async () => {
    setError("");
    const code = newCode.trim().toUpperCase() || generateCode();
    if (!newAmount || newAmount <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    // Verify admin session via sessionStorage (adminSupabase uses service_role key,
    // not a user JWT, so auth.getSession() is always null for it)
    const isAdminAuth = sessionStorage.getItem("admin_authenticated") === "true";
    if (!isAdminAuth) {
      setError("Admin session expired. Please log in again via Admin Login.");
      return;
    }

    try {
      const { error } = await supabase
        .from("gift_codes")
        .insert([{ code, amount: newAmount, status: "active" }]);
      if (error) throw error;
      setShowModal(false);
      setNewCode("");
      setNewAmount(300);
      await fetchCodes();
    } catch (err: any) {
      setError(err?.message || "Failed to create gift code");
    }
  };

  const togglePause = async (row: GiftCodeRow) => {
    setError("");
    try {
      const { error } = await supabase
        .from("gift_codes")
        .update({ status: row.status === "paused" ? "active" : "paused" })
        .eq("id", row.id);
      if (error) throw error;
      await fetchCodes();
    } catch (err: any) {
      setError(err?.message || "Failed to update status");
    }
  };

  const handleDelete = async (row: GiftCodeRow) => {
    if (!confirm(`Delete gift code "${row.code}"?`)) return;
    setError("");
    try {
      const { error } = await supabase
        .from("gift_codes")
        .update({ status: "deleted" })
        .eq("id", row.id);
      if (error) throw error;
      await fetchCodes();
    } catch (err: any) {
      setError(err?.message || "Failed to delete");
    }
  };

  const statusBadge = (s: string) => {
    if (s === "active")  return "bg-emerald-500/20 text-emerald-400";
    if (s === "paused")  return "bg-amber-500/20 text-amber-400";
    if (s === "claimed") return "bg-blue-500/20 text-blue-400";
    return "bg-red-500/20 text-red-400";
  };

  return (
    <div className="p-8 bg-[#0a0a0b] min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Gift Codes</h1>
          <p className="text-gray-400 text-sm mt-1">Create and manage reward gift codes</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchCodes}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a1a2e] border border-[#0f3460] text-gray-300 rounded-lg hover:border-amber-500/50 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => { setShowModal(true); setError(""); }}
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black px-4 py-2 rounded-lg font-bold text-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Create Code
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="bg-[#1a1a2e] rounded-xl border border-[#0f3460] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#0f3460] text-gray-400 text-xs uppercase">
            <tr>
              <th className="py-3 px-4 text-left">Gift Code</th>
              <th className="py-3 px-4 text-left">Amount</th>
              <th className="py-3 px-4 text-left">Status</th>
              <th className="py-3 px-4 text-left">Claimed By</th>
              <th className="py-3 px-4 text-left">Created</th>
              <th className="py-3 px-4 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-12 text-center text-gray-500">Loading...</td></tr>
            ) : codes.length === 0 ? (
              <tr><td colSpan={6} className="py-12 text-center text-gray-500">No gift codes yet. Create one above.</td></tr>
            ) : (
              codes.map((row) => (
                <tr key={row.id} className="border-t border-[#0f3460]/60 hover:bg-[#0f3460]/40 transition-colors">
                  <td className="py-3 px-4 text-white font-mono font-bold tracking-wider">{row.code}</td>
                  <td className="py-3 px-4 text-amber-400 font-bold">Rs {Number(row.amount).toLocaleString()}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusBadge(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-400 text-xs font-mono">{row.claimed_by || "—"}</td>
                  <td className="py-3 px-4 text-gray-500 text-xs">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => togglePause(row)}
                        className="flex items-center gap-1 px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white transition-all"
                      >
                        {row.status === "paused"
                          ? <><Play className="w-3 h-3" /> Resume</>
                          : <><Pause className="w-3 h-3" /> Pause</>}
                      </button>
                      <button
                        onClick={() => handleDelete(row)}
                        className="flex items-center gap-1 px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-xs text-red-400 transition-all"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md bg-[#1a1a2e] border border-[#0f3460] rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Create Gift Code</h3>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 block mb-1">
                  Code <span className="text-gray-600">(leave blank to auto-generate)</span>
                </label>
                <input
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  placeholder="e.g. GIFT2024"
                  className="w-full bg-[#0f3460] border border-[#1a5f7a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 font-mono uppercase"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Amount (Rs)</label>
                <input
                  type="number"
                  value={newAmount}
                  onChange={(e) => setNewAmount(Number(e.target.value))}
                  className="w-full bg-[#0f3460] border border-[#1a5f7a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowModal(false); setNewCode(""); setNewAmount(300); setError(""); }}
                className="flex-1 bg-[#0f3460] text-white py-2.5 rounded-lg border border-[#1a5f7a] hover:border-red-500 transition-all text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-black py-2.5 rounded-lg font-bold text-sm transition-all"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GiftCodes;
