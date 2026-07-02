import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { Plus, Pause, Play, Trash2 } from "lucide-react";

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
  const [codes, setCodes] = useState<GiftCodeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTable, setActiveTable] = useState("gift_codes");
  const [showModal, setShowModal] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newAmount, setNewAmount] = useState<number>(300);
  const [error, setError] = useState("");

  const isMissingTableError = (error: any) => ["42P01", "PGRST205", "PGRST116"].includes(error?.code) || /table|relation/i.test(error?.message || "");

  const fetchCodes = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase
        .from('gift_codes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      setCodes(data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load gift codes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generateRandomCode = () => {
    return `RE-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
  };

  const handleCreate = async () => {
    setError('');
    const code = newCode.trim() || generateRandomCode();
    if (!newAmount || newAmount <= 0) { setError('Please enter a valid amount.'); return; }
    try {
      const { error } = await supabase
        .from('gift_codes')
        .insert([{ code, amount: newAmount, status: 'active' }]);
      if (error) throw error;
      setShowModal(false);
      setNewCode('');
      setNewAmount(300);
      await fetchCodes();
    } catch (err: any) {
      setError(err?.message || 'Failed to create gift code');
    }
  };

  const togglePause = async (row: GiftCodeRow) => {
    try {
      const { error } = await supabase.from('gift_codes').update({ status: row.status === 'paused' ? 'active' : 'paused' }).eq('id', row.id);
      if (error) throw error;
      await fetchCodes();
    } catch (err: any) { setError(err?.message || 'Failed to update'); }
  };

  const handleDelete = async (row: GiftCodeRow) => {
    if (!confirm(`Delete gift code ${row.code}?`)) return;
    try {
      const { error } = await supabase.from('gift_codes').update({ status: 'deleted' }).eq('id', row.id);
      if (error) throw error;
      await fetchCodes();
    } catch (err: any) { setError(err?.message || 'Failed to delete'); }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Gift Codes</h1>
          <p className="text-gray-400">Create and manage red-envelope gift codes</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 bg-amber-500 text-black px-4 py-2 rounded-lg font-bold"> <Plus className="w-4 h-4"/> Create Code</button>
        </div>
      </div>

      {error && <div className="mb-4 text-sm text-red-400">{error}</div>}

      <div className="bg-[#0f172a] rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#0b1322] text-gray-400 text-xs uppercase">
            <tr>
              <th className="py-3 px-4 text-left">Gift Code</th>
              <th className="py-3 px-4 text-left">Status</th>
              <th className="py-3 px-4 text-left">Claimed By</th>
              <th className="py-3 px-4 text-left">Amount</th>
              <th className="py-3 px-4 text-left">Created</th>
              <th className="py-3 px-4 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-8 text-center text-gray-400">Loading...</td></tr>
            ) : codes.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-gray-400">No gift codes</td></tr>
            ) : (
              codes.map((row) => (
                <tr key={row.id} className="border-t border-white/5 hover:bg-white/5 transition-all">
                  <td className="py-3 px-4 text-white font-mono">{row.code}</td>
                  <td className="py-3 px-4 text-sm">{row.status}</td>
                  <td className="py-3 px-4 text-sm">{row.claimed_by || '-'}</td>
                  <td className="py-3 px-4 text-sm">Rs {row.amount.toLocaleString()}</td>
                  <td className="py-3 px-4 text-sm">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="py-3 px-4 text-sm">
                    <div className="flex gap-2">
                      <button onClick={() => togglePause(row)} className="px-3 py-1 rounded bg-white/5 text-sm text-white">{row.status === 'paused' ? <><Play className="w-4 h-4 inline"/> Resume</> : <><Pause className="w-4 h-4 inline"/> Pause</>}</button>
                      <button onClick={() => handleDelete(row)} className="px-3 py-1 rounded bg-red-600 text-sm text-white"><Trash2 className="w-4 h-4 inline"/> Delete</button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md md:max-w-lg mx-auto rounded-2xl border border-white/10 bg-[#0f172a] p-6">
            <h3 className="text-lg font-bold text-white mb-3">Create Gift Code</h3>
            <label className="text-sm text-gray-400">Code (leave blank to auto-generate)</label>
            <input value={newCode} onChange={(e) => setNewCode(e.target.value)} className="w-full bg-transparent border border-white/10 rounded p-2 mt-2 text-white" />
            <label className="text-sm text-gray-400 mt-3 block">Amount</label>
            <input type="number" value={newAmount} onChange={(e) => setNewAmount(Number(e.target.value))} className="w-full bg-transparent border border-white/10 rounded p-2 mt-2 text-white" />
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setShowModal(false); setNewCode(""); setNewAmount(300); }} className="flex-1 bg-white/5 text-white py-2 rounded">Cancel</button>
              <button onClick={handleCreate} className="flex-1 bg-amber-500 text-black py-2 rounded font-bold">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GiftCodes;
