type ReferralInvitee = {
  id: string;
  phone_number: string | null;
  referral_code: string | null;
  invite_code: string | null;
  created_at: string;
  referred_by: string | null;
  total_bets?: number | null;
  account_status?: string | null;
};

type ReferralSubordinate = {
  id: string;
  uid: string;
  level: number;
  deposit_amount: number;
  commission: number;
  created_at: string;
  phone_number?: string | null;
  referral_code?: string | null;
  invite_code?: string | null;
  total_deposit?: number | null;
  total_bets?: number | null;
  referred_by?: string | null;
};

type ReferralStatsPayload = {
  total_users: number;
  total_deposits: number;
  total_bets: number;
  deposit_users: number;
  bettor_users: number;
};

type ReferralStatsResponse = {
  success: boolean;
  stats?: ReferralStatsPayload;
};

type ReferralSubordinatesResponse = {
  success: boolean;
  subordinates?: ReferralSubordinate[];
  total?: number;
};

type ReferralInviteesResponse = {
  success: boolean;
  invitees?: ReferralInvitee[];
  total?: number;
};

const readJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(path, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    let message = `Request failed with ${response.status}`;
    try {
      const payload = await response.json() as { error?: string };
      if (payload?.error) message = payload.error;
    } catch {
      // Ignore JSON parse errors and fall back to the default message.
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
};

const buildUrl = (path: string, params: Record<string, string | number | undefined>) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  });
  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
};

export const fetchReferralStats = async (userId: string, options: { level?: number | string; dateRange?: string } = {}) => {
  const path = buildUrl(`/api/referral/stats/${encodeURIComponent(userId)}`, {
    level: options.level,
    dateRange: options.dateRange,
  });
  return readJson<ReferralStatsResponse>(path);
};

export const fetchReferralSubordinates = async (
  userId: string,
  options: { level?: number | string; search?: string; limit?: number; offset?: number } = {}
) => {
  const path = buildUrl(`/api/referral/subordinates/${encodeURIComponent(userId)}`, {
    level: options.level,
    search: options.search,
    limit: options.limit,
    offset: options.offset,
  });
  return readJson<ReferralSubordinatesResponse>(path);
};

export const fetchReferralInvitees = async (
  userId: string,
  options: { from?: string; to?: string; search?: string; limit?: number; offset?: number } = {}
) => {
  const path = buildUrl(`/api/referral/invitees/${encodeURIComponent(userId)}`, {
    from: options.from,
    to: options.to,
    search: options.search,
    limit: options.limit,
    offset: options.offset,
  });
  return readJson<ReferralInviteesResponse>(path);
};

export type { ReferralInvitee, ReferralSubordinate, ReferralStatsPayload, ReferralStatsResponse, ReferralSubordinatesResponse, ReferralInviteesResponse };
