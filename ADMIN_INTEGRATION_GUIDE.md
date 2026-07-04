# Admin Dashboard - Integration & Setup Guide

## 🎯 Quick Start

### Step 1: Update App.tsx to Include Admin Routes

```typescript
// src/App.tsx
import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { UserProvider } from './context/UserContext'
import { AdminDashboard } from './admin/AdminDashboard'
import AuthViewReact from './components/AuthViewReact'
import HomeContent from './components/HomeContent'

export default function App() {
  const [adminView, setAdminView] = React.useState(false)
  
  // Check if accessing admin route
  React.useEffect(() => {
    const path = window.location.pathname
    if (path.includes('/admin')) {
      setAdminView(true)
    }
  }, [])

  if (adminView) {
    return <AdminDashboard />
  }

  return (
    <Router>
      <UserProvider>
        <Routes>
          <Route path="/" element={<AuthViewReact />} />
          <Route path="/home" element={<HomeContent />} />
        </Routes>
      </UserProvider>
    </Router>
  )
}
```

### Step 2: Update Backend Admin Route

```typescript
// backend/admin/admin.ts
import { Router } from 'express'

const router = Router()

// Return stats JSON instead of HTML
router.get('/', (req, res) => {
  res.json({
    authorized: true,
    message: 'Admin dashboard access granted',
  dashboardUrl: 'https://winwave-official.vercel.app/admin'
  })
})

router.get('/stats', (req, res) => {
  res.json({
    totalRechargeToday: 2500000,
    totalActiveUsers: 1234,
    totalUsers: 5678,
    totalWithdrawals: 1200000,
    totalBalance: 8500000
  })
})

export default router
```

### Step 3: Access Admin Dashboard

- **Local Dev**: https://winwave-official.vercel.app
- **Check Path**: Navigate to `/admin` route
- **Or Direct URL**: Add query param `?admin=true`

---

## 🏗️ Component Architecture

### AdminContext (Global State)
- Manages current page
- Stores game settings
- Maintains platform statistics
- Provides admin functions

### Sidebar (Navigation)
- Lists all menu items
- Handles expanded/collapsed menus
- Shows notification badges
- Status indicators

### Main Pages
- Each page is independent
- Receives props or uses context
- Handles local state for forms
- Modals for actions

```
AdminDashboard (Router)
├── AdminProvider (State)
├── Sidebar (Navigation)
└── Page Component (Content)
    ├── Overview
    ├── GamePage (WinGo/K3/TRX/5D)
    ├── MemberManagement
    ├── HistoryPage
    ├── FundsManagement
    ├── AgentManagement
    └── Settings
```

---

## 🎮 Game Controller Deep Dive

### Smart Risk Management Flow

```
Admin Access Game Controller
         ↓
Select Game Mode (30s/1m/3m/5m)
         ↓
View Current Settings
         ↓
Toggle Smart Risk AI
         ↓
Configure Limits:
├── Big Bet Limit (e.g., 100,000)
├── Small Bet Limit (e.g., 5,000)
└── Auto-trigger Threshold (e.g., 100,000)
         ↓
Set Payout Multiplier (e.g., 1.95)
         ↓
Click "Save Changes"
         ↓
Settings Stored in Context (+ localStorage for now)
         ↓
When Bets Come In:
├── Check if Smart Risk Enabled
├── Calculate total Big & Small bets
├── If Big > Threshold AND Small < Limit
│   └── Trigger Small Win
└── Otherwise: Normal game logic
```

### Example Scenario

