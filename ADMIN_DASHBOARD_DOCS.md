# Admin Dashboard - Technical Documentation

## 📋 Architecture Overview

The WinWave Admin Dashboard is a comprehensive management system for monitoring and controlling all platform operations. It features:

- **Centralized State Management** using React Context (AdminContext)
- **Smart Game Controller** with Risk Management AI
- **Member Management** with deep-link profiles and fund adjustment
- **History & Logs** tracking for all transactions
- **Funds Management** for deposit/withdrawal approvals
- **Agent Management** for referral tracking and promotion
- **Settings** for platform-wide configuration

---

## 🗂️ File Structure

```
src/admin/
├── AdminDashboard.tsx          # Main entry point (routes all pages)
├── context/
│   └── AdminContext.tsx        # Global admin state management
├── components/
│   ├── Sidebar.tsx             # Navigation sidebar with menus
│   └── GameController.tsx      # Smart game mode controller UI
└── pages/
    ├── DashboardOverview.tsx   # Statistics & analytics dashboard
    ├── GamePage.tsx            # Game controller page (reused for all games)
    ├── MemberManagement.tsx    # User search & deep-link profiles
    ├── HistoryPage.tsx         # Logs: game, recharge, bet, withdraw
    ├── FundsManagement.tsx     # Deposit/withdrawal request approval
    ├── AgentManagement.tsx     # Agent promotion & commission tracking
    └── Settings.tsx            # Platform configuration
```

---

## 🔄 State Management (AdminContext)

### Types

```typescript
type AdminPage = 
  | "overview" | "wingo" | "k3" | "trx" | "5d"
  | "game-history" | "recharge-history" | "bet-history" | "withdraw-history"
  | "members" | "withdraw-requests" | "deposit-requests"
  | "agents" | "settings"

interface GameModeSettings {
  enabled: boolean
  smartRiskEnabled: boolean
  bigBetLimit: number
  smallBetLimit: number
  autoSmallWinThreshold: number
  payoutMultiplier: number
  lastUpdated: string
}

interface GameControlSettings {
  gameType: "wingo" | "k3" | "trx" | "5d"
  modes: {
    "30s": GameModeSettings
    "1m": GameModeSettings
    "3m": GameModeSettings
    "5m": GameModeSettings
  }
}
```

### Core Functions

```typescript
useAdmin() // Hook to access admin context

// Navigation
setCurrentPage(page: AdminPage) // Switch between dashboard pages

// Game Management
updateGameSettings(gameType, settings) // Update entire game settings
updateGameMode(gameType, mode, updates) // Update specific mode
enableSmartRisk(gameType, mode, enabled) // Toggle smart risk AI

// Getters
getSmartRiskStatus(gameType, mode) // Check if smart risk enabled
```

---

## 🎮 Smart Risk Management AI

### How It Works

The Smart Risk Management system automatically balances payouts when bet distribution becomes skewed:

**Scenario:**
- Total bets on Big: Rs 150,000
- Total bets on Small: Rs 3,000
- Threshold: Rs 100,000

**Action:**
- System detects Big >> Small
- Triggers automatic Small win
- Equalizes platform margin
- Protects against anomalies

### Configuration Per Game Mode

```javascript
// Example: WinGo 30-Second Mode
{
  "30s": {
    smartRiskEnabled: true,
    bigBetLimit: 100000,        // Max Big bets allowed
    smallBetLimit: 5000,        // Min Small bets before trigger
    autoSmallWinThreshold: 100000, // When Big exceeds this
    payoutMultiplier: 1.95      // Win amount = bet × multiplier
  }
}
```

---

## 📊 Dashboard Pages

### 1. Overview Page
**Purpose**: Real-time platform statistics

**Displays:**
- Total Recharge Today
- Total Active Users
- Total Users
- Total Withdrawals
- Total Balance
- 7-day revenue trend
- User activity breakdown
- Recent transaction logs

**Data Sources:**
- AdminContext stats (mocked)
- Supabase database queries (to be implemented)

### 2. Game Controller Pages (WinGo, K3, TRX, 5D)
**Purpose**: Manage individual game modes and smart risk settings

