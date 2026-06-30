/**

 * @license

 * SPDX-License-Identifier: Apache-2.0

 */



import { useState, useEffect } from 'react';

import Header from './components/Header';

import VipStatus from './components/VipStatus';

import Banner from './components/Banner';

import NoticeBar from './components/NoticeBar';

import WinningInfo from './components/WinningInfo';

import GameCategories from './components/GameCategories';

import HomeContent from './components/HomeContent';

import FloatingIcons from './components/FloatingIcons';

import InstallPrompt from './components/InstallPrompt';

import BottomNav from './components/BottomNav';

import ActivityView from './components/ActivityView';

import PromotionView from './components/PromotionView';

import AccountView from './components/AccountView';

import WalletView from './components/WalletView';

import WinGoView from './components/WinGoView';

import TransactionView from './components/TransactionView';

import DepositView from './components/DepositView';

import DepositHistoryView from './components/DepositHistoryView';

import WithdrawView from './components/WithdrawView';

import VIPView from './components/VIPView';

import NoticeView from './components/NoticeView';

import GameStatistics from './components/GameStatistics';

import AuthView from './components/AuthView';

import { useLanguage } from './context/LanguageContext';

import { useUser } from './context/UserContext';


import { AdminDashboard as AdminPanel } from './admin/AdminDashboard';



export default function App() {

  const { t } = useLanguage();

  const { isLoggedIn, login } = useUser();

  const [currentView, setCurrentView] = useState('home');

  const [isAdmin, setIsAdmin] = useState(false);

  const [previousView, setPreviousView] = useState('home');

  const isAdminPath = window.location.pathname.startsWith('/admin-panel');







  // Simple Admin Guard

  useEffect(() => {

    const path = window.location.pathname;

    const search = new URLSearchParams(window.location.search);

    const adminSecret = import.meta.env.VITE_ADMIN_SECRET_ID || '3399944';

    const adminPath = `api/admin/${adminSecret}`;

    const apiAdminPath = `/api/admin/${adminSecret}`;

    const isAdminUrlParam =

      search.get('view') === 'admin' && search.get('secret') === adminSecret;

    const isAdminPath =

      path === adminPath ||

      path.startsWith(`${adminPath}/`) ||

      path === apiAdminPath ||

      path.startsWith(`${apiAdminPath}/`) ||

      isAdminUrlParam;

    setIsAdmin(isAdminPath);

  }, []);



  if (isAdmin) {

    return <AdminPanel />;

  }

  const [vipInitialLevel, setVipInitialLevel] = useState<number | undefined>(undefined);



  const navigateToVip = (level?: number) => {

    setPreviousView(currentView);

    setVipInitialLevel(level);

    setCurrentView('vip');

  };



  if (!isLoggedIn) {

    return (

      <div className="min-h-screen bg-[#0A0A0B] flex justify-center font-sans selection:bg-amber-500 selection:text-black">

        <div className="w-full max-w-md bg-gradient-to-b from-[#161618] to-[#0A0A0B] text-gray-100 relative min-h-screen overflow-x-hidden shadow-2xl border-x border-white/5 flex flex-col">

          <AuthView

            initialMode="login"

            onLoginSuccess={(phone, userId, profile, wallet) => {

              login(phone, userId, profile, wallet);

            }}

          />

        </div>

      </div>

    );

  }



  return (

    <div className="min-h-screen bg-[#0A0A0B] flex justify-center font-sans selection:bg-amber-500 selection:text-black">

      <div className={`w-full max-w-md bg-gradient-to-b from-[#161618] to-[#0A0A0B] text-gray-100 relative min-h-screen overflow-x-hidden shadow-2xl border-x border-white/5 flex flex-col ${currentView !== 'wingo' && currentView !== 'transaction' && currentView !== 'deposit' && currentView !== 'deposit-history' && currentView !== 'withdraw' && currentView !== 'vip' && currentView !== 'notice' ? 'pb-[120px]' : ''}`}>

       

        {currentView === 'wingo' ? (

          <WinGoView onBack={() => setCurrentView('home')} />

        ) : currentView === 'transaction' ? (

          <TransactionView onBack={() => setCurrentView('account')} />

        ) : currentView === 'deposit' ? (

          <DepositView onBack={() => setCurrentView('account')} onTransactionClick={() => setCurrentView('deposit-history')} />

        ) : currentView === 'deposit-history' ? (

          <DepositHistoryView onBack={() => setCurrentView('deposit')} />

        ) : currentView === 'withdraw' ? (

          <WithdrawView onBack={() => setCurrentView('account')} onTransactionClick={() => setCurrentView('transaction')} />

        ) : currentView === 'vip' ? (

          <VIPView initialLevel={vipInitialLevel} onBack={() => setCurrentView(previousView)} />

        ) : currentView === 'notice' ? (

          <NoticeView onBack={() => setCurrentView(previousView)} />

        ) : (

          <>

            <Header />

            {currentView === 'home' && (

              <div className="flex-1 flex flex-col">

                <VipStatus onViewBenefits={(targetLevel) => navigateToVip(targetLevel)} />

                <Banner />

                <NoticeBar onDetailClick={() => {

                  setPreviousView(currentView);

                  setCurrentView('notice');

                }} />

                <WinningInfo />

                <GameCategories />

               

                <HomeContent onWinGoClick={() => setCurrentView('wingo')} />

              </div>

            )}



        {currentView === 'activity' && (

          <ActivityView />

        )}



        {currentView === 'promotion' && (

          <PromotionView />

        )}



        {currentView === 'account' && (

          <AccountView

            onTransactionClick={() => setCurrentView('transaction')}

            onDepositClick={() => setCurrentView('deposit')}

            onWithdrawClick={() => setCurrentView('withdraw')}

            onVipClick={(level) => navigateToVip(level)}

            onStatisticsClick={() => setCurrentView('statistics')}

            onWalletClick={() => setCurrentView('wallet')}

          />

        )}



        {currentView === 'statistics' && (

          <GameStatistics onBack={() => setCurrentView('account')} />

        )}



        {currentView === 'wallet' && (

          <WalletView onBack={() => setCurrentView('account')} />

        )}



        {currentView !== 'home' && currentView !== 'activity' && currentView !== 'promotion' && currentView !== 'account' && currentView !== 'wallet' && currentView !== 'wingo' && (

          <div className="flex-1 flex items-center justify-center">

            <span className="text-gray-500 font-bold uppercase tracking-widest text-xs">{currentView} View</span>

          </div>

        )}



        <FloatingIcons />

        <InstallPrompt />

        <BottomNav activeTab={currentView} onTabChange={setCurrentView} />

          </>

        )}

      </div>

    </div>

  );

}

