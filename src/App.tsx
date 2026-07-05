/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, ReactNode } from 'react';
import { Analytics } from "@vercel/analytics/next"
import { Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { useUser } from './context/UserContext';
import { useLanguage } from './context/LanguageContext';

// Components
import ErrorBoundary from './components/ErrorBoundary';
import { ModalProvider } from './components/GlobalModal';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import VipStatus from './components/VipStatus';
import Banner from './components/Banner';
import NoticeBar from './components/NoticeBar';
import WinningInfo from './components/WinningInfo';
import GameCategories from './components/GameCategories';
import FloatingIcons from './components/FloatingIcons';
import InstallPrompt from './components/InstallPrompt';

// Auth Views
import AuthView from './components/AuthView';

// User Views
import HomeContent from './components/HomeContent';
import ActivityView from './components/ActivityView';
import PromotionView from './components/PromotionView';
import AccountView from './components/AccountView';
import WalletView from './components/WalletView';
import GameStatistics from './components/GameStatistics';
import TransactionView from './components/TransactionView';
import DepositView from './components/DepositView';
import DepositHistoryView from './components/DepositHistoryView';
import WithdrawHistoryView from './components/WithdrawHistoryView';
import WithdrawView from './components/WithdrawView';
import VIPView from './components/VIPView';
import NoticeView from './components/NoticeView';
import WinGoView from './components/WinGoView';

// New Pages
import RebateRatioPage from './app/rebate-ratio/page';
import AgentSupportPage from './app/agent-support/page';

// Admin Views
import AdminLogin from './admin/pages/AdminLogin';
import { AdminDashboard as AdminPanel } from './admin/AdminDashboard';

// ============================================================
// ROUTE PROTECTION COMPONENTS
// ============================================================

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * ProtectedRoute - Ensures user is logged in
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isLoggedIn } = useUser();

  if (!isLoggedIn) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

/**
 * AdminRoute - Ensures admin is authenticated via admin login
 */
const AdminRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const location = useLocation();

  // Check if admin is authenticated
  if (typeof window !== 'undefined') {
    const isAdminAuthenticated = sessionStorage.getItem('admin_authenticated') === 'true';
    const adminRole = sessionStorage.getItem('admin_role');
    
    if (!isAdminAuthenticated || !adminRole) {
      return <Navigate to="/admin/login" replace />;
    }
  }

  // Extract secret from URL if it's in the path (e.g., /admin/3399944)
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const secretFromUrl = pathSegments[pathSegments.length - 1];

  // If we reach here, admin is authenticated
  return <>{children}</>;
};


// ============================================================
// MAIN APP COMPONENT
// ============================================================

