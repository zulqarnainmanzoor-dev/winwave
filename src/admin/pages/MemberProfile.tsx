import React, { useEffect, useState } from 'react';
import { ChevronLeft, Copy, Check } from 'lucide-react';
import { adminSupabase } from '../../lib/adminSupabase';

interface MemberProfileData {
  // Personal
  id: string;
  uid: string;
  username: string;
  phone: string;
  registration_date: string;
  referrer_uid: string;
  agent_uid: string;
  vip_level: number;
  status: string;

  // Wallet
  main_balance: number;
  game_balance: number;
  locked_balance: number;
  total_commission: number;

  // Deposits
  today_deposit: number;
  total_deposit: number;
  pending_deposits: number;
  failed_deposits: number;

  // Withdrawals
  today_withdrawal: number;
  total_withdrawals: number;
  pending_withdrawals: number;
  rejected_withdrawals: number;

  // Betting
  today_betting: number;
  total_betting: number;
  win_amount: number;
  loss_amount: number;

  // Referral
  direct_invite_count: number;
  team_count: number;
  referral_earnings: number;

  // Activity
  last_login: string;
  last_deposit: string;
  last_withdrawal: string;
  last_bet: string;
}

export function MemberProfile({ userId, onBack }: { userId: string; onBack: () => void }) {
  const [profile, setProfile] = useState<MemberProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const sb = adminSupabase as any;

        // Fetch user basic info
        const { data: user, error: userError } = await sb
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();

        if (userError) throw userError;

        // Fetch deposit stats
        const { data: deposits } = await sb
          .from('deposit_history')
          .select('amount, status, created_at')
          .eq('user_id', userId);

        // Fetch withdrawal stats
        const { data: withdrawals } = await sb
          .from('withdrawal_history')
          .select('amount, status, created_at')
          .eq('user_id', userId);

        // Fetch betting stats
        const { data: bets } = await sb
          .from('betting_history')
          .select('amount, win_amount, created_at')
          .eq('user_id', userId);

        // Fetch referral info
        const { data: referrals } = await sb
          .from('users')
          .select('id')
          .eq('referred_by', userId);

        // Fetch referrer info
        let referrer_uid = '';
        if (user.referred_by) {
          const { data: referrer } = await sb
            .from('users')
            .select('referral_code')
            .eq('id', user.referred_by)
            .single();
          referrer_uid = referrer?.referral_code || '';
        }

        // Fetch agent info
        let agent_uid = '';
        if (user.is_agent) {
          agent_uid = user.referral_code || '';
        }

        // Calculate stats
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayDeposits = (deposits || []).filter(d => {
          const date = new Date(d.created_at);
          date.setHours(0, 0, 0, 0);
          return date.getTime() === today.getTime() && d.status === 'completed';
        });

        const todayWithdrawals = (withdrawals || []).filter(w => {
          const date = new Date(w.created_at);
          date.setHours(0, 0, 0, 0);
          return date.getTime() === today.getTime() && w.status === 'completed';
        });

        const todayBets = (bets || []).filter(b => {
          const date = new Date(b.created_at);
          date.setHours(0, 0, 0, 0);
          return date.getTime() === today.getTime();
        });

        const profileData: MemberProfileData = {
          id: user.id,
          uid: user.referral_code || '',
          username: user.referral_code || '',
          phone: user.phone_number || '',
          registration_date: user.created_at || '',
          referrer_uid,
          agent_uid,
          vip_level: user.vip_level || 0,
          status: user.status || 'active',

          main_balance: Number(user.main_balance || 0),
          game_balance: Number(user.game_balance || 0),
          locked_balance: 0,
          total_commission: Number(user.main_balance || 0),

          today_deposit: todayDeposits.reduce((sum, d) => sum + Number(d.amount || 0), 0),
          total_deposit: Number(user.total_deposit || 0),
          pending_deposits: (deposits || []).filter(d => d.status === 'pending').length,
          failed_deposits: (deposits || []).filter(d => d.status === 'failed').length,

          today_withdrawal: todayWithdrawals.reduce((sum, w) => sum + Number(w.amount || 0), 0),
          total_withdrawals: Number(user.total_withdrawal || 0),
          pending_withdrawals: (withdrawals || []).filter(w => w.status === 'pending').length,
          rejected_withdrawals: (withdrawals || []).filter(w => w.status === 'rejected').length,

          today_betting: todayBets.reduce((sum, b) => sum + Number(b.amount || 0), 0),
          total_betting: Number(user.total_bet_amount || 0),
          win_amount: Number(user.total_win_amount || 0),
          loss_amount: (Number(user.total_bet_amount || 0) - Number(user.total_win_amount || 0)),

          direct_invite_count: (referrals || []).length,
          team_count: (referrals || []).length,
          referral_earnings: Number(user.main_balance || 0),

          last_login: user.updated_at || '',
          last_deposit: (deposits || []).length > 0 ? deposits[0].created_at : '',
          last_withdrawal: (withdrawals || []).length > 0 ? withdrawals[0].created_at : '',
          last_bet: (bets || []).length > 0 ? bets[0].created_at : '',
        };

        setProfile(profileData);
      } catch (err) {
        console.error('Failed to fetch member profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId]);

  const copyUID = () => {
    if (profile?.uid) {
      navigator.clipboard.writeText(profile.uid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-400">Loading profile...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-400">Profile not found</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-[#0a0a0b]">
      <div className="p-4 md:p-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onBack} className="p-2 hover:bg-[#1a1a2e] rounded-lg">
            <ChevronLeft className="w-6 h-6 text-gray-400" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white">Member Profile</h1>
            <p className="text-gray-400">Complete account summary</p>
          </div>
        </div>

        {/* UID Header Card */}
        <div className="bg-gradient-to-r from-[#e94560] to-[#ff6b6b] rounded-xl p-6 mb-8">
          <p className="text-white/80 text-sm mb-2">Production UID</p>
          <div className="flex items-center gap-3">
            <p className="text-white font-black text-4xl font-mono">{profile.uid || 'N/A'}</p>
            <button
              onClick={copyUID}
              className="p-2 hover:bg-white/20 rounded-lg transition-all"
            >
              {copied ? (
                <Check className="w-5 h-5 text-white" />
              ) : (
                <Copy className="w-5 h-5 text-white" />
              )}
            </button>
          </div>
        </div>

        {/* Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Personal Information */}
          <div className="bg-[#1a1a2e] border border-[#0f3460] rounded-xl p-6">
            <h3 className="text-white font-bold mb-4">Personal Information</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-400">Phone</p>
                <p className="text-white font-mono">{profile.phone || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-400">Registration Date</p>
                <p className="text-white">{new Date(profile.registration_date).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-gray-400">VIP Level</p>
                <p className="text-white font-bold">{profile.vip_level}</p>
              </div>
              <div>
                <p className="text-gray-400">Status</p>
                <p className={`font-bold ${profile.status === 'active' ? 'text-green-400' : 'text-red-400'}`}>
                  {profile.status.toUpperCase()}
                </p>
              </div>
              {profile.referrer_uid && (
                <div>
                  <p className="text-gray-400">Referred By</p>
                  <p className="text-white font-mono">{profile.referrer_uid}</p>
                </div>
              )}
            </div>
          </div>

          {/* Wallet */}
          <div className="bg-[#1a1a2e] border border-[#0f3460] rounded-xl p-6">
            <h3 className="text-white font-bold mb-4">Wallet</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-400">Main Balance</p>
                <p className="text-white font-bold">Rs {profile.main_balance.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-400">Game Balance</p>
                <p className="text-white font-bold">Rs {profile.game_balance.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-400">Locked Balance</p>
                <p className="text-white font-bold">Rs {profile.locked_balance.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-400">Total Commission</p>
                <p className="text-orange-400 font-bold">Rs {profile.total_commission.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Deposits */}
          <div className="bg-[#1a1a2e] border border-[#0f3460] rounded-xl p-6">
            <h3 className="text-white font-bold mb-4">Deposits</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-400">Today's Deposit</p>
                <p className="text-green-400 font-bold">Rs {profile.today_deposit.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-400">Total Deposit</p>
                <p className="text-white font-bold">Rs {profile.total_deposit.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-400">Pending</p>
                <p className="text-amber-400">{profile.pending_deposits}</p>
              </div>
              <div>
                <p className="text-gray-400">Failed</p>
                <p className="text-red-400">{profile.failed_deposits}</p>
              </div>
              {profile.last_deposit && (
                <div>
                  <p className="text-gray-400">Last Deposit</p>
                  <p className="text-white text-xs">{new Date(profile.last_deposit).toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>

          {/* Withdrawals */}
          <div className="bg-[#1a1a2e] border border-[#0f3460] rounded-xl p-6">
            <h3 className="text-white font-bold mb-4">Withdrawals</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-400">Today's Withdrawal</p>
                <p className="text-red-400 font-bold">Rs {profile.today_withdrawal.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-400">Total Withdrawals</p>
                <p className="text-white font-bold">Rs {profile.total_withdrawals.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-400">Pending</p>
                <p className="text-amber-400">{profile.pending_withdrawals}</p>
              </div>
              <div>
                <p className="text-gray-400">Rejected</p>
                <p className="text-red-400">{profile.rejected_withdrawals}</p>
              </div>
              {profile.last_withdrawal && (
                <div>
                  <p className="text-gray-400">Last Withdrawal</p>
                  <p className="text-white text-xs">{new Date(profile.last_withdrawal).toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>

          {/* Betting */}
          <div className="bg-[#1a1a2e] border border-[#0f3460] rounded-xl p-6">
            <h3 className="text-white font-bold mb-4">Betting</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-400">Today's Betting</p>
                <p className="text-white font-bold">Rs {profile.today_betting.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-400">Total Betting</p>
                <p className="text-white font-bold">Rs {profile.total_betting.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-400">Win Amount</p>
                <p className="text-green-400 font-bold">Rs {profile.win_amount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-400">Loss Amount</p>
                <p className="text-red-400 font-bold">Rs {profile.loss_amount.toLocaleString()}</p>
              </div>
              {profile.last_bet && (
                <div>
                  <p className="text-gray-400">Last Bet</p>
                  <p className="text-white text-xs">{new Date(profile.last_bet).toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>

          {/* Referral */}
          <div className="bg-[#1a1a2e] border border-[#0f3460] rounded-xl p-6">
            <h3 className="text-white font-bold mb-4">Referral</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-400">Direct Invites</p>
                <p className="text-white font-bold">{profile.direct_invite_count}</p>
              </div>
              <div>
                <p className="text-gray-400">Team Size</p>
                <p className="text-white font-bold">{profile.team_count}</p>
              </div>
              <div>
                <p className="text-gray-400">Referral Earnings</p>
                <p className="text-orange-400 font-bold">Rs {profile.referral_earnings.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