**Features:**
- Mode selector (30s, 1m, 3m, 5m)
- Smart Risk Management toggle
- Bet limit configuration
- Payout multiplier adjustment
- Game-specific statistics
- Result history table
- Quick actions (view logs, export, manage players)

**Key Logic:**
```typescript
// When Smart Risk enabled + Big bets exceed threshold:
if (totalBigBets > autoSmallWinThreshold && totalSmallBets < smallBetLimit) {
  // Auto-trigger Small win
  // Update result to "Small"
  // Calculate and distribute payouts
  // Log as "Smart Risk Triggered"
}
```

### 3. Member Management Page
**Purpose**: User search, profile deep-linking, and fund management

**Search Types:**
- By UID: Exact match or partial
- By Phone: Number match
- By Email: Email search

**Member Profile Shows:**
- Basic info (username, phone, email, joined date)
- Financial summary (deposits, withdrawals, balance, win/loss)
- Security info (IP addresses, device IDs)
- Actions:
  - Adjust balance (add/deduct funds)
  - View full profile
  - Suspend account

**Fund Adjustment Modal:**
```typescript
// Admin can manually adjust user balance
// Reason: Bonus, compensation, correction, etc.
// Changes recorded in audit log
```

### 4. History Pages (Game, Recharge, Bet, Withdraw)
**Purpose**: Track all platform transactions and activities

**Features:**
- Date range filtering
- Status filtering (success, pending, failed)
- Export to CSV
- Pagination
- Sortable columns

**Data Tracked:**
| Page | Tracked Data |
|------|--------------|
| Game History | Game ID, Mode, Players, Result, Total Pot |
| Recharge History | User, Amount, Method, Status, Reference |
| Bet History | User, Game, Amount, Bet Type, Result, Payout |
| Withdraw History | User, Amount, Method, Status, Account |

### 5. Funds Management (Deposits & Withdrawals)
**Purpose**: Approve/reject deposit and withdrawal requests

**Deposit Requests:**
- Show pending deposits
- Quick approve/reject
- Manual verification option
- Reason field for rejection

**Withdrawal Requests:**
- Verify account details
- Check daily/monthly limits
- Approve with timestamp
- Reject with reason

**Status Tracking:**
- Pending → (Approve/Reject) → Completed/Rejected
- Timestamp logged for audit

### 6. Agent Management
**Purpose**: Promote top players to agents, track commissions

**Features:**
- Promote user to agent (button opens modal)
- Select from top referrers
- Display real members vs face members
- Commission tracking
- Pending withdrawal management
- Suspend/activate agents

**Metrics Shown:**
- Total referrals
- Real members (verified players)
- Face members (referred but unverified)
- Total commission earned
- Withdrawal pending count

### 7. Settings Page
**Purpose**: Platform-wide configuration

**Settings Categories:**
1. **General**
   - Platform name
   - Maintenance mode
   - Deposit bonus %
   - Referral commission %

2. **Financial**
   - Min/max withdrawal
   - Withdrawal fee %
   - Auto-approve deposits

3. **Game**
   - Min/max bet per round
   - Platform margin target %
   - Enable game controller
   - Smart risk default

4. **Security**
   - Phone verification required
   - Email verification required
   - Push notifications enabled
   - API key display

---

## 🔌 Integration with Supabase

### Tables Needed

```sql
-- Store admin settings
CREATE TABLE admin_settings (
  id UUID PRIMARY KEY,
  setting_key VARCHAR UNIQUE,
  setting_value JSONB,
  updated_at TIMESTAMP
);

-- Store game mode configurations
CREATE TABLE game_configurations (
  id UUID PRIMARY KEY,
  game_type VARCHAR (wingo, k3, trx, 5d),
  mode VARCHAR (30s, 1m, 3m, 5m),
  settings JSONB,
  smart_risk_enabled BOOLEAN,
  updated_by UUID,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Audit log for admin actions
CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY,
  admin_id UUID,
  action VARCHAR,
  target_user_id UUID,
  details JSONB,
  created_at TIMESTAMP
);

-- Smart risk triggers (for analytics)
CREATE TABLE smart_risk_triggers (
  id UUID PRIMARY KEY,
  game_type VARCHAR,
  mode VARCHAR,
  big_total BIGINT,
  small_total BIGINT,
  triggered_at TIMESTAMP,
  result VARCHAR
);
```