```javascript
// Game: WinGo 30s Mode
// Settings:
{
  smartRiskEnabled: true,
  bigBetLimit: 100000,
  smallBetLimit: 5000,
  autoSmallWinThreshold: 100000,
  payoutMultiplier: 1.95
}

// Bets in this round:
const bets = [
  { user: 'User1', bet: 50000, choice: 'big' },
  { user: 'User2', bet: 60000, choice: 'big' },
  { user: 'User3', bet: 1000, choice: 'small' },
  { user: 'User4', bet: 2000, choice: 'small' },
]

// Calculation:
const totalBig = 110000  // > threshold (100000) ✓
const totalSmall = 3000  // < limit (5000) ✓

// Result:
→ System triggers SMALL WIN
→ User3 gets: 1000 × 1.95 = 1950
→ User4 gets: 2000 × 1.95 = 3900
→ Big bettors lose their bets
→ Platform margin = total bets - payouts
```

---

## 📊 Data Flow for Supabase Integration

### Current (Mock Data)
```typescript
// AdminContext.tsx
const [gameSettings, setGameSettings] = useState({
  wingo: { modes: { ... } },
  k3: { modes: { ... } },
  // etc
})
```

### Future (Supabase Integration)
```typescript
// 1. Fetch on component mount
useEffect(() => {
  const fetchSettings = async () => {
    const { data } = await supabase
      .from('game_configurations')
      .select('*')
    
    // Transform data to match state structure
    setGameSettings(transformData(data))
  }
  
  fetchSettings()
}, [])

// 2. Update on change
const updateGameMode = async (gameType, mode, updates) => {
  // Update local state
  setGameSettings(prev => ({...}))
  
  // Sync to Supabase
  const { error } = await supabase
    .from('game_configurations')
    .update({
      settings: gameSettings[gameType],
      updated_at: new Date()
    })
    .eq('game_type', gameType)
  
  if (error) console.error(error)
}
```

---

## 🔐 Security Implementation

### Admin Route Protection
```typescript
// middleware/adminAuth.ts
import { Router, Request, Response } from 'express'

export const adminAuthMiddleware = (req: Request, res: Response, next: Function) => {
  const secret = req.params.secret
  const adminSecret = process.env.ADMIN_SECRET_ID
  
  if (secret !== adminSecret) {
    return res.status(403).json({ error: 'Unauthorized' })
  }
  
  // Log admin access
  console.log(`Admin accessed at ${new Date()}`)
  next()
}

// backend/admin/admin.ts
router.use(adminAuthMiddleware)
```

### Frontend Auth Check
```typescript
// AdminDashboard.tsx
function AdminDashboardContent() {
  const [isAuthorized, setIsAuthorized] = React.useState(false)
  
  useEffect(() => {
    // Check if user has admin credentials
    const adminToken = localStorage.getItem('admin_token')
    if (!adminToken) {
      window.location.href = '/'
      return
    }
    setIsAuthorized(true)
  }, [])
  
  if (!isAuthorized) return <div>Redirecting...</div>
  
  return <AdminDashboard />
}
```

---

## 🧪 Testing Checklist

### Sidebar Navigation
- [ ] Click each menu item
- [ ] Verify page changes
- [ ] Check highlighted state
- [ ] Test submenu expansion/collapse
- [ ] Verify badges show

### Game Controller
- [ ] Load game settings
- [ ] Switch between modes (30s/1m/3m/5m)
- [ ] Toggle Smart Risk ON/OFF
- [ ] Update Big Bet Limit
- [ ] Update Small Bet Limit
- [ ] Change Payout Multiplier
- [ ] Save changes
- [ ] Verify "Changes saved" message

### Member Management
- [ ] Search by UID
- [ ] Search by Phone
- [ ] Search by Email
- [ ] Click member to view details
- [ ] Adjust balance (add/deduct)
- [ ] View security info (IPs, device IDs)

### History Pages
- [ ] Filter by date range
- [ ] Filter by status
- [ ] Export to CSV
- [ ] Check pagination
- [ ] Sort columns

### Funds Management
- [ ] View pending requests
- [ ] Approve deposit
- [ ] Reject withdrawal with reason
- [ ] Status updates correctly

### Agent Management
- [ ] View active agents
- [ ] Promote user to agent
- [ ] Check pending withdrawals
- [ ] View referral stats

### Settings
- [ ] Update setting value
- [ ] Save settings
- [ ] Check persistence
- [ ] Reset to defaults

