import React, { useEffect, useState } from "react";
import { Search, Lock } from "lucide-react";
import { adminSupabase } from "../../lib/adminSupabase";
import { useModal } from "../../components/GlobalModal";

interface Member {
  id: string;
  uid: string;
  phone: string;
  email: string;
  username: string;
  joined: string;
  deposits: number;
  withdrawals: number;
  balance: number;
  winLoss: number;
  lastActive: string;
  ipAddresses: string[];
  deviceIds: string[];
  status: "active" | "suspended" | "banned";
  referral_code: string;
}

export function MemberManagement() {
  const supabase = adminSupabase as any;
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"uid" | "phone" | "email">("uid");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<"add" | "deduct">("add");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  const { showModal, showConfirm } = useModal();

  useEffect(() => {
    const fetchMembers = async () => {
      setLoading(true);
      setError("");
      try {
        // Fetch ALL users regardless of status using service role (bypasses RLS)
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('id, phone_number, referral_code, created_at, vip_level, is_agent, main_balance, game_balance, status')
          .order('created_at', { ascending: false })
          .limit(500);

        if (usersError) throw usersError;

        const mapped = (users || []).map((row: any) => {
          const realUID = row.referral_code || '';
          return {
            id: row.id,
            uid: realUID,
            phone: row.phone_number || '',
            email: `${row.phone_number || 'member'}@winclub.com`,
            username: realUID,
            joined: row.created_at || '',
            deposits: 0,
            withdrawals: 0,
            balance: Number(row.main_balance ?? 0),
            winLoss: 0,
            lastActive: row.created_at || '',
            ipAddresses: [],
            deviceIds: [],
            status: (row.status || 'active') as 'active' | 'suspended' | 'banned',
            referral_code: realUID,
          };
        });

        setMembers(mapped);
      } catch (err: any) {
        console.error('Failed to load member data', err);
        setError(err?.message || 'Unable to load members.');
      } finally {
        setLoading(false);
      }
    };
    void fetchMembers();
  }, []);

  const filteredMembers = members.filter((member) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase().trim();
    if (searchType === "uid") {
      return member.uid.toLowerCase().includes(query);
    }
    if (searchType === "phone") return member.phone.includes(searchQuery);
    if (searchType === "email") return member.email.toLowerCase().includes(query);
    return true;
  });

  const handleAdjustBalance = async () => {
    if (!selectedMember) return;
    const amount = Number(adjustmentAmount);
    if (!amount || Number.isNaN(amount)) { void showModal({ title: 'Invalid Amount', message: 'Please enter a valid numeric amount.', variant: 'warning' }); return; }
    setUpdating(true); setError('');
    try {
      const nextBalance = adjustmentType === 'add'
        ? selectedMember.balance + amount
        : Math.max(0, selectedMember.balance - amount);

      // When adding balance, also increment wagering_required so the user
      // must wager the credited amount before withdrawing.
      const updatePayload: Record<string, any> = { main_balance: nextBalance };
      if (adjustmentType === 'add') {
        // Read current wagering_required first
        const { data: userRow } = await supabase
          .from('users')
          .select('wagering_required')
          .eq('id', selectedMember.id)
          .maybeSingle();
        const currentWager = Number((userRow as any)?.wagering_required ?? 0);
        updatePayload.wagering_required = currentWager + amount;
      }

      const { error } = await supabase.from('users').update(updatePayload).eq('id', selectedMember.id);
      if (error) throw error;
      setMembers(prev => prev.map(m => m.id === selectedMember.id ? { ...m, balance: nextBalance } : m));
      setSelectedMember(prev => prev ? { ...prev, balance: nextBalance } : prev);
      setShowAdjustmentModal(false);
      setAdjustmentAmount('');
    } catch (err: any) {
      setError(err?.message || 'Failed to update balance.');
    } finally { setUpdating(false); }
  };

  const handleMemberStateChange = async (nextStatus: 'suspended' | 'banned') => {
    if (!selectedMember) return;
    const confirmed = await showConfirm({
      title: nextStatus === 'banned' ? 'Ban Account' : 'Suspend Account',
      message: `Are you sure you want to ${nextStatus} ${selectedMember.username}? This action can be reversed.`,
      variant: 'danger',
      confirmLabel: nextStatus === 'banned' ? 'Ban' : 'Suspend',
    });
    if (!confirmed) return;
    setUpdating(true); setError('');
    try {
      const { error } = await supabase.from('users').update({ status: nextStatus }).eq('id', selectedMember.id);
      if (error) throw error;
      setMembers(prev => prev.map(m => m.id === selectedMember.id ? { ...m, status: nextStatus } : m));
      setSelectedMember(prev => prev ? { ...prev, status: nextStatus } : prev);
    } catch (err: any) {
      setError(err?.message || 'Unable to update account state.');
    } finally { setUpdating(false); }
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 md:p-8">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">Member Management</h1>
          <p className="text-gray-400 text-sm">Search, manage, and monitor user accounts</p>
        </div>

        {/* Search Section */}
        <div className="mb-6 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-4 md:p-6 border border-[#0f3460]">
          <h3 className="text-white font-bold mb-3">Advanced Search</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex gap-2">
              {["uid", "phone", "email"].map((type) => (
                <button key={type}
                  onClick={() => { setSearchType(type as "uid" | "phone" | "email"); setSearchQuery(""); }}
                  className={`px-3 py-2 rounded-lg font-medium text-sm transition-all min-h-[44px] ${
                    searchType === type
                      ? "bg-gradient-to-r from-[#e94560] to-[#ff6b6b] text-white"
                      : "bg-[#0f3460] text-gray-400 hover:text-white"
                  }`}>
                  {type.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search by ${searchType}...`}
                className="w-full bg-[#0f3460] border border-[#1a5f7a] rounded-lg px-4 py-2.5 pl-10 text-white placeholder-gray-500 focus:outline-none focus:border-[#e94560] transition-all" />
            </div>
          </div>
        </div>

        {/* ── MOBILE: single-column list + inline detail ── */}
        <div className="md:hidden">
          <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl border border-[#0f3460] overflow-hidden mb-4">
            <div className="p-4 border-b border-[#0f3460]">
              <h3 className="text-white font-bold text-sm">Members: <span className="text-[#e94560]">{filteredMembers.length}</span></h3>
            </div>
            {error && <div className="mx-4 mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
            <div className="divide-y divide-[#0f3460]">
              {loading ? (
                <div className="p-4 text-sm text-gray-500">Loading...</div>
              ) : filteredMembers.map((member) => (
                <div key={member.uid}>
                  <div onClick={() => setSelectedMember(selectedMember?.id === member.id ? null : member)}
                    className={`p-4 cursor-pointer transition-all ${
                      selectedMember?.id === member.id ? "bg-[#0f3460] border-l-4 border-[#e94560]" : "hover:bg-[#0f3460]/50"
                    }`}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-white font-bold text-sm">{member.uid || 'N/A'}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        member.status === "active" ? "bg-[#4ade80]/20 text-[#4ade80]" : "bg-[#ef4444]/20 text-[#ef4444]"
                      }`}>{member.status}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">{member.phone}</span>
                      <span className="text-[#3b82f6] font-bold">Rs {member.balance.toLocaleString()}</span>
                    </div>
                  </div>
                  {/* Inline expanded detail on mobile */}
                  {selectedMember?.id === member.id && (
                    <div className="bg-[#0a0f1e] p-4 border-t border-[#0f3460]">
                      <div className="space-y-3 mb-4 text-sm">
                        <div className="bg-[#0f3460] rounded-lg p-3">
                          <p className="text-gray-400 text-xs mb-1">Financial Summary</p>
                          <div className="flex justify-between mt-1"><span className="text-gray-400 text-xs">Balance</span><span className="text-[#3b82f6] font-bold">Rs {member.balance.toLocaleString()}</span></div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <button onClick={() => setShowAdjustmentModal(true)}
                          className="w-full py-3 bg-gradient-to-r from-[#3b82f6] to-[#1d4ed8] text-white rounded-lg font-medium text-sm min-h-[44px]">Adjust Balance</button>
                        <button onClick={() => void handleMemberStateChange('suspended')} disabled={updating}
                          className="w-full py-3 bg-[#ef4444]/20 text-[#ef4444] rounded-lg border border-[#ef4444]/50 font-medium text-sm min-h-[44px]">
                          {updating ? 'Updating...' : 'Suspend Account'}
                        </button>
                        <button onClick={() => void handleMemberStateChange('banned')} disabled={updating}
                          className="w-full py-3 bg-[#ef4444]/30 text-[#fda4af] rounded-lg border border-[#ef4444]/50 font-medium text-sm min-h-[44px]">
                          {updating ? 'Updating...' : 'Ban Account'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── DESKTOP: 2-col grid ── */}
        <div className="hidden md:grid grid-cols-3 gap-8">
          <div className="col-span-2">
            <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl border border-[#0f3460] overflow-hidden">
              <div className="p-6 border-b border-[#0f3460]">
                <h3 className="text-white font-bold">Members Found: <span className="text-[#e94560]">{filteredMembers.length}</span></h3>
              </div>
              {error && <div className="mx-6 mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
              <div className="divide-y divide-[#0f3460]">
                {loading ? (
                  <div className="p-6 text-sm text-gray-500">Loading live member rows...</div>
                ) : filteredMembers.map((member) => (
                  <div key={member.id} onClick={() => setSelectedMember(member)}
                    className={`p-4 cursor-pointer transition-all ${
                      selectedMember?.id === member.id ? "bg-[#0f3460] border-l-4 border-[#e94560]" : "hover:bg-[#0f3460]"
                    }`}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-white font-bold">UID: {member.uid || 'N/A'}</p>
                        <p className="text-gray-400 text-sm">{member.phone}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        member.status === "active" ? "bg-[#4ade80]/20 text-[#4ade80]" : "bg-[#ef4444]/20 text-[#ef4444]"
                      }`}>{member.status}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <p className="text-gray-400">Phone: <span className="text-[#fbbf24]">{member.phone}</span></p>
                      <p className="text-gray-400">Balance: <span className="text-[#3b82f6]">Rs {member.balance.toLocaleString()}</span></p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {selectedMember && (
            <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl border border-[#0f3460] p-6 h-fit">
              <h3 className="text-white font-bold text-lg mb-6">Member Profile</h3>
              <div className="space-y-4 mb-6">
                <div><p className="text-gray-400 text-sm">Username</p><p className="text-white font-bold">{selectedMember.username}</p></div>
                <div><p className="text-gray-400 text-sm">Phone</p><p className="text-white">{selectedMember.phone}</p></div>
                <div><p className="text-gray-400 text-sm">Email</p><p className="text-white text-sm break-all">{selectedMember.email}</p></div>
                <div><p className="text-gray-400 text-sm">Member Since</p><p className="text-white">{selectedMember.joined}</p></div>
              </div>
              <div className="bg-[#0f3460] rounded-lg p-4 mb-6">
                <h4 className="text-white font-bold mb-3 text-sm">Financial Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-400">Deposits:</span><span className="text-[#4ade80]">Rs {selectedMember.deposits.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Withdrawals:</span><span className="text-[#ef4444]">Rs {selectedMember.withdrawals.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Balance:</span><span className="text-[#3b82f6] font-bold">Rs {selectedMember.balance.toLocaleString()}</span></div>
                  <div className="flex justify-between pt-2 border-t border-[#1a5f7a]"><span className="text-gray-400">Win/Loss:</span><span className={selectedMember.winLoss >= 0 ? "text-[#4ade80]" : "text-[#ef4444]"}>{selectedMember.winLoss.toLocaleString()}</span></div>
                </div>
              </div>
              <div className="bg-[#0f3460] rounded-lg p-4 mb-6">
                <h4 className="text-white font-bold mb-3 text-sm flex items-center gap-2"><Lock className="w-4 h-4" /> Security</h4>
                <div className="space-y-2 text-xs">
                  <div><p className="text-gray-400 mb-1">IP Addresses ({selectedMember.ipAddresses.length})</p><p className="text-gray-300 font-mono bg-[#1a1a2e] px-2 py-1 rounded">{selectedMember.ipAddresses.join(", ")}</p></div>
                  <div><p className="text-gray-400 mb-1">Device IDs ({selectedMember.deviceIds.length})</p><p className="text-gray-300 font-mono bg-[#1a1a2e] px-2 py-1 rounded">{selectedMember.deviceIds.join(", ")}</p></div>
                </div>
              </div>
              <div className="space-y-3">
                <button onClick={() => setShowAdjustmentModal(true)}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-[#3b82f6] to-[#1d4ed8] text-white rounded-lg font-medium text-sm min-h-[44px]">Adjust Balance</button>
                <button onClick={() => void handleMemberStateChange('suspended')} disabled={updating}
                  className="w-full py-2.5 px-4 bg-[#ef4444]/20 text-[#ef4444] rounded-lg border border-[#ef4444]/50 font-medium text-sm min-h-[44px]">{updating ? 'Updating...' : 'Suspend Account'}</button>
                <button onClick={() => void handleMemberStateChange('banned')} disabled={updating}
                  className="w-full py-2.5 px-4 bg-[#ef4444]/30 text-[#fda4af] rounded-lg border border-[#ef4444]/50 font-medium text-sm min-h-[44px]">{updating ? 'Updating...' : 'Ban Account'}</button>
              </div>
            </div>
          )}
        </div>

        {/* Adjustment Modal */}
        {showAdjustmentModal && selectedMember && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="w-full max-w-md md:max-w-lg mx-auto rounded-2xl border border-[#0f3460] bg-gradient-to-br from-[#1a1a2e] to-[#16213e] p-6">
              <h3 className="text-white font-bold text-lg mb-4">Adjust Balance</h3>
              <p className="text-gray-400 text-sm mb-4">
                Current Balance: <span className="text-[#3b82f6] font-bold">Rs {selectedMember.balance.toLocaleString()}</span>
              </p>

              <div className="space-y-4 mb-6">
                <div className="flex gap-2">
                  {["add", "deduct"].map((type) => (
                    <button
                      key={type}
                      onClick={() => setAdjustmentType(type as "add" | "deduct")}
                      className={`flex-1 py-2 rounded-lg font-medium transition-all ${
                        adjustmentType === type
                          ? "bg-gradient-to-r from-[#e94560] to-[#ff6b6b] text-white"
                          : "bg-[#0f3460] text-gray-400"
                      }`}
                    >
                      {type === "add" ? "Add" : "Deduct"}
                    </button>
                  ))}
                </div>

                <input
                  type="number"
                  value={adjustmentAmount}
                  onChange={(e) => setAdjustmentAmount(e.target.value)}
                  placeholder="Amount in Rs"
                  className="w-full bg-[#0f3460] border border-[#1a5f7a] rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#e94560]"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAdjustmentModal(false);
                    setAdjustmentAmount("");
                  }}
                  className="flex-1 py-2 px-4 bg-[#0f3460] text-white rounded-lg border border-[#1a5f7a] hover:border-[#e94560] transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdjustBalance}
                  disabled={updating}
                  className="flex-1 py-2 px-4 bg-gradient-to-r from-[#4ade80] to-[#22c55e] text-white rounded-lg hover:shadow-lg transition-all font-medium"
                >
                  {updating ? 'Updating...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
