# DATABASE USAGE MATRIX - QUICK REFERENCE

**Purpose:** Cross-reference showing which tables/RPCs are used in which code files  
**Generated:** July 5, 2026

---

## TABLES → FILES MAPPING

### **users** table
| File | Operation | Lines | Details |
|------|-----------|-------|---------|
| backend/api/api.ts | SELECT | 64 | Fetch phone_number, referral_code on login |
| backend/api/api.ts | SELECT | 117-128 | Fetch user data cleanup |
| backend/api/wallet.ts | SELECT | 62 | Get balance + wagering for transfer |
| backend/api/wallet.ts | SELECT | 107, 123, 144 | Verify user exists |
| backend/api/wallet.ts | UPDATE | - | Store wallet_details (JSON) |
| backend/api/withdraw.ts | SELECT | 17, 42 | Verify PIN, check balance |
| backend/api/withdraw.ts | UPDATE | 59 | Deduct main_balance |
| backend/api/register.ts | SELECT | 31 | Phone uniqueness check |
| backend/api/register.ts | SELECT | 70 | Lookup referrer by referral_code |
| backend/api/register.ts | SELECT | 135 | Find referrer for registration |
| backend/api/referral-stats.ts | SELECT | 29+ | Fetch invitees, subordinates, stats |
| backend/api/security.ts | INSERT | 50 | Log security events |
| backend/api/security.ts | SELECT | 69 | Query registration attempts |
| backend/api/security.ts | INSERT | 83 | Log registration attempt |
| backend/api/wingo.ts | SELECT | 160 | Admin role check |
| backend/game-engine/wingoEngine.ts | SELECT | - | Fetch user data for balance updates |
| src/lib/database.ts | SELECT | 10-15 | Fetch user profile |
| src/lib/database.ts | UPDATE | 20-25 | Update user profile |
| src/context/UserContext.tsx | SELECT | 377+ | Fetch user on login/session |
| src/components/AuthViewReact.tsx | UPSERT | 106 | Create/update user on auth |
| src/components/PromotionView.tsx | SELECT | 210+ | Fetch recent invitees |
| Multiple UI components | SELECT | - | Display user info |

---

### **wallets** table ❌ MISSING
| File | Operation | Lines | Details |
|------|-----------|-------|---------|
| backend/api/api.ts | SELECT | 65 | Fetch main_balance, wagering_required on login |
| backend/api/wallet.ts | SELECT | 29 | Fetch wallet info for transfer |
| backend/api/wallet.ts | SELECT | 81 | Fetch balances |
| backend/api/wallet.ts | UPSERT | - | Update wallet balance |
| src/lib/database.ts | SELECT | 32-37 | fetchWallet() function |
| src/lib/database.ts | UPDATE | 42-47 | updateWalletBalance() function |

---

### **deposit_history** table
| File | Operation | Lines | Details |
|------|-----------|-------|---------|
| backend/api/deposit-webhook.ts | SELECT | 90 | Check if deposit already processed |
| backend/api/deposit-webhook.ts | INSERT | 104, 125 | Create deposit record |
| backend/api/deposit-webhook.ts | UPDATE | 155, 166 | Mark as completed/failed |
| backend/api/referral-stats.ts | SELECT | 64 | Fetch deposit stats |
| src/app/deposit-success/page.tsx | SELECT | 63 | Fetch deposit confirmation |

---

### **withdrawal_history** table
| File | Operation | Lines | Details |
|------|-----------|-------|---------|
| backend/api/payout.ts | SELECT | 42 | Fetch withdrawal for processing |
| backend/api/payout.ts | UPDATE | 128+ | Update status on gateway response |
| admin pages | SELECT | 73+ | Fetch pending withdrawals |
| admin/pages/FundsManagement.tsx | UPDATE | 223, 266, 271 | Update withdrawal status |
| src/components/WithdrawHistoryView.tsx | SELECT | 78 | Display withdrawal history |

---