const App: React.FC = () => {
  const { isLoggedIn, login } = useUser();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();

  // Track internal view state for sub-page navigation (like Account sub-views)
  const [currentView, setCurrentView] = useState('home');
  const [previousView, setPreviousView] = useState('home');
  const [vipInitialLevel, setVipInitialLevel] = useState<number | undefined>(undefined);

  // Determine current main route from pathname
  const currentPath = location.pathname.toLowerCase();

  // Helper to map path to view name for BottomNav
  const getMainView = (): string => {
    if (currentPath.includes('/wallet')) return 'wallet';
    if (currentPath.includes('/activity')) return 'activity';
    if (currentPath.includes('/account')) return 'account';
    if (currentPath.includes('/promotion')) return 'promotion';
    if (currentPath.includes('/admin')) return 'admin';
    return 'home';
  };

  const mainView = getMainView();
  const isAdminPath = currentPath.startsWith('/admin');
  const isAdminDashboard = currentPath.includes('/admin/dashboard');

  // Pages that should NOT show header or bottom nav
  const noNavPages = ['admin'];
  const shouldShowNav = !noNavPages.some(page => currentPath.includes(page)) && isLoggedIn;
  const shouldShowHeader = !noNavPages.some(page => currentPath.includes(page));

  // Handler for bottom nav tab changes
  const handleTabChange = (tab: string) => {
    switch (tab) {
      case 'home':
        setCurrentView('home');
        setPreviousView('home');
        setVipInitialLevel(undefined);
        navigate('/');
        break;
      case 'wallet':
        navigate('/wallet');
        break;
      case 'activity':
        navigate('/activity');
        break;
      case 'account':
        navigate('/account');
        break;
      case 'promotion':
        navigate('/promotion');
        break;
      default:
        navigate('/');
    }
  };

  // Helper to set sub-view for multi-panel pages like Account
  const handleNavigateToVip = (level?: number) => {
    setPreviousView(currentView);
    setVipInitialLevel(level);
    setCurrentView('vip');
  };

  // Admin-only routes should be handled separately from user authentication.
  if (isAdminPath) {
    return (
      <ErrorBoundary>
        <ModalProvider>
          <div className="min-h-screen bg-[#0A0A0B] font-sans selection:bg-amber-500 selection:text-black">
            <div className="w-full min-h-screen bg-gradient-to-b from-[#161618] to-[#0A0A0B] text-gray-100 relative overflow-x-hidden flex flex-col">
              <Routes>
                <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin/:secretId" element={<AdminLogin />} />
                <Route
                  path="/admin/dashboard"
                  element={
                    <AdminRoute>
                      <AdminPanel />
                    </AdminRoute>
                  }
                />
                <Route path="*" element={<Navigate to="/admin/login" replace />} />
              </Routes>
            </div>
          </div>
        </ModalProvider>
      </ErrorBoundary>
    );
  }

  // If not logged in, show auth view
  if (!isLoggedIn) {
    return (
      <ModalProvider>
      <div className="min-h-screen bg-[#0A0A0B] flex justify-center font-sans selection:bg-amber-500 selection:text-black">
        <div className="w-full max-w-[450px] mx-auto min-h-screen bg-[#0c0f17] shadow-2xl relative overflow-x-hidden border-x border-white/5 flex flex-col">
          <Routes>
            <Route
              path="/"
              element={
                <AuthView
                  initialMode="login"
                  onLoginSuccess={(phone, userId, profile, wallet) => {
                    login(phone, userId, profile, wallet);
                  }}
                />
              }
            />
            <Route
              path="/register"
              element={
                <AuthView
                  initialMode="register"
                  onLoginSuccess={(phone, userId, profile, wallet) => {
                    login(phone, userId, profile, wallet);
                  }}
                />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
      </ModalProvider>
    );
  }

  // Logged-in user interface with Routes
  return (
    <ErrorBoundary>
      <ModalProvider>
      <div className="min-h-screen bg-[#0A0A0B] flex justify-center font-sans selection:bg-amber-500 selection:text-black">
        <div
          className={`w-full ${isAdminDashboard ? 'max-w-full bg-gradient-to-b from-[#161618] to-[#0A0A0B]' : 'max-w-[450px] mx-auto bg-[#0c0f17] shadow-2xl relative'} text-gray-100 min-h-screen overflow-x-hidden border-x border-white/5 flex flex-col ${
            mainView !== 'admin' && shouldShowNav ? 'pb-[120px]' : ''
          }`}
        >
          {shouldShowHeader && <Header />}

          <Routes>
            {/* ===== ADMIN ROUTES ===== */}
            <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/:secretId" element={<AdminLogin />} />
            <Route
              path="/admin/dashboard"
              element={
                <AdminRoute>
                  <AdminPanel />
                </AdminRoute>
              }
            />

            {/* ===== PROTECTED USER ROUTES ===== */}
            <Route
              path="/wallet"
              element={
                <ProtectedRoute>
                  <WalletView onBack={() => navigate('/account')} />
                </ProtectedRoute>
              }
            />

            <Route
              path="/activity"
              element={
                <ProtectedRoute>
                  <ActivityView />
                </ProtectedRoute>
              }
            />

            <Route
              path="/account"
              element={
                <ProtectedRoute>
                  {currentView === 'account' ? (
                    <AccountView
                      onTransactionClick={() => setCurrentView('transaction')}
                      onDepositClick={() => setCurrentView('deposit')}
                      onWithdrawClick={() => setCurrentView('withdraw')}
                      onVipClick={(level) => handleNavigateToVip(level)}
                      onStatisticsClick={() => setCurrentView('statistics')}
                      onWalletClick={() => setCurrentView('wallet')}
                    />
                  ) : currentView === 'transaction' ? (
                    <TransactionView onBack={() => setCurrentView('account')} />
                  ) : currentView === 'deposit' ? (
                    <DepositView
                      onBack={() => setCurrentView('account')}
                      onTransactionClick={() => setCurrentView('deposit-history')}
                    />
                  ) : currentView === 'deposit-history' ? (
                    <DepositHistoryView onBack={() => setCurrentView('deposit')} />
                  ) : currentView === 'withdraw-history' ? (
                    <WithdrawHistoryView onBack={() => setCurrentView('withdraw')} />
                  ) : currentView === 'withdraw' ? (
                    <WithdrawView
                      onBack={() => setCurrentView('account')}
                      onTransactionClick={() => setCurrentView('withdraw-history')}
                    />
                  ) : currentView === 'statistics' ? (
                    <GameStatistics onBack={() => setCurrentView('account')} />
                  ) : currentView === 'wallet' ? (
                    <WalletView onBack={() => setCurrentView('account')} />
                  ) : currentView === 'vip' ? (
                    <VIPView initialLevel={vipInitialLevel} onBack={() => setCurrentView(previousView)} />
                  ) : (
                    <AccountView
                      onTransactionClick={() => setCurrentView('transaction')}
                      onDepositClick={() => setCurrentView('deposit')}
                      onWithdrawClick={() => setCurrentView('withdraw')}
                      onVipClick={(level) => handleNavigateToVip(level)}
                      onStatisticsClick={() => setCurrentView('statistics')}
                      onWalletClick={() => setCurrentView('wallet')}
                    />
                  )}
                </ProtectedRoute>
              }
            />

            <Route
              path="/promotion"
              element={
                <ProtectedRoute>
                  <PromotionView />
                </ProtectedRoute>
              }
            />

            <Route
              path="/rebate-ratio"
              element={
                <ProtectedRoute>
                  <RebateRatioPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/agent-support"
              element={
                <ProtectedRoute>
                  <AgentSupportPage />
                </ProtectedRoute>
              }
            />

            {/* ===== HOME ROUTE ===== */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <>
                    <div className="flex-1 flex flex-col">
                      {currentView === 'home' ? (
                        <>
                          <VipStatus onViewBenefits={(targetLevel) => handleNavigateToVip(targetLevel)} />
                          <Banner />
                          <NoticeBar onDetailClick={() => {
                            setPreviousView('home');
                            setCurrentView('notice');
                          }} />
                          <WinningInfo />
                          <GameCategories />
                          <HomeContent
                            onWinGoClick={() => setCurrentView('wingo')}
                            onDepositClick={() => {
                              setPreviousView(currentView);
                              setCurrentView('deposit');
                            }}
                          />
                        </>
                      ) : currentView === 'wingo' ? (
                        <WinGoView 
                          onBack={() => setCurrentView('home')} 
                          onWithdrawClick={() => {
                            setPreviousView('wingo');
                            setCurrentView('withdraw');
                          }}
                          onDepositClick={() => {
                            setPreviousView('wingo');
                            setCurrentView('deposit');
                          }}
                        />
                      ) : currentView === 'deposit' ? (
                        <DepositView
                          onBack={() => setCurrentView(previousView)}
                          onTransactionClick={() => setCurrentView('deposit-history')}
                        />
                      ) : currentView === 'deposit-history' ? (
                        <DepositHistoryView onBack={() => setCurrentView('deposit')} />
                      ) : currentView === 'withdraw' ? (
                        <WithdrawView
                          onBack={() => setCurrentView(previousView)}
                          onTransactionClick={() => setCurrentView('withdraw-history')}
                        />
                      ) : currentView === 'withdraw-history' ? (
                        <WithdrawHistoryView onBack={() => setCurrentView('withdraw')} />
                      ) : currentView === 'notice' ? (
                        <NoticeView onBack={() => setCurrentView(previousView)} />
                      ) : (
                        <>
                          <VipStatus onViewBenefits={(targetLevel) => handleNavigateToVip(targetLevel)} />
                          <Banner />
                          <NoticeBar onDetailClick={() => {
                            setPreviousView('home');
                            setCurrentView('notice');
                          }} />
                          <WinningInfo />
                          <GameCategories />
                          <HomeContent
                            onWinGoClick={() => setCurrentView('wingo')}
                            onDepositClick={() => {
                              setPreviousView(currentView);
                              setCurrentView('deposit');
                            }}
                          />
                        </>
                      )}
                    </div>
                    <FloatingIcons />
                    <InstallPrompt />
                  </>
                </ProtectedRoute>
              }
            />

            {/* ===== FALLBACK ===== */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          {shouldShowNav && <BottomNav activeTab={mainView} onTabChange={handleTabChange} />}
        </div>
      </div>
      </ModalProvider>
    </ErrorBoundary>
  );
};

export default App;