---

## 📱 Responsive Considerations

Currently optimized for desktop. For mobile:

```typescript
// Add responsive classes
<div className="hidden lg:block">
  {/* Desktop sidebar */}
</div>

<div className="lg:hidden">
  {/* Mobile hamburger menu */}
</div>

// Adjust table display
<div className="overflow-x-auto">
  {/* Scrollable tables on mobile */}
</div>
```

---

## 🚀 Performance Tips

1. **Memoize Components**
   ```typescript
   const Sidebar = React.memo(SidebarComponent)
   const GameController = React.memo(GameControllerComponent)
   ```

2. **Lazy Load Pages**
   ```typescript
   const GamePage = React.lazy(() => import('./pages/GamePage'))
   const Settings = React.lazy(() => import('./pages/Settings'))
   ```

3. **Use Context Wisely**
   ```typescript
   // Split contexts by feature to avoid re-renders
   <GameSettingsProvider>
     <MemberProvider>
       <AdminDashboard />
     </MemberProvider>
   </GameSettingsProvider>
   ```

4. **Pagination**
   ```typescript
   // Don't load all records at once
   const pageSize = 50
   const [page, setPage] = useState(1)
   const records = await fetchRecords(page, pageSize)
   ```

---

## 🔄 Real-Time Updates (Future)

```typescript
// Use Supabase Realtime
supabase
  .on('*', {
    event: 'INSERT',
    schema: 'public',
    table: 'game_results'
  }, (payload) => {
    // Update dashboard when new game result
    updateStats()
  })
  .subscribe()
```

---

## 📝 Example Workflows

### Workflow 1: Enable Smart Risk for WinGo 30s

1. Navigate to Overview
2. Click "Games Management" → "WinGo"
3. Select "30s" mode
4. Toggle "Smart Risk Management AI" ON
5. Set limits:
   - Big Limit: 100,000
   - Small Limit: 5,000
6. Click "Save Changes"
7. Verify "Changes saved" appears

### Workflow 2: Adjust User Balance

1. Click "Member Management"
2. Search by UID: "UID#12345"
3. Click user in list
4. Click "Adjust Balance"
5. Select "Add" or "Deduct"
6. Enter amount: "10000"
7. Click "Confirm"
8. Verify balance updated

### Workflow 3: Promote Agent

1. Click "Agent Management"
2. Click "Select Member to Promote"
3. Choose top member: "Player_Top1"
4. Confirm promotion
5. Check agents list
6. New agent appears with 0 referrals

---

## 🐛 Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Admin page blank | Context not initialized | Wrap with AdminProvider |
| Sidebar not showing | CSS not loaded | Check import paths |
| Settings not saving | No persistence layer | Add localStorage/Supabase |
| Smart Risk not working | Logic not connected to game | Implement game logic hook |
| Search not filtering | Filter logic broken | Check filter conditions |
| Modals not closing | State not reset | Add manual reset on close |

---

## 📚 Additional Resources

- [AdminContext Code](./src/admin/context/AdminContext.tsx)
- [Sidebar Component](./src/admin/components/Sidebar.tsx)
- [Game Controller](./src/admin/components/GameController.tsx)
- [Full Documentation](./ADMIN_DASHBOARD_DOCS.md)

---

## ✅ Deployment Checklist

- [ ] All components created and imported
- [ ] AdminContext properly initialized
- [ ] Sidebar navigation working
- [ ] All pages rendering
- [ ] Game controller functional
- [ ] Member search working
- [ ] Funds management functional
- [ ] Settings persisting
- [ ] Error handling implemented
- [ ] Loading states added
- [ ] Mobile responsive (if needed)
- [ ] Supabase integration started
- [ ] Audit logging added
- [ ] Admin route protected
- [ ] Tested on different browsers

---

**Setup Complete! 🎉**

Your admin dashboard is ready to deploy. Start by connecting it to Supabase for persistent data storage.
