import { useState, useEffect } from 'react';
import { ChevronLeft, ArrowDownToLine, ArrowUpFromLine, RefreshCw, Filter, CalendarDays, HelpCircle } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../lib/supabase';

interface Transaction {
  id: string;
  type: 'move_in' | 'move_out';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
}

export default function TransactionView({ onBack }: { onBack: () => void }) {
  const { balance, uid } = useUser();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'move_in' | 'move_out'>('move_in');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setTransactions(data || []);
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (uid) {
      fetchTransactions();
    }
  }, [uid]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchTransactions();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const filteredTransactions = transactions.filter(t => t.type === activeTab);

  const getStatusBadge = (status: string) => {
    if (status === 'completed') return <span className="px-2 py-0.5 rounded text-[10px] font-bold text-[#2ed573] border border-[#2ed573]/50 bg-[#2ed573]/10">Success</span>;
    if (status === 'pending') return <span className="px-2 py-0.5 rounded text-[10px] font-bold text-amber-500 border border-amber-500/50 bg-amber-500/10">Pending</span>;
    if (status === 'failed') return <span className="px-2 py-0.5 rounded text-[10px] font-bold text-[#ff4757] border border-[#ff4757]/50 bg-[#ff4757]/10">Failed</span>;
    return null;
  };

  const getStatusColor = (status: string) => {
    if (status === 'completed') return 'text-[#2ed573]';
    if (status === 'pending') return 'text-amber-500';
    if (status === 'failed') return 'text-[#ff4757]';
    return 'text-white';
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0A0A0B] h-screen overflow-y-auto pb-20 relative">
      {/* Header */}
      <div className="flex items-center justify-between p-4 sticky top-0 bg-[#1A1A1D] z-40 border-b border-white/5 shadow-md">
        <ChevronLeft className="w-6 h-6 text-white cursor-pointer" onClick={onBack} />
        <h1 className="text-white font-bold text-lg">Transaction History</h1>
        <HelpCircle className="w-5 h-5 text-gray-400" />
      </div>

      <div className="p-4 space-y-4">
        {/* Balance Card */}
        <div className="bg-[#2B2735] rounded-xl p-5 shadow-lg border border-white/5 relative overflow-hidden flex justify-between items-center">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl"></div>
            <div className="flex flex-col">
              <span className="text-gray-400 text-xs mb-1">Total Balance</span>
              <span className="text-white font-bold text-2xl">Rs.{balance.toFixed(2)}</span>
            </div>
            <RefreshCw 
              className={`w-5 h-5 text-amber-500 cursor-pointer transition-transform ${isRefreshing ? 'animate-spin' : ''}`} 
              onClick={handleRefresh}
            />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-colors border ${activeTab === 'move_in' ? 'bg-[#ff4757]/10 text-[#ff4757] border-[#ff4757]' : 'bg-[#1C1C1F] text-gray-400 border-white/5 hover:bg-white/5'}`}
            onClick={() => setActiveTab('move_in')}
          >
            Move In
          </button>
          <button
            className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-colors border ${activeTab === 'move_out' ? 'bg-[#ff4757]/10 text-[#ff4757] border-[#ff4757]' : 'bg-[#1C1C1F] text-gray-400 border-white/5 hover:bg-white/5'}`}
            onClick={() => setActiveTab('move_out')}
          >
            Move Out
          </button>
        </div>

        {/* Filter Bar */}
        <div className="flex justify-between items-center mb-2 px-1">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <CalendarDays className="w-4 h-4" />
            <span>Last 30 Days</span>
          </div>
          <div className="flex items-center gap-1 text-[#ff4757] text-sm">
            <Filter className="w-4 h-4" />
            <span>Filter</span>
          </div>
        </div>

        {/* Transaction List */}
        <div className="flex flex-col gap-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-500">
               <div className="w-16 h-16 bg-[#1C1C1F] rounded-full flex items-center justify-center mb-3 animate-spin">
                  <RefreshCw className="w-6 h-6 opacity-50" />
               </div>
               <p className="text-sm">Loading transactions...</p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-500">
               <div className="w-16 h-16 bg-[#1C1C1F] rounded-full flex items-center justify-center mb-3">
                  {activeTab === 'move_in' ? <ArrowDownToLine className="w-6 h-6 opacity-50" /> : <ArrowUpFromLine className="w-6 h-6 opacity-50" />}
               </div>
               <p className="text-sm">No {activeTab === 'move_in' ? 'Move In' : 'Move Out'} transactions</p>
            </div>
          ) : (
            filteredTransactions.map(tx => (
              <div key={tx.id} className="bg-[#1C1C1F] p-4 rounded-xl border border-white/5 shadow-sm flex flex-col gap-2 relative overflow-hidden">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-white font-bold text-sm">
                     {tx.type === 'move_in' ? <ArrowDownToLine className="w-4 h-4 text-[#2ed573]" /> : <ArrowUpFromLine className="w-4 h-4 text-[#ff4757]" />}
                     {tx.type === 'move_in' ? 'Move In' : 'Move Out'}
                  </div>
                  {getStatusBadge(tx.status)}
                </div>

                <div className="flex justify-between items-end mt-1">
                  <div className="flex flex-col gap-1">
                    <span className="text-gray-500 text-xs font-mono">{tx.id}</span>
                    <span className="text-gray-500 text-[10px]">{new Date(tx.created_at).toLocaleString()}</span>
                  </div>
                  <span className={`text-lg font-bold ${getStatusColor(tx.status)}`}>
                    {tx.type === 'move_in' ? '+' : '-'}Rs{tx.amount.toFixed(2)}
                  </span>
                </div>
                {tx.status === 'failed' && (tx as any).gateway_ref && (
                  <div className="mt-3 bg-[#2b1313] border border-[#4b1212] rounded-lg p-3 text-sm text-[#ffb3b3]">
                    <div className="font-bold text-xs">Rejected</div>
                    <div className="text-[11px] mt-1">{(tx as any).gateway_ref}</div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
