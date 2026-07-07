// ════════════════════════════════════════════════════════════════════════════════
// AGENT DASHBOARD - FETCH REAL MEMBER DATA
// Example implementation for fetching and displaying agent member transactions
// ════════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useUser } from '../context/UserContext';

interface MemberDeposit {
  member_id: string;
  member_uid: string;
  member_phone: string;
  total_deposits: number;
  today_deposits: number;
  deposit_count: number;
  first_deposit_date: string;
  last_deposit_date: string;
  status: string;
}

interface TeamSummary {
  total_members: number;
  active_members: number;
  total_team_deposits: number;
  today_team_deposits: number;
  average_deposit: number;
  members_with_deposits: number;
}

interface DashboardData {
  total_members: number;
  active_members: number;
  total_team_deposits: number;
  today_team_deposits: number;
  total_team_withdrawals: number;
  today_team_withdrawals: number;
  total_team_bets: number;
  members_with_deposits: number;
  average_deposit: number;
  total_commission: number;
  today_commission: number;
  pending_commission: number;
}

export function AgentDashboardExample() {
  const { uid } = useUser();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [membersList, setMembersList] = useState<MemberDeposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all dashboard data in one call
  const fetchDashboardData = async () => {
    if (!uid) return;

    try {
      setLoading(true);
      setError(null);

      // Call the RPC function to get all dashboard data
      const { data, error: rpcError } = await supabase.rpc(
        'get_agent_dashboard_data',
        { p_agent_id: uid }
      );

      if (rpcError) {
        console.error('[AgentDashboard] RPC Error:', rpcError);
        setError(`Failed to fetch dashboard data: ${rpcError.message}`);
        return;
      }

      if (data && data.length > 0) {
        console.log('[AgentDashboard] Dashboard data:', data[0]);
        setDashboardData(data[0]);
      }
    } catch (err: any) {
      console.error('[AgentDashboard] Exception:', err);
      setError(err.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch members with their deposits
  const fetchMembersDeposits = async () => {
    if (!uid) return;

    try {
      const { data, error: rpcError } = await supabase.rpc(
        'get_agent_members_deposits',
        { p_agent_id: uid }
      );

      if (rpcError) {
        console.error('[AgentDashboard] Members RPC Error:', rpcError);
        return;
      }

      if (data) {
        console.log('[AgentDashboard] Members data:', data);
        setMembersList(data);
      }
    } catch (err: any) {
      console.error('[AgentDashboard] Members Exception:', err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchMembersDeposits();

    // Set up real-time subscription for deposit changes
    const channel = supabase
      .channel(`agent-dashboard-${uid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deposit_history',
        },
        () => {
          console.log('[AgentDashboard] Deposit changed, refreshing...');
          fetchDashboardData();
          fetchMembersDeposits();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
        },
        () => {
          console.log('[AgentDashboard] Commission changed, refreshing...');
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [uid]);

  if (loading) {
    return <div className="p-4 text-center">Loading dashboard data...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }

  if (!dashboardData) {
    return <div className="p-4 text-center">No data available</div>;
  }

  return (
    <div className="p-4 space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">Total Members</div>
          <div className="text-2xl font-bold text-blue-600">
            {dashboardData.total_members}
          </div>
        </div>

        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">Active Members</div>
          <div className="text-2xl font-bold text-green-600">
            {dashboardData.active_members}
          </div>
        </div>

        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">Members with Deposits</div>
          <div className="text-2xl font-bold text-purple-600">
            {dashboardData.members_with_deposits}
          </div>
        </div>

        <div className="bg-orange-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">Total Team Deposits</div>
          <div className="text-2xl font-bold text-orange-600">
            Rs {dashboardData.total_team_deposits.toLocaleString('en-PK', { maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="bg-red-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">Today's Deposits</div>
          <div className="text-2xl font-bold text-red-600">
            Rs {dashboardData.today_team_deposits.toLocaleString('en-PK', { maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="bg-indigo-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">Average Deposit</div>
          <div className="text-2xl font-bold text-indigo-600">
            Rs {dashboardData.average_deposit.toLocaleString('en-PK', { maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">Total Commission</div>
          <div className="text-2xl font-bold text-yellow-600">
            Rs {dashboardData.total_commission.toLocaleString('en-PK', { maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="bg-cyan-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">Today's Commission</div>
          <div className="text-2xl font-bold text-cyan-600">
            Rs {dashboardData.today_commission.toLocaleString('en-PK', { maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="bg-pink-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">Pending Commission</div>
          <div className="text-2xl font-bold text-pink-600">
            Rs {dashboardData.pending_commission.toLocaleString('en-PK', { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      {/* Members List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="text-lg font-bold">Your Members ({membersList.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-semibold">UID</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">Phone</th>
                <th className="px-4 py-2 text-right text-sm font-semibold">Total Deposits</th>
                <th className="px-4 py-2 text-right text-sm font-semibold">Today</th>
                <th className="px-4 py-2 text-center text-sm font-semibold">Count</th>
                <th className="px-4 py-2 text-center text-sm font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {membersList.map((member) => (
                <tr key={member.member_id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm font-mono">{member.member_uid}</td>
                  <td className="px-4 py-2 text-sm">{member.member_phone || 'N/A'}</td>
                  <td className="px-4 py-2 text-right text-sm font-semibold">
                    Rs {member.total_deposits.toLocaleString('en-PK', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-2 text-right text-sm">
                    Rs {member.today_deposits.toLocaleString('en-PK', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-2 text-center text-sm">{member.deposit_count}</td>
                  <td className="px-4 py-2 text-center">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        member.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : member.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {member.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// USAGE IN YOUR COMPONENT:
// 
// import { AgentDashboardExample } from './AgentDashboardExample';
// 
// export function YourAgentDashboard() {
//   return <AgentDashboardExample />;
// }
// ════════════════════════════════════════════════════════════════════════════════
