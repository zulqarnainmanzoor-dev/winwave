// Commission rates by VIP level and referral depth
// Format: vip_level -> [level1_rate, level2_rate, level3_rate, level4_rate, level5_rate, level6_rate]

export const COMMISSION_RATES = {
  L0: [0.003, 0.0009, 0.000027, 0.0000081, 0.00000243, 0.000000729],      // 0.3%, 0.09%, 0.027%, etc.
  L1: [0.0035, 0.001225, 0.00042875, 0.00015006, 0.00005252, 0.00001838],  // 0.35%, 0.1225%, etc.
  L2: [0.00375, 0.00140625, 0.00052734, 0.00019775, 0.00007416, 0.00002781], // 0.375%, 0.140625%, etc.
  L3: [0.004, 0.0016, 0.00064, 0.000256, 0.00010240, 0.00004096],          // 0.4%, 0.16%, etc.
  L4: [0.00425, 0.00180625, 0.00076766, 0.00032625, 0.00013866, 0.00005893], // 0.425%, 0.180625%, etc.
  L5: [0.0045, 0.002025, 0.00091125, 0.00041006, 0.00018453, 0.00008304],  // 0.45%, 0.2025%, etc.
  L6: [0.005, 0.0025, 0.00125, 0.000625, 0.0003125, 0.00015625],           // 0.5%, 0.25%, etc.
};

// Map VIP level to commission tier
export function getCommissionTier(vipLevel: number): string {
  if (vipLevel >= 6) return 'L6';
  if (vipLevel >= 5) return 'L5';
  if (vipLevel >= 4) return 'L4';
  if (vipLevel >= 3) return 'L3';
  if (vipLevel >= 2) return 'L2';
  if (vipLevel >= 1) return 'L1';
  return 'L0';
}

// Get commission rate for a specific referral level
export function getCommissionRate(vipLevel: number, referralDepth: number): number {
  const tier = getCommissionTier(vipLevel);
  const rates = COMMISSION_RATES[tier as keyof typeof COMMISSION_RATES];
  
  // referralDepth is 1-based (1 = direct referral, 2 = 2 levels down, etc.)
  // Array is 0-based, so subtract 1
  const index = Math.min(referralDepth - 1, rates.length - 1);
  return rates[index];
}

// Calculate commission for a bet
export function calculateCommission(
  betAmount: number,
  agentVipLevel: number,
  referralDepth: number
): number {
  const rate = getCommissionRate(agentVipLevel, referralDepth);
  return Math.round(betAmount * rate * 100) / 100; // Round to 2 decimals
}

// Example usage:
// User deposits 300
// Agent is L0 (VIP level 0)
// Agent is direct referrer (depth 1)
// Commission = 300 * 0.003 = 0.9
// NOT 300!
