// Example: How to Integrate Admin Dashboard into main App.tsx

import React from 'react'
import { UserProvider } from './context/UserContext'
import { AdminDashboard } from './admin/AdminDashboard'
import AuthViewReact from './components/AuthViewReact'
import HomeContent from './components/HomeContent'

interface AppProps {
  initialAuthState?: 'login' | 'home' | 'admin'
}

export default function App({ initialAuthState = 'login' }: AppProps) {
  const [currentView, setCurrentView] = React.useState<'auth' | 'home' | 'admin'>(
    initialAuthState as any || 'auth'
  )

  // Option 1: Check URL path for admin route
  React.useEffect(() => {
    const path = window.location.pathname
    if (path.startsWith('/admin')) {
      const adminSecret = new URLSearchParams(window.location.search).get('secret')
      // Verify admin credentials
      if (adminSecret === process.env.REACT_APP_ADMIN_SECRET) {
        setCurrentView('admin')
      }
    }
  }, [])

  // Option 2: Use query parameter
  // http://localhost:3000/?view=admin&secret=YOUR_ADMIN_SECRET

  if (currentView === 'admin') {
    return <AdminDashboard />
  }

  if (currentView === 'home') {
    return (
      <UserProvider>
        <HomeContent />
      </UserProvider>
    )
  }

  // Default auth view
  return (
    <UserProvider>
      <AuthViewReact onAuthSuccess={() => setCurrentView('home')} />
    </UserProvider>
  )
}

// ============================================
// ALTERNATIVE: Using React Router
// ============================================

import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom'

export function AppWithRouting() {
  const navigate = useNavigate()

  return (
    <Routes>
      <Route
        path="/"
        element={
          <UserProvider>
            <AuthViewReact onAuthSuccess={() => navigate('/home')} />
          </UserProvider>
        }
      />
      <Route
        path="/home"
        element={
          <UserProvider>
            <HomeContent />
          </UserProvider>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminGuard>
            <AdminDashboard />
          </AdminGuard>
        }
      />
    </Routes>
  )
}

// Protect admin route
interface AdminGuardProps {
  children: React.ReactNode
}

function AdminGuard({ children }: AdminGuardProps) {
  const [isAuthorized, setIsAuthorized] = React.useState(false)
  const navigate = useNavigate()

  React.useEffect(() => {
    // Check for admin credentials in localStorage
    const adminToken = localStorage.getItem('admin_token')
    const expectedToken = process.env.REACT_APP_ADMIN_TOKEN

    if (adminToken === expectedToken) {
      setIsAuthorized(true)
    } else {
      // Redirect unauthorized users
      navigate('/')
    }
  }, [navigate])

  if (!isAuthorized) {
    return <div className="flex items-center justify-center h-screen text-white">Unauthorized...</div>
  }

  return <>{children}</>
}

// ============================================
// HOW TO USE
// ============================================

/*
1. DEVELOPMENT:
   - Access admin dashboard: http://localhost:3000/admin?secret=YOUR_ADMIN_SECRET
   - Or navigate with: setCurrentView('admin')

2. WITH ENVIRONMENT VARIABLES:
   Create .env file:
   REACT_APP_ADMIN_SECRET=your-secret-key-here
   REACT_APP_ADMIN_TOKEN=your-token-here

3. AFTER LOGIN:
   localStorage.setItem('admin_token', 'verified-token')
   // Then access /admin route

4. LOGOUT FROM ADMIN:
   localStorage.removeItem('admin_token')
   navigate('/home')

5. BACKEND VERIFICATION:
   // backend/admin/admin.ts
   router.get('/verify', (req, res) => {
     const token = req.headers['authorization']?.split(' ')[1]
     
     if (token === process.env.ADMIN_TOKEN) {
       res.json({ authorized: true })
     } else {
       res.status(403).json({ authorized: false })
     }
   })
*/

// ============================================
// ENVIRONMENT SETUP
// ============================================

/*
.env.local file:
-----------------
REACT_APP_ADMIN_SECRET=ww-admin-2026-secure
REACT_APP_ADMIN_TOKEN=admin_token_12345abcde

.env (for production):
-----------------
Set these on your hosting platform:
- Vercel: Settings > Environment Variables
- Add REACT_APP_ADMIN_SECRET and REACT_APP_ADMIN_TOKEN

Then in your admin route:
- Add verification to middleware
- Log all admin access
- Set session timeout (15 min inactive)
*/