### Future Integration

```typescript
// Example: Fetch game settings from Supabase
const { data } = await supabase
  .from('game_configurations')
  .select('*')
  .eq('game_type', 'wingo')
  .order('created_at', { ascending: false })
  .limit(1)

// Update game settings
await supabase
  .from('game_configurations')
  .insert({
    game_type: 'wingo',
    mode: '30s',
    settings: newSettings,
    smart_risk_enabled: true,
    updated_by: adminId
  })

// Log admin action
await supabase
  .from('admin_audit_log')
  .insert({
    admin_id: adminId,
    action: 'UPDATE_GAME_SETTINGS',
    target_user_id: null,
    details: { game: 'wingo', changes: [...] }
  })
```

---

## 🎨 UI Design System

### Colors
```css
Primary Background: #1a1a2e
Secondary Background: #16213e
Border Color: #0f3460
Accent Color (Red): #e94560 → #ff6b6b
Success (Green): #4ade80
Warning (Yellow): #fbbf24
Error (Red): #ef4444
Info (Blue): #3b82f6
```

### Typography
- Headers: Bold, Large (24-32px)
- Section Headers: Bold, Medium (16-20px)
- Labels: Medium, Small (12-14px)
- Body: Regular, Small (12-14px)

### Components
- Cards: Rounded with border and gradient background
- Buttons: Gradient fill or border style
- Inputs: Dark background with light border
- Tables: Striped rows with hover effects
- Modals: Centered overlay with backdrop

---

## 🔐 Security Considerations

### Admin Access Control
- Route protected by ADMIN_SECRET_ID
- Verify admin status before rendering
- Log all admin actions
- IP whitelist option

### Data Protection
- No sensitive data in component state
- Use Supabase Row Level Security (RLS)
- Encrypt withdrawal account details
- Audit trail for fund adjustments

### Validation
- Server-side validation for all updates
- Rate limiting on approvals
- Confirm destructive actions (suspension, rejection)
- Timeout for inactive sessions

---

## 🚀 Deployment Checklist

- [ ] AdminContext state properly initialized
- [ ] All pages rendering correctly
- [ ] Sidebar navigation working
- [ ] Game controller saves settings
- [ ] Member search filtering works
- [ ] Fund management approvals work
- [ ] Agent management modal functions
- [ ] Settings save and persist
- [ ] Audit logging implemented
- [ ] Supabase integration complete
- [ ] Authentication/authorization working
- [ ] Error handling and validation
- [ ] Performance optimized
- [ ] Mobile responsive (optional)

---

## 📝 Usage Example

```typescript
// In main App component
import { AdminDashboard } from './admin/AdminDashboard'

export function App() {
  const { isAdminLoggedIn } = useAuth()
  
  // Show admin dashboard instead of regular UI
  if (isAdminLoggedIn && routePath === '/admin') {
    return <AdminDashboard />
  }
  
  return <HomeContent /> // Regular app
}

// Access admin context
function MyComponent() {
  const { currentPage, setCurrentPage, gameSettings } = useAdmin()
  
  return (
    <div>
      <p>Current page: {currentPage}</p>
      <button onClick={() => setCurrentPage('overview')}>
        Go to Overview
      </button>
    </div>
  )
}
```

---

## 🔧 Troubleshooting

### Context not working
- Ensure AdminProvider wraps the component
- Check useAdmin() hook placement
- Verify imports

### Page not rendering
- Check currentPage value in AdminContext
- Verify renderPage() switch case
- Check component imports

### Smart Risk not triggering
- Verify smartRiskEnabled is true
- Check bet thresholds are set correctly
- Ensure game is using the settings

---

## 📞 Support & Next Steps

1. **Connect to Supabase**: Replace mock data with real queries
2. **Add Websockets**: Real-time updates for statistics
3. **Implement 2FA**: For admin access security
4. **Add Charting**: Use Recharts for graphs
5. **Mobile Responsive**: Make dashboard mobile-friendly
6. **Dark Mode**: Already implemented, add toggle

---

**Dashboard Version**: 1.0
**Last Updated**: June 29, 2026
**Status**: ✅ Ready for Integration
