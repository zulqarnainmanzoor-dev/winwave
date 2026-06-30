import React, { useState } from "react";
import {
  ChevronLeft,
  HeadphonesIcon,
  FileClock,
  RefreshCw,
  X,
  Check,
  CreditCard,
  Plus,
  Lock,
  Shield,
  ShieldCheck,
  KeyRound
} from "lucide-react";
import { useUser, PAYMENT_LIMITS } from "../context/UserContext";

export default function WithdrawView({
  onBack,
  onTransactionClick,
}: {
  onBack: () => void;
  onTransactionClick: () => void;
}) {
  const { mainWalletBalance, thirdPartyWalletBalance, totalBalance, setBalance, wageringRequired, wageringCompleted, selectedPaymentMethod, setSelectedPaymentMethod, withdrawalPassword, setWithdrawalPassword: setWithdrawalPasswordContext, boundAccounts, setBoundAccounts } = useUser();
  const [amount, setAmount] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showAddWalletModal, setShowAddWalletModal] = useState(false);

  // 6-digit withdrawal password states - local editing buffer only
  const [isNumpadOpen, setIsNumpadOpen] = useState(false);
  const [numpadPurpose, setNumpadPurpose] = useState<"setup" | "confirm" | "verify">("setup");
  const [numpadBuffer, setNumpadBuffer] = useState("");
  const [setupPasswordBuffer, setSetupPasswordBuffer] = useState("");
  const [showPasswordSetupSuccess, setShowPasswordSetupSuccess] = useState(false);

  // Daily limits tracking
  const [withdrawCounts, setWithdrawCounts] = useState({
    easypaisa: 0,
    jazzcash: 0,
    usdt: 0,
  });

  // User can bind exactly 1 account/address per method - use from context
  const [newWalletName, setNewWalletName] = useState("");
  const [newWalletAccount, setNewWalletAccount] = useState("");
  const [usdtNetwork, setUsdtNetwork] = useState<"TRC20" | "ERC20" | "BEP20">("TRC20");
  const [newWalletRemarks, setNewWalletRemarks] = useState("");
  const [withdrawRemarks, setWithdrawRemarks] = useState("");

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const activeWallet = boundAccounts[selectedPaymentMethod];

  const limits = PAYMENT_LIMITS;

  const currentLimits = limits[selectedPaymentMethod];
  const wagerRequired = Math.max(0, wageringRequired - wageringCompleted);
  const withdrawableAmount = wagerRequired > 0 ? 0 : mainWalletBalance;

  const handleNumpadKey = (num: string) => {
    if (numpadBuffer.length >= 6) return;
    const newVal = numpadBuffer + num;
    setNumpadBuffer(newVal);

    if (newVal.length === 6) {
      setTimeout(() => {
        if (numpadPurpose === "setup") {
          setSetupPasswordBuffer(newVal);
          setNumpadBuffer("");
          setNumpadPurpose("confirm");
        } else if (numpadPurpose === "confirm") {
          if (newVal === setupPasswordBuffer) {
            setWithdrawalPasswordContext(newVal);
            setIsNumpadOpen(false);
            setNumpadBuffer("");
            setSetupPasswordBuffer("");
            setShowPasswordSetupSuccess(true);
          } else {
            alert("Passwords do not match! Please start setup again.");
            setNumpadPurpose("setup");
            setNumpadBuffer("");
            setSetupPasswordBuffer("");
          }
        } else if (numpadPurpose === "verify") {
          if (newVal === withdrawalPassword) {
            setIsNumpadOpen(false);
            setNumpadBuffer("");
            // Execute actual withdrawal
            handleWithdraw();
          } else {
            alert("Incorrect 6-digit withdrawal password! Please try again.");
            setNumpadBuffer("");
          }
        }
      }, 300);
    }
  };

  const handleNumpadBackspace = () => {
    setNumpadBuffer((prev) => prev.slice(0, -1));
  };

  const handleNumpadClear = () => {
    setNumpadBuffer("");
  };

  const handleWithdrawClick = () => {
    if (wagerRequired > 0) {
      alert(`Wagering requirement is incomplete. You need to bet Rs ${wagerRequired.toFixed(2)} more before you can withdraw.`);
      return;
    }

    if (!activeWallet) {
      alert(`Please add your ${selectedPaymentMethod.toUpperCase()} account details first.`);
      return;
    }

    const withdrawVal = parseFloat(amount);
    if (isNaN(withdrawVal)) {
      alert("Please enter a valid amount");
      return;
    }

    if (withdrawVal < currentLimits.min) {
      alert(`Minimum withdrawal for ${selectedPaymentMethod.toUpperCase()} is Rs ${currentLimits.min}`);
      return;
    }

    if (withdrawVal > currentLimits.max) {
      alert(`Maximum withdrawal limit per transaction is Rs ${currentLimits.max.toLocaleString()}`);
      return;
    }

    if (withdrawVal > mainWalletBalance) {
      alert("Insufficient balance");
      return;
    }

    if (!withdrawRemarks.trim()) {
      alert("Please provide withdrawal remarks/verification note. This protects against scams and is used to verify transactions.");
      return;
    }

    const currentCount = withdrawCounts[selectedPaymentMethod];
    const dailyLimit = currentLimits.dailyMax;
    if (currentCount >= dailyLimit) {
      alert(`Daily limit reached. You can only withdraw up to ${dailyLimit} times per day using ${selectedPaymentMethod.toUpperCase()}.`);
      return;
    }

    // Basic checks passed. Check withdrawal password.
    if (!withdrawalPassword) {
      setNumpadPurpose("setup");
      setNumpadBuffer("");
      setSetupPasswordBuffer("");
      setIsNumpadOpen(true);
    } else {
      setNumpadPurpose("verify");
      setNumpadBuffer("");
      setIsNumpadOpen(true);
    }
  };

  const handleAddWallet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWalletName.trim() || !newWalletAccount.trim()) {
      alert("Please fill in all fields correctly.");
      return;
    }
    
    // Bind the account for the current selected method
    setBoundAccounts((prev) => ({
      ...prev,
      [selectedPaymentMethod]: {
        name: newWalletName.trim(),
        account: newWalletAccount.trim(),
        remarks: newWalletRemarks.trim() || undefined,
        ...(selectedPaymentMethod === "usdt" ? { network: usdtNetwork } : {}),
      } as any,
    }));
    setNewWalletName("");
    setNewWalletAccount("");
    setNewWalletRemarks("");
    setShowAddWalletModal(false);
  };

  const handleWithdraw = () => {
    if (wagerRequired > 0) {
      alert(`Wagering requirement is incomplete. You need to bet Rs ${wagerRequired.toFixed(2)} more before you can withdraw.`);
      return;
    }

    if (!activeWallet) {
      alert(`Please add your ${selectedPaymentMethod.toUpperCase()} account details first.`);
      return;
    }

    const withdrawVal = parseFloat(amount);
    if (isNaN(withdrawVal)) {
      alert("Please enter a valid amount");
      return;
    }

    if (withdrawVal < currentLimits.min) {
      alert(`Minimum withdrawal for ${selectedPaymentMethod.toUpperCase()} is Rs ${currentLimits.min}`);
      return;
    }

    if (withdrawVal > currentLimits.max) {
      alert(`Maximum withdrawal limit per transaction is Rs ${currentLimits.max.toLocaleString()}`);
      return;
    }

    if (withdrawVal > mainWalletBalance) {
      alert("Insufficient balance");
      return;
    }

    if (!withdrawRemarks.trim()) {
      alert("Please provide withdrawal remarks/verification note. This protects against scams and is used to verify transactions.");
      return;
    }

    // Daily limit validation
    const currentCount = withdrawCounts[selectedPaymentMethod];
    const dailyLimit = currentLimits.dailyMax;
    if (currentCount >= dailyLimit) {
      alert(`Daily limit reached. You can only withdraw up to ${dailyLimit} times per day using ${selectedPaymentMethod.toUpperCase()}.`);
      return;
    }

    // Process actual withdrawal
    setBalance(totalBalance - withdrawVal);
    setWithdrawCounts((prev) => ({
      ...prev,
      [selectedPaymentMethod]: prev[selectedPaymentMethod] + 1,
    }));

    // Save to custom transactions with remarks for future verification
    try {
      const newTx = {
        id: `WD-${Math.floor(1000000 + Math.random() * 9000000)}`,
        type: "withdraw",
        amount: withdrawVal,
        status: "pending",
        date: new Date().toISOString().replace('T', ' ').substring(0, 19),
        remarks: withdrawRemarks.trim(),
        network: selectedPaymentMethod === "usdt" ? (activeWallet as any).network : undefined,
      };
      const existing = localStorage.getItem("custom_transactions");
      const txList = existing ? JSON.parse(existing) : [];
      txList.unshift(newTx);
      localStorage.setItem("custom_transactions", JSON.stringify(txList));
    } catch (e) {
      console.error(e);
    }

    setShowSuccessModal(true);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0A0A0B] h-screen overflow-y-auto relative text-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 sticky top-0 bg-[#161618] z-40 border-b border-white/5">
        <ChevronLeft
          className="w-6 h-6 text-white cursor-pointer"
          onClick={onBack}
        />
        <h1 className="text-white font-bold text-lg tracking-wide">Withdraw</h1>
        <div className="flex gap-4">
          <HeadphonesIcon className="w-5 h-5 text-[#ffa502] cursor-pointer" />
          <FileClock
            className="w-5 h-5 text-[#ffa502] cursor-pointer"
            onClick={onTransactionClick}
          />
        </div>
      </div>

      <div className="p-4 space-y-4 pb-28">
        {/* Balance Status Boxes */}
        <div className="flex gap-3">
          <div className="flex-1 bg-[#1C1C1E] rounded-xl p-4 relative overflow-hidden border border-white/5">
            <div className="flex items-center gap-1 mb-2 relative z-10">
              <span className="text-gray-300 font-bold text-sm">Cash Balance</span>
              <RefreshCw
                className={`w-3.5 h-3.5 text-gray-500 cursor-pointer hover:text-amber-500 ${isRefreshing ? "animate-spin" : ""}`}
                onClick={handleRefresh}
              />
            </div>
            <div className="flex items-end gap-1 relative z-10">
              <span className="text-amber-500 font-bold text-sm">Rs</span>
              <span className="text-amber-500 font-black text-2xl leading-none">
                {mainWalletBalance.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="flex-1 bg-[#1C1C1E] rounded-xl p-4 relative overflow-hidden border border-white/5">
            <div className="flex items-center gap-1 mb-2 relative z-10">
              <span className="text-gray-300 font-bold text-sm">Withdrawable</span>
            </div>
            <div className="flex items-end gap-1 relative z-10">
              <span className="text-amber-500 font-bold text-sm">Rs</span>
              <span className="text-amber-500 font-black text-2xl leading-none">
                {withdrawableAmount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Wager Required */}
        {wagerRequired > 0 ? (
          <div className="bg-[#1C1C1E] border border-amber-500/20 rounded-xl p-4 text-xs space-y-2">
            <div className="flex justify-between font-bold text-gray-200">
              <span>Wager Required to Withdraw</span>
              <span className="text-amber-500">Rs {wagerRequired.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-500 text-[10px]">
              <span>Progress</span>
              <span>Rs {wageringCompleted.toFixed(0)} / Rs {wageringRequired.toFixed(0)}</span>
            </div>
            <div className="w-full bg-[#0A0A0B] h-1.5 rounded-full overflow-hidden border border-white/5">
              <div
                className="bg-gradient-to-r from-amber-600 to-amber-400 h-full transition-all duration-300"
                style={{ width: `${wageringRequired > 0 ? Math.min(100, (wageringCompleted / wageringRequired) * 100) : 0}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-500 leading-tight">
              Only your bet amount counts toward wagering. Winnings do not reduce this requirement.
            </p>
          </div>
        ) : (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-400">
            <span className="font-bold">✓ Wagering requirement completed!</span> Your full main wallet balance is available for withdrawal.
          </div>
        )}

        {/* Premium Withdrawal Password Security Status Box */}
        {withdrawalPassword ? (
          <div className="bg-gradient-to-r from-emerald-500/5 to-teal-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-left">
                <h4 className="font-bold text-emerald-950 text-xs">Security PIN Active</h4>
                <p className="text-[10px] text-emerald-700/85">Every withdrawal requires your 6-digit verification PIN</p>
              </div>
            </div>
            <button 
              onClick={() => {
                setNumpadPurpose("setup");
                setNumpadBuffer("");
                setSetupPasswordBuffer("");
                setIsNumpadOpen(true);
              }}
              className="text-emerald-700 hover:text-emerald-900 font-bold text-[10px] underline cursor-pointer"
            >
              Reset PIN
            </button>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-amber-500/5 to-orange-500/10 border border-amber-500/20 rounded-xl p-3 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20 animate-pulse">
                <Lock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-left">
                <h4 className="font-bold text-amber-950 text-xs">Security PIN Required</h4>
                <p className="text-[10px] text-amber-700/85">Set a 6-digit password to authorize secure withdrawals</p>
              </div>
            </div>
            <button 
              onClick={() => {
                setNumpadPurpose("setup");
                setNumpadBuffer("");
                setSetupPasswordBuffer("");
                setIsNumpadOpen(true);
              }}
              className="bg-amber-500 text-white font-bold text-[10px] px-2.5 py-1 rounded-md shadow-sm hover:bg-orange-500 cursor-pointer transition-all"
            >
              Setup PIN
            </button>
          </div>
        )}

        {/* Payment Methods */}
        <div className="mt-4">
          <span className="text-gray-800 text-sm font-bold block mb-2">Withdrawal method</span>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <div
              onClick={() => setSelectedPaymentMethod("jazzcash")}
              className={`flex-1 min-w-[100px] relative flex flex-col items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
                selectedPaymentMethod === "jazzcash"
                  ? "border-[#ffa502] bg-white shadow-sm"
                  : "border-transparent bg-white shadow-sm opacity-80"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="bg-black rounded-md w-7 h-7 flex items-center justify-center font-bold text-red-500 italic text-[9px] border border-gray-800">
                  Jazz<span className="text-white">Cash</span>
                </div>
                <span className="font-bold text-xs text-gray-800">Jazzcash</span>
              </div>
              {selectedPaymentMethod === "jazzcash" && (
                <div className="absolute -bottom-0 -right-0 bg-[#ffa502] rounded-tl-lg rounded-br-sm w-4 h-4 flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </div>
              )}
            </div>

            <div
              onClick={() => setSelectedPaymentMethod("easypaisa")}
              className={`flex-1 min-w-[100px] relative flex flex-col items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
                selectedPaymentMethod === "easypaisa"
                  ? "border-[#ffa502] bg-white shadow-sm"
                  : "border-transparent bg-white shadow-sm opacity-80"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="bg-[#2ed573] rounded-full w-7 h-7 flex items-center justify-center text-white">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  >
                    <path d="M2 12a10 10 0 1 0 20 0 10 10 0 1 0-20 0" />
                    <path d="M12 8a4 4 0 1 0 0 8 4 4 0 1 0 0-8" />
                  </svg>
                </div>
                <span className="font-bold text-xs text-gray-800">Easypaisa</span>
              </div>
              {selectedPaymentMethod === "easypaisa" && (
                <div className="absolute -bottom-0 -right-0 bg-[#ffa502] rounded-tl-lg rounded-br-sm w-4 h-4 flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </div>
              )}
            </div>

            <div
              onClick={() => setSelectedPaymentMethod("usdt")}
              className={`flex-1 min-w-[100px] relative flex flex-col items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
                selectedPaymentMethod === "usdt"
                  ? "border-[#ffa502] bg-white shadow-sm"
                  : "border-transparent bg-white shadow-sm opacity-80"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="bg-[#26a17b] rounded-full w-7 h-7 flex items-center justify-center text-white font-bold text-xs">
                  ₮
                </div>
                <span className="font-bold text-xs text-gray-800">USDT</span>
              </div>
              {selectedPaymentMethod === "usdt" && (
                <div className="absolute -bottom-0 -right-0 bg-[#ffa502] rounded-tl-lg rounded-br-sm w-4 h-4 flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Wallet / Address Box */}
        <div className="mt-4">
          <span className="text-gray-800 text-sm font-bold block mb-2">Selected Account</span>
          {activeWallet ? (
            <div className="bg-white rounded-xl p-4 border border-[#ffa502]/30 bg-orange-500/5 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-[#ffa502]">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-gray-800 text-sm">{activeWallet.name}</h4>
                    {selectedPaymentMethod === "usdt" && (activeWallet as any).network && (
                      <span className="text-[9px] bg-[#26a17b]/10 text-[#26a17b] font-bold px-1.5 py-0.5 rounded border border-[#26a17b]/20">
                        {(activeWallet as any).network}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-xs font-mono">{activeWallet.account}</p>
                </div>
              </div>
              <span className="text-green-600 bg-green-50 font-bold text-[10px] px-2.5 py-1 rounded-full border border-green-200">
                Bound securely
              </span>
            </div>
          ) : (
            <div
              onClick={() => setShowAddWalletModal(true)}
              className="bg-dashed bg-white border-2 border-dashed border-gray-300 rounded-xl p-5 text-center cursor-pointer hover:border-[#ffa502] hover:bg-orange-50/20 transition-all flex flex-col items-center justify-center gap-1"
            >
              <Plus className="w-6 h-6 text-gray-400" />
              <span className="font-bold text-gray-700 text-xs">Add {selectedPaymentMethod.toUpperCase()} Account</span>
            </div>
          )}
        </div>

        {/* Withdrawal Amount Input */}
        <div className="flex flex-col gap-2 mt-4">
          <div className="flex justify-between items-center text-gray-600 text-xs font-semibold">
            <span>Withdrawal amount: Min: Rs {currentLimits.min.toLocaleString()} Max: Rs {currentLimits.max.toLocaleString()}</span>
            <span className="text-orange-600 font-bold">Daily: {withdrawCounts[selectedPaymentMethod]}/{currentLimits.dailyMax}</span>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 flex items-center p-3 shadow-sm">
            <span className="text-gray-800 font-bold text-lg mr-2 border-r border-gray-300 pr-2">
              Rs
            </span>
            <input
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 outline-none text-[#ffa502] font-bold text-lg bg-transparent"
            />
            <button
              onClick={() => setAmount(mainWalletBalance.toFixed(0))}
              className="text-[#ffa502] font-bold text-sm px-2 cursor-pointer hover:text-orange-600"
            >
              All
            </button>
          </div>
        </div>

        {/* Withdrawal Remarks Input */}
        <div className="flex flex-col gap-2 mt-4">
          <div className="flex justify-between items-center text-gray-600 text-xs font-semibold">
            <span>Withdrawal Remarks (Required for Verification)</span>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
            <input
              type="text"
              required
              placeholder="Enter remarks/memo (e.g. My Personal Wallet, used for verification)"
              value={withdrawRemarks}
              onChange={(e) => setWithdrawRemarks(e.target.value)}
              className="w-full outline-none text-gray-800 text-sm bg-transparent"
            />
          </div>
          <span className="text-[9px] text-gray-400 italic">
            * Remarks must match recently copied note details to ensure accurate verification and protect against transaction fraud.
          </span>
        </div>

        {/* Limits & Details */}
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-xs space-y-2.5 text-gray-600 font-medium">
          <div className="flex justify-between">
            <span>Withdrawal Limit per Request:</span>
            <span className="font-bold text-white">Rs {currentLimits.max.toLocaleString()}.00</span>
          </div>
          <div className="flex justify-between">
            <span>Remaining Withdrawal Limit:</span>
            <span className="font-bold text-amber-500">Rs {currentLimits.max.toLocaleString()}.00</span>
          </div>
          <div className="flex justify-between">
            <span>Daily Withdrawal Times:</span>
            <span className="font-bold text-gray-900">
              {selectedPaymentMethod === "usdt" ? "5" : "3"} times a day
            </span>
          </div>
          <div className="flex justify-between">
            <span>Remaining Daily Withdrawals:</span>
            <span className="font-bold text-orange-500">
              {currentLimits.dailyMax - withdrawCounts[selectedPaymentMethod]} left
            </span>
          </div>
        </div>

        {/* Withdrawal Tips */}
        <div className="mt-4 text-xs text-[#74839e] leading-relaxed space-y-2">
          <p className="text-gray-800 font-bold">Important notes:</p>
          <p>
            1. Under normal circumstances, the withdrawal amount will arrive in your account in about{" "}
            <span className="text-orange-500 font-bold">24 hours</span>.
          </p>
          <p>2. Double-check your account information before proceeding. Incorrect accounts can lead to transaction failure or lost funds.</p>
        </div>
      </div>

      {/* Action Button at Bottom */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-gradient-to-t from-[#f5f8ff] to-[#f5f8ff]/80 backdrop-blur-sm z-30">
        <button
          onClick={handleWithdrawClick}
          className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-lg py-3.5 rounded-full shadow-lg shadow-orange-500/30 hover:brightness-110 transition-all cursor-pointer"
        >
          Withdraw
        </button>
      </div>



      {/* Add New Wallet modal */}
      {showAddWalletModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1C1C1E] rounded-2xl p-5 w-full max-w-sm border border-white/10 text-gray-100 relative shadow-2xl">
            <X
              className="absolute top-4 right-4 text-gray-400 cursor-pointer hover:text-white"
              onClick={() => {
                setShowAddWalletModal(false);
                setNewWalletName("");
                setNewWalletAccount("");
                setNewWalletRemarks("");
              }}
            />
            <h3 className="font-bold text-lg mb-4 text-white">Add {selectedPaymentMethod.toUpperCase()} Account</h3>
            
            <form onSubmit={handleAddWallet} className="space-y-4">
              {/* Premium Network Display specifically for USDT (Just TRC20) */}
              {selectedPaymentMethod === "usdt" && (
                <div className="bg-gradient-to-br from-[#121c16] to-[#0a120e] border border-emerald-500/30 rounded-xl p-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1 text-left">
                      <span className="text-[10px] uppercase font-black tracking-wider text-[#26a17b]">USDT Network</span>
                      <h4 className="text-white text-base font-black tracking-tight">TRC20 (TRON)</h4>
                      <p className="text-[10px] text-gray-400">Secure blockchain, fast settlement & minimal network fee</p>
                    </div>
                    <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs text-gray-400 block mb-1">Account Holder Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Muhammad Ali"
                  value={newWalletName}
                  onChange={(e) => setNewWalletName(e.target.value)}
                  className="w-full bg-white/5 rounded-lg border border-white/10 px-3 py-2 text-sm outline-none focus:border-[#ffa502] text-white"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs text-gray-400 block">Account Number / Address</label>
                  {selectedPaymentMethod === "usdt" && (
                    <span className="text-[10px] text-amber-500 font-bold">ReadOnly (Use Paste)</span>
                  )}
                </div>
                
                <div className="relative">
                  <input
                    type="text"
                    required
                    readOnly={selectedPaymentMethod === "usdt"}
                    placeholder={selectedPaymentMethod === "usdt" ? "Click 'Paste Wallet Address'" : "e.g. 03331234567"}
                    value={newWalletAccount}
                    onChange={(e) => setNewWalletAccount(e.target.value)}
                    className={`w-full bg-white/5 rounded-lg border border-white/10 px-3 py-2 text-sm outline-none focus:border-[#ffa502] text-white ${
                      selectedPaymentMethod === "usdt" ? "pr-20 cursor-not-allowed bg-white/5 opacity-80" : ""
                    }`}
                  />
                  
                  {selectedPaymentMethod === "usdt" && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          if (text && text.trim().length > 0) {
                            setNewWalletAccount(text.trim());
                          } else {
                            const textFallback = prompt("Please paste your USDT Wallet Address here:");
                            if (textFallback) {
                              setNewWalletAccount(textFallback.trim());
                            }
                          }
                        } catch (err) {
                          const textFallback = prompt("Please paste your USDT Wallet Address here:");
                          if (textFallback) {
                            setNewWalletAccount(textFallback.trim());
                          }
                        }
                      }}
                      className="absolute right-1.5 top-1.5 bottom-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:brightness-110 font-black text-[10px] px-2.5 rounded-md uppercase transition-all"
                    >
                      Paste
                    </button>
                  )}
                </div>
              </div>

              {/* Remarks Field */}
              <div>
                <label className="text-xs text-gray-400 block mb-1">Account Remarks (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Primary verified account"
                  value={newWalletRemarks}
                  onChange={(e) => setNewWalletRemarks(e.target.value)}
                  className="w-full bg-white/5 rounded-lg border border-white/10 px-3 py-2 text-sm outline-none focus:border-[#ffa502] text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddWalletModal(false);
                    setNewWalletName("");
                    setNewWalletAccount("");
                    setNewWalletRemarks("");
                  }}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-2.5 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 text-white font-bold py-2.5 rounded-lg text-sm"
                >
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs text-center shadow-xl animate-scale-in text-gray-800">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-500" strokeWidth={3} />
            </div>
            <h3 className="font-bold text-lg text-gray-900 mb-2">Request Submitted</h3>
            <p className="text-xs text-gray-600 mb-3">
              Your withdrawal of <span className="font-bold text-gray-900">Rs {parseFloat(amount).toLocaleString()}</span> has been submitted and will arrive in your account within 24 hours.
            </p>
            {withdrawRemarks && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-4 text-left text-[10px] text-amber-800">
                <span className="font-bold block uppercase tracking-wider text-[8px] text-amber-600 mb-0.5">Verification Remarks</span>
                "{withdrawRemarks}"
              </div>
            )}
            <button
              onClick={() => {
                setShowSuccessModal(false);
                setAmount("");
                setWithdrawRemarks("");
                onBack();
              }}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold py-2.5 rounded-full hover:brightness-110"
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      {/* 6-Digit Withdrawal Security PIN Bottom Numpad Modal */}
      {isNumpadOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center transition-opacity duration-300">
          {/* Backdrop click to close */}
          <div 
            className="absolute inset-0" 
            onClick={() => {
              setIsNumpadOpen(false);
              setNumpadBuffer("");
              setSetupPasswordBuffer("");
            }}
          />
          
          {/* Bottom Sheet container */}
          <div className="bg-[#121214] border-t border-white/10 rounded-t-[2.5rem] w-full max-w-md p-6 pb-8 text-white relative shadow-2xl transition-all duration-300 animate-slide-up z-10">
            {/* Notch */}
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-5" />
            
            <X
              className="absolute top-5 right-5 text-gray-400 hover:text-white cursor-pointer w-5 h-5"
              onClick={() => {
                setIsNumpadOpen(false);
                setNumpadBuffer("");
                setSetupPasswordBuffer("");
              }}
            />

            {/* Lock/Shield Icon at header */}
            <div className="flex flex-col items-center text-center mt-2 mb-6">
              <div className="w-12 h-12 rounded-full bg-[#ffa502]/10 flex items-center justify-center border border-[#ffa502]/20 mb-3">
                <KeyRound className="w-6 h-6 text-[#ffa502]" />
              </div>
              <h3 className="font-bold text-lg text-white tracking-tight">
                {numpadPurpose === "setup" && "Set Withdrawal Password"}
                {numpadPurpose === "confirm" && "Confirm Withdrawal Password"}
                {numpadPurpose === "verify" && "Enter Withdrawal Password"}
              </h3>
              <p className="text-xs text-gray-400 mt-1 max-w-[250px]">
                {numpadPurpose === "setup" && "Create a secure 6-digit password to authorize withdrawals."}
                {numpadPurpose === "confirm" && "Please enter the same 6-digit password to confirm."}
                {numpadPurpose === "verify" && "Enter your 6-digit security PIN to authorize transaction."}
              </p>
            </div>

            {/* Dot Indicators */}
            <div className="flex justify-center gap-4 mb-8">
              {[0, 1, 2, 3, 4, 5].map((idx) => (
                <div
                  key={idx}
                  className={`w-4.5 h-4.5 rounded-full transition-all duration-150 ${
                    idx < numpadBuffer.length
                      ? "bg-gradient-to-r from-amber-500 to-orange-500 scale-110 shadow-lg shadow-orange-500/20"
                      : "bg-white/10 border border-white/5"
                  }`}
                />
              ))}
            </div>

            {/* Numeric Keypad Grid */}
            <div className="grid grid-cols-3 gap-3">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleNumpadKey(num)}
                  className="h-14 bg-white/5 hover:bg-white/10 active:bg-white/15 rounded-2xl flex items-center justify-center text-xl font-bold transition-all text-white active:scale-95 cursor-pointer select-none"
                >
                  {num}
                </button>
              ))}
              
              <button
                type="button"
                onClick={handleNumpadClear}
                className="h-14 hover:bg-white/5 rounded-2xl flex items-center justify-center text-xs font-bold text-gray-400 hover:text-white transition-all active:scale-95 cursor-pointer select-none"
              >
                Clear
              </button>
              
              <button
                type="button"
                onClick={() => handleNumpadKey("0")}
                className="h-14 bg-white/5 hover:bg-white/10 active:bg-white/15 rounded-2xl flex items-center justify-center text-xl font-bold transition-all text-white active:scale-95 cursor-pointer select-none"
              >
                0
              </button>
              
              <button
                type="button"
                onClick={handleNumpadBackspace}
                className="h-14 hover:bg-white/5 rounded-2xl flex items-center justify-center text-gray-400 hover:text-white transition-all active:scale-95 cursor-pointer select-none"
              >
                <span className="text-xl">⌫</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Setup Success Center Modal */}
      {showPasswordSetupSuccess && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs text-center shadow-2xl relative text-gray-800 animate-scale-in">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-8 h-8 text-green-500" strokeWidth={3} />
            </div>
            <h3 className="font-bold text-lg text-gray-900 mb-1">Setup Successful</h3>
            <p className="text-xs text-gray-600 mb-4 leading-relaxed">
              Your 6-digit withdrawal password has been configured successfully. Your account is now fully secured.
            </p>
            <button
              onClick={() => setShowPasswordSetupSuccess(false)}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold py-2.5 rounded-full hover:brightness-110 transition-all cursor-pointer shadow-md"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

