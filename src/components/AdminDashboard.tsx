import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Grid, ShieldCheck, Users, Wallet, Settings2, Trophy, Activity, Search, FileText, UserCheck, ArrowRight, ArrowLeft, Sparkles, Cpu, Flag, CheckCircle2, XCircle } from 'lucide-react';
import Sidebar, { MenuSection } from './Sidebar';
import GameController from './GameController';
import { supabase } from '../lib/supabase';

interface MemberRecord {
  uid: string;
  phone: string;
  email: string;
  status: string;
  ip: string;
  device: string;
  balance: number;
  wins: number;
  losses: number;
  lastSignInAt?: string | null;
}

const initialMembers: MemberRecord[] = [
  { uid: 'B9G8812X', phone: '03123456789', email: '03123456789@winwave.com', status: 'Active', ip: '103.45.12.87', device: 'Samsung A52', balance: 1200, wins: 18, losses: 6 },
  { uid: 'B9G8812Y', phone: '03229876543', email: '03229876543@winwave.com', status: 'Inactive', ip: '194.35.88.12', device: 'iPhone 12', balance: 470, wins: 10, losses: 8 },
  { uid: 'B9G8812Z', phone: '03011223344', email: '03011223344@winwave.com', status: 'Active', ip: '103.45.12.234', device: 'Vivo Y21', balance: 3050, wins: 34, losses: 12 },
];

const historyRecords = {
  game: [
    { id: 'H001', title: 'WinGo round', amount: 'Rs 250', result: 'Win', date: '2026-06-28 17:12' },
    { id: 'H002', title: 'K3 bet', amount: 'Rs 800', result: 'Loss', date: '2026-06-28 16:54' },
  ],
  recharge: [
    { id: 'R001', uid: 'B9G8812X', amount: 'Rs 15,000', status: 'Completed', date: '2026-06-28 14:10' },
    { id: 'R002', uid: 'B9G8812Y', amount: 'Rs 2,500', status: 'Pending', date: '2026-06-28 15:25' },
  ],
  bet: [
    { id: 'B001', uid: 'B9G8812Z', game: 'Trx', amount: 'Rs 7,400', status: 'Settled', date: '2026-06-28 13:40' },
    { id: 'B002', uid: 'B9G8812X', game: '5D', amount: 'Rs 1,200', status: 'Pending', date: '2026-06-28 12:15' },
  ],
  withdraw: [
    { id: 'W001', uid: 'B9G8812Y', amount: 'Rs 10,000', status: 'Pending', date: '2026-06-28 11:52' },
    { id: 'W002', uid: 'B9G8812Z', amount: 'Rs 3,250', status: 'Approved', date: '2026-06-28 09:08' },
  ],
};

const withdrawRequests = [
  { id: 'WD-1001', uid: 'B9G8812Y', amount: 'Rs 10,000', method: 'JazzCash', status: 'Pending', remark: 'VIP withdrawal' },
  { id: 'WD-1002', uid: 'B9G8812X', amount: 'Rs 3,250', method: 'Bank Transfer', status: 'Approved', remark: 'Verified KYC' },
];

const depositRequests = [
  { id: 'DP-2001', uid: 'B9G8812Z', amount: 'Rs 15,000', method: 'Easypaisa', status: 'Completed', remark: 'Promo deposit' },
  { id: 'DP-2002', uid: 'B9G8812X', amount: 'Rs 8,500', method: 'USDT', status: 'Pending', remark: 'Awaiting payment confirmation' },
];