### **withdraw_requests** table
| File | Operation | Lines | Details |
|------|-----------|-------|---------|
| backend/api/withdraw.ts | INSERT | 53 | Create withdrawal request |
| admin/pages/DashboardOverview.tsx | SELECT | 41 | Count pending withdrawals |
| src/lib/database.ts | SELECT/INSERT | 97-115 | Fetch/create functions |

---

### **transactions** table
| File | Operation | Lines | Details |
|------|-----------|-------|---------|
| backend/api/deposit-webhook.ts | INSERT | 195 | Record deposit transaction |
| backend/api/payout.ts | INSERT | 279 | Record withdrawal transaction |
| admin/components/Sidebar.tsx | SELECT | 27 | Count pending deposits |
| admin/pages/FundsManagement.tsx | SELECT | 81 | Fetch transaction history |
| src/components/DepositView.tsx | SELECT | 131 | Fetch transactions |
| src/components/TransactionView.tsx | SELECT | 27 | Display transaction history |
| src/lib/database.ts | SELECT/INSERT | 54-72 | Fetch/insert functions |

---

### **betting_history** table
| File | Operation | Lines | Details |
|------|-----------|-------|---------|
| backend/game-engine/wingoEngine.ts | SELECT | 172, 205 | Fetch bets for round |
| backend/game-engine/wingoEngine.ts | INSERT | 461 | Record bet placement |
| backend/api/referral-stats.ts | SELECT | 81 | Fetch bet stats |
| src/components/BetHistoryView.tsx | SELECT | 37 | Display bet history |
| src/components/WinGoView.tsx | SELECT | 327, 361 | Fetch user bets/history |

---

### **game_rounds** table
| File | Operation | Lines | Details |
|------|-----------|-------|---------|
| backend/game-engine/wingoEngine.ts | SELECT | 182, 249, 259, 284 | Fetch active/completed rounds |
| backend/game-engine/wingoEngine.ts | INSERT/UPDATE | - | Create and update rounds |
| admin/components/GameController.tsx | SELECT | 82 | Fetch game rounds |
| admin/components/GameController.tsx | UPDATE | 168, 173, 218 | Manual game control |
| admin/pages/GamePage.tsx | SELECT | 54 | Display game history |
| admin/pages/HistoryPage.tsx | SELECT | 78 | Fetch game rounds history |
| src/hooks/useWinGoSync.ts | SELECT | 137, 222 | Sync game state with client |

---

### **referral_commissions** table ❌ MISSING
| File | Operation | Lines | Details |
|------|-----------|-------|---------|
| src/components/PromotionView.tsx | SELECT | 91, 104 | Fetch weekly/total commissions |
| src/context/UserContext.tsx | SELECT | 655 | Fetch total commissions |
| REFERRAL_SYSTEM_FIX_SUMMARY.md | DOC | 67 | References this table |

---

### **user_banks** table ❌ MISSING
| File | Operation | Lines | Details |
|------|-----------|-------|---------|
| src/lib/database.ts | SELECT | 76 | fetchUserBanks() |
| src/lib/database.ts | UPSERT | 84 | upsertUserBank() |

---

### **gift_codes** table
| File | Operation | Lines | Details |
|------|-----------|-------|---------|
| admin/pages/GiftCodes.tsx | SELECT | 30, 67, 83, 98 | Fetch gift codes |
| src/components/PromotionView.tsx | SELECT | 342, 355, 362 | Validate and display gift codes |

---

### **gift_code_claims** table
| File | Operation | Lines | Details |
|------|-----------|-------|---------|
| src/components/ActivityView.tsx | SELECT | 135 | Check duplicate claims |
| src/components/ActivityView.tsx | INSERT | 160 | Record claim |
| src/components/PromotionView.tsx | SELECT | 330, 368 | Fetch user claims |

---

### **attendance_bonus** table
| File | Operation | Lines | Details |
|------|-----------|-------|---------|
| src/components/ActivityView.tsx | SELECT | 42 | Fetch daily bonus status |
| src/components/ActivityView.tsx | INSERT | 101 | Claim daily bonus |

---

### **platform_settings** table
| File | Operation | Lines | Details |
|------|-----------|-------|---------|
| admin/pages/Settings.tsx | SELECT | 108 | Fetch platform config |
| admin/pages/Settings.tsx | UPSERT | 141 | Update settings |
| src/hooks/usePlatformName.ts | SELECT | 12 | Fetch platform name |

---

### **security_events** table
| File | Operation | Lines | Details |
|------|-----------|-------|---------|
| backend/api/security.ts | INSERT | 50 | Log security events |

---

### **registration_attempts** table
| File | Operation | Lines | Details |
|------|-----------|-------|---------|
| backend/api/security.ts | INSERT | 69, 83 | Log registration attempts |

---

### **game-specific tables**
| Table | Files | Operations | Details |
|-------|-------|-----------|---------|
| **bet_history** | admin, api | SELECT | Alternative to betting_history |
| **bets** | api.ts | DELETE | Cleanup historical bets |
| **deposits** | agent system | SELECT | Agent commission tracking |
| **agent_salary_log** | admin | SELECT/INSERT | Salary tracking |
| **tasks** | admin | SELECT | Agent task management |
| **risk_logs** | api | INSERT | Risk management logs |
| **transaction_history** | vip system | SELECT/INSERT | VIP transaction tracking |

---

## RPC → FILES MAPPING

### **credit_user_balance** ✅
| File | Operation | Details |
|------|-----------|---------|
| backend/game-engine/wingoEngine.ts | Line 218 | Credit balance after bet resolution |

**Expected Parameters:**
```typescript
{
  p_user_id: UUID,
  p_amount: number,
  p_bet_amount?: number,
  p_win_amount?: number,
  p_wagering_completed?: number
}
```

---

### **complete_withdrawal** ✅
| File | Operation | Details |
|------|-----------|---------|
| backend/api/webhook.ts | Line 117 | Mark withdrawal as completed (webhook) |

**Expected Parameters:**
```typescript
{ p_withdrawal_id: UUID }
```

---

### **fail_withdrawal** ✅
| File | Operation | Details |
|------|-----------|---------|
| backend/api/webhook.ts | Line 133 | Mark withdrawal as failed |

---

### **get_active_round** ✅
| File | Operation | Details |
|------|-----------|---------|
| src/admin/components/GameController.tsx | Line 76 | Fetch current active game round |

**Expected Parameters:**
```typescript
{
  p_game_type: 'wingo' | 'k3' | 'trx' | '5d',
  p_mode: '30s' | '1m' | '3m' | '5m'
}
```

---

### **fn_tick_game_rounds** ✅
| File | Operation | Details |
|------|-----------|---------|
| src/admin/components/GameController.tsx | Line 154 | Manually advance game rounds |

---

### **analyze_agent_network_fraud** ✅
| File | Operation | Details |
|------|-----------|---------|
| src/admin/pages/AgentManagement.tsx | Line 251 | Analyze fraud in agent network |

**Expected Parameters:**
```typescript
{ p_agent_id: UUID }
```

---

### **approve_withdrawal** ✅
| File | Operation | Details |
|------|-----------|---------|
| src/admin/pages/FundsManagement.tsx | Line 211 | Approve withdrawal (sets to processing) |

**Expected Parameters:**
```typescript
{ p_withdrawal_id: UUID }
```

**Returns:**
```typescript
{ success: boolean, error?: string }
```

---

### **validate_referral_code** ✅
| File | Operation | Details |
|------|-----------|---------|
| src/components/AuthViewReact.tsx | Line 215 | Validate referral code on registration |

**Expected Parameters:**
```typescript
{ p_code: string }
```

---

### **process_team_commission** ✅
| File | Operation | Details |
|------|-----------|---------|
| src/context/UserContext.tsx | Lines 590, 614, 692 | Process referral commissions |
| backend/supabase/promotion_tree_repair.sql | Implementation | Found in SQL |