export default function AdminDashboard() {
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [activeGame, setActiveGame] = useState<string>('WinGo');
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<typeof initialMembers[number] | null>(initialMembers[0]);
  const [members, setMembers] = useState(initialMembers);
  const [activeHistoryTab, setActiveHistoryTab] = useState<'game' | 'recharge' | 'bet' | 'withdraw'>('game');
  const [agentTasks, setAgentTasks] = useState([{
    id: 'AG-01', uid: 'B9G8812X', type: 'Agent Promotion', target: 'Face Member 50', status: 'Pending' as const, remarks: 'Review KYC and payment history', approved: false,
  },{
    id: 'AG-02', uid: 'B9G8812Z', type: 'Withdrawal Approval', target: 'Complete 30 tasks', status: 'Approved' as const, remarks: 'Eligible for stage 2', approved: true,
  }]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberLoadError, setMemberLoadError] = useState<string | null>(null);

  const sectionMeta: MenuSection[] = useMemo(() => [
    { id: 'overview', label: 'Overview', icon: <BarChart3 size={18} /> },
    {
      id: 'games',
      label: 'Games Management',
      icon: <Trophy size={18} />,
      children: [
        { id: 'game-vingo', label: 'WinGo', icon: <Sparkles size={16} /> },
        { id: 'game-k3', label: 'K3', icon: <Sparkles size={16} /> },
        { id: 'game-trx', label: 'Trx', icon: <Sparkles size={16} /> },
        { id: 'game-5d', label: '5D', icon: <Sparkles size={16} /> },
      ],
    },
    {
      id: 'history',
      label: 'History Logs',
      icon: <FileText size={18} />,
      children: [
        { id: 'history-game', label: 'Game History', icon: <Activity size={16} /> },
        { id: 'history-recharge', label: 'Recharge History', icon: <Wallet size={16} /> },
        { id: 'history-bet', label: 'Bet History', icon: <Grid size={16} /> },
        { id: 'history-withdraw', label: 'Withdraw History', icon: <ArrowRight size={16} /> },
      ],
    },
    { id: 'members', label: 'Member Management', icon: <Users size={18} /> },
    {
      id: 'funds',
      label: 'Funds Management',
      icon: <Wallet size={18} />,
      children: [
        { id: 'funds-withdraw', label: 'Withdraw Requests', icon: <ShieldCheck size={16} /> },
        { id: 'funds-deposit', label: 'Deposit Requests', icon: <ShieldCheck size={16} /> },
      ],
    },
    { id: 'agents', label: 'Agent Management', icon: <UserCheck size={18} /> },
    { id: 'settings', label: 'Settings', icon: <Settings2 size={18} /> },
  ], []);

  useEffect(() => {
    const loadMembers = async () => {
      setMembersLoading(true);
      setMemberLoadError(null);
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, phone_number, referral_code')
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) {
          throw error;
        }

        if (Array.isArray(data)) {
          const loaded = data.map((m: any) => ({
            uid: m.id,
            phone: m.phone_number || '',
            email: `${m.phone_number || 'unknown'}@winwave.com`,
            status: 'Active',
            ip: 'Unknown',
            device: 'Unknown',
            balance: 0,
            wins: 0,
            losses: 0,
            lastSignInAt: null,
          }));
          setMembers(loaded.length ? loaded : initialMembers);
          setSelectedMember((prev) => prev ?? (loaded[0] || initialMembers[0]));
        }
      } catch (err: any) {
        setMemberLoadError(err?.message || 'Failed to load members');
      } finally {
        setMembersLoading(false);
      }
    };

    loadMembers();
  }, []);

  const filteredMembers = members.filter((member) => {
    const query = memberSearch.toLowerCase();
    return (
      member.uid.toLowerCase().includes(query) ||
      member.phone.toLowerCase().includes(query) ||
      member.email.toLowerCase().includes(query)
    );
  });

  const selectedHistory = historyRecords[activeHistoryTab];

  const sectionTitle = useMemo(() => {
    if (activeSection === 'overview') return 'Overview';
    if (activeSection.startsWith('game-')) return `Game Management / ${activeSection.split('-')[1].toUpperCase()}`;
    if (activeSection.startsWith('history-')) return `History Logs / ${activeSection.split('-')[1].replace('recharge', 'Recharge').replace('withdraw', 'Withdraw').toUpperCase()}`;
    if (activeSection === 'members') return 'Member Management';
    if (activeSection === 'funds-withdraw') return 'Funds Management / Withdraw Requests';
    if (activeSection === 'funds-deposit') return 'Funds Management / Deposit Requests';
    if (activeSection === 'agents') return 'Agent Management';
    if (activeSection === 'settings') return 'Settings';
    return 'Admin';
  }, [activeSection]);

  return (
    <div className="min-h-screen bg-[#070708] text-white">
      <div className="lg:grid lg:grid-cols-[320px_minmax(0,1fr)] gap-4 xl:gap-6 p-4 lg:p-6">
        <Sidebar
          sections={sectionMeta}
          activeSection={activeSection}
          onChange={(id) => {
            setActiveSection(id);
            if (id.startsWith('game-')) {
              setActiveGame(id.split('-')[1] === 'vingo' ? 'WinGo' : id.split('-')[1].toUpperCase());
            }
          }}
        />

        <main className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-amber-400/80">Admin Panel</p>
              <h1 className="text-3xl font-black tracking-tight mt-2">{sectionTitle}</h1>
              <p className="mt-2 text-sm text-gray-400 max-w-2xl">
                Manage users, game configuration, funds, and system settings from a single secure admin console.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold hover:bg-white/10 transition">Sync data</button>
              <button className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-black hover:bg-amber-400 transition">Publish updates</button>
            </div>
          </div>

          {activeSection === 'overview' && (
            <section className="grid gap-4 xl:grid-cols-2">
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { label: 'Total Recharge Today', value: 'Rs 1,250,000', icon: <ArrowRight size={18} /> },
                  { label: 'Total Active Users', value: '1,854', icon: <Users size={18} /> },
                  { label: 'Total Users', value: '8,492', icon: <Grid size={18} /> },
                  { label: 'Total Withdrawals', value: 'Rs 512,000', icon: <Wallet size={18} /> },
                ].map((card) => (
                  <div key={card.label} className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-black/20">
                    <div className="flex items-center justify-between gap-3 mb-5">
                      <div className="rounded-2xl bg-amber-500/10 p-3 text-amber-300">{card.icon}</div>
                      <span className="text-xs uppercase tracking-[0.35em] text-gray-400">Live</span>
                    </div>
                    <div className="text-sm text-gray-400">{card.label}</div>
                    <div className="mt-3 text-3xl font-black tracking-tight">{card.value}</div>
                  </div>
                ))}
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/20">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.35em] text-gray-400">Balance Overview</p>
                    <h2 className="mt-3 text-2xl font-black">Rs 14,850,300</h2>
                  </div>
                  <span className="rounded-2xl bg-emerald-500/10 px-3 py-2 text-sm font-bold text-emerald-300">Stable</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl border border-white/10 bg-[#0D0D11] p-4">
                    <p className="text-xs uppercase tracking-[0.35em] text-gray-400">Pending Payouts</p>
                    <p className="mt-4 text-xl font-bold">Rs 2,750,000</p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-[#0D0D11] p-4">
                    <p className="text-xs uppercase tracking-[0.35em] text-gray-400">Available Liquidity</p>
                    <p className="mt-4 text-xl font-bold">Rs 9,880,300</p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeSection.startsWith('game-') && (
            <section className="grid gap-4">
              <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/20">
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <div>
                      <p className="text-xs uppercase tracking-[0.35em] text-gray-400">Game Manager</p>
                      <h2 className="mt-2 text-2xl font-black">{activeGame}</h2>
                    </div>
                    <div className="rounded-2xl bg-amber-500/10 px-3 py-2 text-sm font-bold uppercase tracking-[0.35em] text-amber-300">Live mode</div>
                  </div>
                  <GameController
                    gameName={activeGame}
                    options={['30s', '1m', '3m', '5m']}
                  />
                  <div className="mt-6 rounded-3xl border border-white/10 bg-[#0D0D11] p-5">
                    <h3 className="text-base font-bold mb-3">Smart Risk Management</h3>
                    <p className="text-sm text-gray-400 mb-4">Enable AI-driven payout stabilization for {activeGame}. This helps keep house edge intelligent and responsive.</p>
                    <button className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-bold text-black hover:bg-amber-400 transition">
                      <Sparkles size={18} /> Toggle smart risk
                    </button>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/20">
                  <div className="flex items-center justify-between gap-3 mb-5">
                    <div>
                      <p className="text-xs uppercase tracking-[0.35em] text-gray-400">Game Controls</p>
                      <h3 className="mt-2 text-xl font-black">Payout & session rules</h3>
                    </div>
                    <span className="rounded-full bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.35em] text-gray-300">Fast access</span>
                  </div>
                  <div className="space-y-4">
                    {['Payout floor', 'Max bet multiplier', 'Entry fee', 'Ticket cap'].map((label) => (
                      <div key={label} className="rounded-3xl border border-white/10 bg-[#0D0D11] p-4">
                        <p className="text-sm text-gray-400">{label}</p>
                        <div className="mt-3 flex items-center gap-3">
                          <input type="text" value="Enabled" readOnly className="w-full rounded-2xl border border-white/10 bg-[#111214] px-4 py-3 text-sm text-white" />
                          <button className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-bold text-black hover:bg-amber-400 transition">Edit</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeSection.startsWith('history-') && (
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/20">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-gray-400">History Logs</p>
                  <h2 className="mt-2 text-2xl font-black">{sectionTitle}</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['game','recharge','bet','withdraw'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveHistoryTab(tab)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeHistoryTab === tab ? 'bg-amber-500 text-black' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}
                    >
                      {tab === 'game' ? 'Game History' : tab === 'recharge' ? 'Recharge History' : tab === 'bet' ? 'Bet History' : 'Withdraw History'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0D0D11]">
                <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-4 px-6 py-4 text-xs uppercase tracking-[0.35em] text-gray-400 bg-white/5">
                  <span>Description</span>
                  <span>Status</span>
                  <span>Amount / UID</span>
                  <span>Date</span>
                </div>
                <div className="divide-y divide-white/5">
                  {selectedHistory.map((record) => (
                    <div key={record.id} className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-4 px-6 py-4 items-center text-sm text-gray-200">
                      <span>{record.title || `${record.game || ''} ${record.uid ? `(${record.uid})` : ''}`}</span>
                      <span>{record.result || record.status}</span>
                      <span>{record.amount}</span>
                      <span>{record.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {activeSection === 'members' && (
            <section className="grid gap-4 xl:grid-cols-[1.4fr_0.7fr]">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/20">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-gray-400">Member Search</p>
                    <h2 className="mt-2 text-2xl font-black">Search & profile list</h2>
                  </div>
                  <button className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold hover:bg-white/10 transition">Export CSV</button>
                </div>
                <div className="grid gap-4 sm:grid-cols-[1fr_280px] mb-6">
                  <input
                    className="rounded-3xl border border-white/10 bg-[#0D0D11] px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500"
                    placeholder="Search by UID, Email or Phone"
                    value={memberSearch}
                    onChange={(event) => setMemberSearch(event.target.value)}
                  />
                  <button
                    onClick={() => setMemberSearch('')}
                    className="rounded-3xl bg-amber-500 px-4 py-3 text-sm font-bold text-black hover:bg-amber-400 transition"
                  >
                    Clear search
                  </button>
                </div>
                <div className="space-y-4">
                  {filteredMembers.map((member) => (
                    <button
                      key={member.uid}
                      onClick={() => setSelectedMember(member)}
                      className={`w-full rounded-3xl border border-white/10 p-4 text-left transition ${selectedMember?.uid === member.uid ? 'bg-amber-500/10 border-amber-500/30' : 'bg-[#0D0D11] hover:bg-white/5'}`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-bold">{member.uid}</p>
                          <p className="text-xs text-gray-400">{member.email} · {member.phone}</p>
                        </div>
                        <span className="rounded-full px-3 py-1 text-xs font-semibold text-gray-200 bg-white/5">{member.status}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/20">
                <div className="flex items-center justify-between gap-3 mb-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-gray-400">Member details</p>
                    <h3 className="mt-2 text-xl font-black">{selectedMember?.uid}</h3>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-3 py-2 text-xs uppercase tracking-[0.35em] text-emerald-200">Live</span>
                </div>
                <div className="space-y-4 text-sm text-gray-300">
                  <div className="grid gap-2">
                    <span className="font-semibold">Phone</span>
                    <span>{selectedMember?.phone}</span>
                  </div>
                  <div className="grid gap-2">
                    <span className="font-semibold">Email</span>
                    <span>{selectedMember?.email}</span>
                  </div>
                  <div className="grid gap-2">
                    <span className="font-semibold">IP / Device</span>
                    <span>{selectedMember?.ip} · {selectedMember?.device}</span>
                  </div>
                  <div className="grid gap-2">
                    <span className="font-semibold">Balance</span>
                    <span>Rs {selectedMember?.balance.toLocaleString()}</span>
                  </div>
                  <div className="grid gap-2">
                    <span className="font-semibold">Win / Loss</span>
                    <span>{selectedMember?.wins} wins · {selectedMember?.losses} losses</span>
                  </div>
                </div>
                <div className="mt-6 space-y-3">
                  <button className="w-full rounded-3xl bg-amber-500 px-4 py-3 text-sm font-bold text-black hover:bg-amber-400 transition">Add funds</button>
                  <button className="w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold hover:bg-white/10 transition">Deduct funds</button>
                </div>
              </div>
            </section>
          )}

          {(activeSection === 'funds-withdraw' || activeSection === 'funds-deposit') && (
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/20">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-gray-400">Funds Management</p>
                  <h2 className="mt-2 text-2xl font-black">{activeSection === 'funds-withdraw' ? 'Withdraw Requests' : 'Deposit Requests'}</h2>
                </div>
                <button className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-bold text-black hover:bg-amber-400 transition">Refresh requests</button>
              </div>
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0D0D11]">
                <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-4 px-6 py-4 text-xs uppercase tracking-[0.35em] text-gray-400 bg-white/5">
                  <span>UID</span>
                  <span>Amount</span>
                  <span>Method</span>
                  <span>Status</span>
                </div>
                <div className="divide-y divide-white/5">
                  {(activeSection === 'funds-withdraw' ? withdrawRequests : depositRequests).map((req) => (
                    <div key={req.id} className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-4 px-6 py-4 items-center text-sm text-gray-200">
                      <span>{req.uid}</span>
                      <span>{req.amount}</span>
                      <span>{req.method}</span>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${req.status === 'Pending' ? 'bg-yellow-500/20 text-yellow-300' : req.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-700 text-gray-300'}`}>{req.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {activeSection === 'agents' && (
            <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/20">
                <div className="flex items-center justify-between gap-3 mb-6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-gray-400">Agent Management</p>
                    <h2 className="mt-2 text-2xl font-black">Approve agents & tasks</h2>
                  </div>
                  <button className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-bold text-black hover:bg-amber-400 transition">Stage review</button>
                </div>
                <div className="space-y-4">
                  {agentTasks.map((task) => (
                    <div key={task.id} className="rounded-3xl border border-white/10 bg-[#0D0D11] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                        <div>
                          <p className="text-sm font-bold">{task.type}</p>
                          <p className="text-xs text-gray-400">UID {task.uid} · {task.target}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${task.approved ? 'bg-emerald-500/20 text-emerald-300' : 'bg-yellow-500/20 text-yellow-300'}`}>{task.status}</span>
                      </div>
                      <p className="text-sm text-gray-300 mb-3">{task.remarks}</p>
                      <div className="flex flex-wrap gap-3">
                        <button className="rounded-2xl bg-amber-500 px-4 py-2 text-xs font-bold text-black hover:bg-amber-400 transition">Approve</button>
                        <button className="rounded-2xl border border-white/10 px-4 py-2 text-xs text-gray-200 hover:bg-white/5 transition">Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/20">
                <p className="text-xs uppercase tracking-[0.35em] text-gray-400 mb-4">Agent growth targets</p>
                <div className="space-y-4">
                  {['Face/Real Member goal', 'Recruitment quota', 'Commission approval rate'].map((item) => (
                    <div key={item} className="rounded-3xl border border-white/10 bg-[#0D0D11] p-4">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <p className="font-semibold">{item}</p>
                        <span className="text-xs text-gray-400">Active</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full w-[72%] bg-amber-500"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {activeSection === 'settings' && (
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/20">
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { name: 'Maintenance Mode', value: 'Off' },
                  { name: 'API Rate Limit', value: 'Enabled' },
                  { name: 'Auto Payout', value: 'Balanced' },
                  { name: 'Allow New Registrations', value: 'On' },
                ].map((setting) => (
                  <div key={setting.name} className="rounded-3xl border border-white/10 bg-[#0D0D11] p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{setting.name}</p>
                      <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-gray-300">{setting.value}</span>
                    </div>
                    <p className="mt-3 text-sm text-gray-400">Configure platform behavior and security rules for the live game environment.</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