**Expected Parameters:**
```typescript
{
  p_subordinate_id: UUID,
  p_processing_amount: number
}
```

---

## QUICK LOOKUP BY FILE TYPE

### Backend API Files (backend/api/)
- ✅ api.ts
- ✅ deposit-webhook.ts
- ✅ members.ts
- ✅ payout.ts
- ✅ referral-stats.ts
- ✅ register.ts
- ✅ security.ts
- ✅ wallet.ts
- ✅ webhook.ts
- ✅ wingo.ts
- ✅ withdraw.ts

### Game Engine (backend/game-engine/)
- ✅ wingoEngine.ts (core game logic)
- ✅ resultStore.ts (result persistence)

### Frontend Components (src/components/)
- ✅ ActivityView.tsx (bonuses, gift codes)
- ✅ AdminDashboard.tsx
- ✅ AuthViewReact.tsx (registration)
- ✅ BetHistoryView.tsx
- ✅ DepositView.tsx
- ✅ DepositHistoryView.tsx
- ✅ GameHistoryView.tsx
- ✅ InviteesOverviewView.tsx
- ✅ PromotionView.tsx (referrals, commissions)
- ✅ TransactionView.tsx
- ✅ VIPView.tsx
- ✅ WalletView.tsx
- ✅ WinGoView.tsx (game UI)
- ✅ WithdrawHistoryView.tsx
- ✅ WithdrawView.tsx
- ✅ WinGoResultPopup.tsx

### Admin Pages (src/admin/pages/)
- ✅ AgentManagement.tsx
- ✅ DashboardOverview.tsx
- ✅ FundsManagement.tsx (deposits/withdrawals)
- ✅ GamePage.tsx
- ✅ GiftCodes.tsx
- ✅ HistoryPage.tsx
- ✅ MemberManagement.tsx
- ✅ Settings.tsx

### Context/Hooks (src/)
- ✅ context/UserContext.tsx (user session)
- ✅ lib/database.ts (DB abstraction)
- ✅ hooks/usePlatformName.ts
- ✅ hooks/useWinGoSync.ts

---

## CRITICAL PATHS FOR TESTING

### Deposit Flow
1. User submits deposit → backend/api/deposit-webhook.ts
2. Webhook updates deposit_history
3. Trigger updates users.main_balance
4. Commission created in referral_commissions ← **MISSING TABLE**
5. UI shows confirmation (deposit-success/page.tsx)

### Withdrawal Flow
1. Admin approves → approve_withdrawal() RPC
2. backend/api/payout.ts sends to gateway
3. Webhook marks withdrawal_history as completed
4. Uses user_banks table ← **MISSING TABLE**

### Referral System
1. New user registers with invite code
2. referred_by set in users table
3. On referrer's deposit → commission added to referral_commissions ← **MISSING TABLE**
4. PromotionView.tsx fetches from referral_commissions
5. User claims commission → transfers to main_balance

### Game/Betting
1. backend/game-engine/wingoEngine.ts creates game_rounds
2. Player places bet → inserted into betting_history
3. Round completes → update betting_history status
4. credit_user_balance() RPC called
5. User wallet/balance updated

---

## KNOWN ISSUES

1. **wallets vs users** - Duplicate balance fields
   - wallets.main_balance / users.main_balance
   - Code uses both, schema only has users version
   
2. **withdrawal_history.account_no vs account_number**
   - Schema: account_no
   - Code: account_number (payout.ts)
   - **FIX REQUIRED**

3. **gift_codes.claimed_by** - Not fully implemented
   - Schema has field but not consistently updated

---

## STATISTICS

- **Total tables referenced:** 22
- **Tables in schema:** 19
- **Missing critical tables:** 3
- **RPCs identified:** 9
- **API endpoints:** 11
- **UI components:** 14
- **Admin pages:** 8
- **Files analyzed:** 50+

