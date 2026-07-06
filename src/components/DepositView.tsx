import { useEffect, useState } from "react";
import {
  ChevronLeft,
  HeadphonesIcon,
  FileClock,
  RefreshCw,
  X,
  Check,
} from "lucide-react";
import { useUser } from "../context/UserContext";
import { supabase } from "../lib/supabaseClient";
import { useLanguage } from "../context/LanguageContext";

export default function DepositView({
  onBack,
  onTransactionClick,
}: {
  onBack: () => void;
  onTransactionClick: () => void;
}) {
  // Safe Destructuring with Fallbacks to prevent white screen crashes
  const userContext = useUser();
  const balance = userContext?.balance ?? 0;
  const uid = userContext?.uid;
  const refreshUserData = userContext?.refreshUserData;
  const selectedPaymentMethod = userContext?.selectedPaymentMethod ?? "jazzcash";
  const setSelectedPaymentMethod = userContext?.setSelectedPaymentMethod ?? (() => {});

  const languageContext = useLanguage();
  const t = languageContext?.t ?? ((key: string) => key);

  const [amount, setAmount] = useState<string>("300");
  const [selectedAmount, setSelectedAmount] = useState<number | null>(300);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Preset amounts with 2% bonus calculation for UI
  const quickAmounts = [
    { value: 300, bonus: 6 },
    { value: 500, bonus: 10 },
    { value: 800, bonus: 16 },
    { value: 1000, bonus: 20 },
    { value: 2000, bonus: 40 },
    { value: 3000, bonus: 60 },
    { value: 5000, bonus: 100 },
    { value: 8000, bonus: 160 },
    { value: 10000, bonus: 200 },
    { value: 20000, bonus: 400 },
    { value: 30000, bonus: 600 },
    { value: 50000, bonus: 1000 },
  ];

  // JazzCash PKPay Gateway Links per amount
  const jazzcashLinks: Record<number, string> = {
    300: "https://cashier.pkpay.click/pay/8fb65585df22bb6c",
    500: "https://cashier.pkpay.click/pay/7099555e5d96948a",
    800: "https://cashier.pkpay.click/pay/b40a681c9347518b",
    1000: "https://cashier.pkpay.click/pay/e6adf22d1645a3c1",
    2000: "https://cashier.pkpay.click/pay/c9c08cd3ac807b7b",
    3000: "https://cashier.pkpay.click/pay/2e2843558794d95a",
    5000: "https://cashier.pkpay.click/pay/9e1931ee76a1c7be",
    8000: "https://cashier.pkpay.click/pay/3b953ec0d8c699cb",
    10000: "https://cashier.pkpay.click/pay/bfa519a4a3557a4e",
    20000: "https://cashier.pkpay.click/pay/c0346b6c6f66d9e1",
    30000: "https://cashier.pkpay.click/pay/46ed4014c01a2dd2",
    50000: "https://cashier.pkpay.click/pay/aa3071795294a6ed"
  };

  // Easypaisa fixed links mapping (amount -> url)
  const EASY_PAISA_LINKS: Record<number, string> = {
    50000: "https://cashier.pkpay.click/pay/387931f98134400e",
    30000: "https://cashier.pkpay.click/pay/67e964fd8f780f66",
    20000: "https://cashier.pkpay.click/pay/443568805ecbdd84",
    10000: "https://cashier.pkpay.click/pay/a9038d8ae209d6d7",
    8000: "https://cashier.pkpay.click/pay/ba86795097ff5508",
    5000: "https://cashier.pkpay.click/pay/10b2aad1347174b4",
    3000: "https://cashier.pkpay.click/pay/efc061dbaff90b93",
    2000: "https://cashier.pkpay.click/pay/4428560b30bfb6d1",
    1000: "https://cashier.pkpay.click/pay/8ad27749f7849fae",
    800: "https://cashier.pkpay.click/pay/d0c12155e83081d0",
    500: "https://cashier.pkpay.click/pay/d74d75b92aa0c111",
    300: "https://cashier.pkpay.click/pay/445f3a965fe98b38",
  };

  // For backwards-compatibility with older variable names used elsewhere
  const easypaisaLinks = EASY_PAISA_LINKS;

  useEffect(() => {
    if (!uid || !refreshUserData) return;
    void refreshUserData();
  }, [uid, refreshUserData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    if (uid && refreshUserData) {
      void refreshUserData();
    }
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const handleAmountSelect = (val: number) => {
    setSelectedAmount(val);
    setAmount(val.toString());
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(e.target.value);
    const num = parseInt(e.target.value);
    if (!isNaN(num)) {
      const match = quickAmounts.find((q) => q.value === num);
      if (match) {
        setSelectedAmount(match.value);
      } else {
        setSelectedAmount(null);
      }
    } else {
      setSelectedAmount(null);
    }
  };

  // Payment Redirection Logic based on selected method
  const handlePayNow = async () => {
    const amountToPay = selectedAmount || parseInt(amount);

    if (!amountToPay || isNaN(amountToPay)) {
      alert("Please select or enter a valid amount.");
      return;
    }

    // Get the correct payment link based on selected method
    const links = selectedPaymentMethod === "easypaisa" ? easypaisaLinks : jazzcashLinks;
    const targetUrl = links[amountToPay];

    if (targetUrl) {
      // Extract order_id from PKPay URL (last part after /pay/)
      const urlParts = targetUrl.split('/');
      const orderId = urlParts[urlParts.length - 1];
      
      if (!orderId) {
        window.location.href = targetUrl;
        return;
      }

      // Create pending deposit_history record before redirect
      try {
        const userId = (userContext as any)?.uid || null;
        if (!userId) {
          window.location.href = targetUrl;
          return;
        }

        try {
          // Insert into deposit_history with PKPay order_id and WAIT for completion
          await (supabase as any)
            .from('deposit_history')
            .insert([{
              user_id: userId,
              amount: amountToPay,
              method: selectedPaymentMethod.toUpperCase(),
              order_id: orderId,
              gateway_ref: targetUrl,
              status: 'pending',
              remarks: `PKPay deposit via ${selectedPaymentMethod.toUpperCase()}. Amount Rs ${amountToPay}`,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }]);
          console.log(`Created pending deposit for order_id: ${orderId}`);
        } catch (error) {
          console.error('Failed to create deposit record:', error);
        }
        
        // Redirect AFTER insert completes
        window.location.href = targetUrl;
      } catch (e) {
        window.location.href = targetUrl;
        return;
      }
    } else {
      alert("Automated deposits are only available for fixed packages right now. Please select a supported quick amount for the selected gateway.");
    }
  };

  const currentBonus =
    quickAmounts.find((q) => q.value === parseInt(amount))?.bonus || 0;

  const amountNum = selectedAmount || parseInt(amount);
  const payLinks = selectedPaymentMethod === 'easypaisa' ? easypaisaLinks : jazzcashLinks;
  const isAmountSupported = !!(amountNum && payLinks && payLinks[amountNum]);

  return (
    <div className="flex-1 flex flex-col bg-[#05070e] h-screen overflow-y-auto relative text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 sticky top-0 bg-[#08101f] z-40 border-b border-white/10 shadow-sm">
        <ChevronLeft
          className="w-6 h-6 text-white cursor-pointer"
          onClick={onBack}
        />
        <h1 className="text-white font-bold text-lg">Deposit</h1>
        <div className="flex gap-4">
          <HeadphonesIcon className="w-5 h-5 text-[#60a5fa] cursor-pointer" />
          <FileClock
            className="w-5 h-5 text-[#60a5fa] cursor-pointer"
            onClick={onTransactionClick}
          />
        </div>
      </div>

      <div className="p-4 space-y-4 pb-24">
        {/* Balance Cards */}
        <div className="flex gap-3">
          <div className="flex-1 bg-[#0f172a] rounded-3xl p-4 relative overflow-hidden border border-white/10 shadow-[0_24px_48px_rgba(15,23,42,0.35)]">
            <div className="flex items-center gap-1 mb-2 relative z-10">
              <span className="text-white font-bold text-sm">
                Cash Balance
              </span>
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#60a5fa] cursor-pointer ${isRefreshing ? "animate-spin" : ""}`}
                onClick={handleRefresh}
              />
            </div>
            <div className="flex items-end gap-1 relative z-10">
              <span className="text-[#93c5fd] font-bold text-sm">Rs</span>
              <span className="text-[#93c5fd] font-bold text-2xl leading-none">
                {typeof balance === "number" ? balance.toFixed(2) : "0.00"}
              </span>
            </div>
            <div className="absolute -bottom-4 -left-4 opacity-10">
              <svg
                width="80"
                height="80"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
              </svg>
            </div>
          </div>

          <div className="flex-1 bg-[#0f172a] rounded-3xl p-4 relative overflow-hidden border border-white/10 shadow-[0_24px_48px_rgba(15,23,42,0.35)]">
            <div className="flex items-center gap-1 mb-2 relative z-10">
              <span className="text-white font-bold text-sm">
                Withdrawable
              </span>
            </div>
            <div className="flex items-end gap-1 relative z-10">
              <span className="text-[#93c5fd] font-bold text-sm">Rs</span>
              <span className="text-[#93c5fd] font-bold text-2xl leading-none">
                {typeof balance === "number" ? balance.toFixed(2) : "0.00"}
              </span>
            </div>
            <div className="absolute -bottom-4 -left-4 opacity-10">
              <svg
                width="80"
                height="80"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Deposit Amount Input */}
        <div className="flex flex-col gap-2 mt-6">
          <span className="text-gray-400 text-sm">
            Deposit amount: Min: Rs300 Max: Rs50,000
          </span>
          <div className="bg-[#0f172a] rounded-3xl border border-white/10 flex items-center p-3 shadow-[0_8px_24px_rgba(15,23,42,0.35)]">
            <span className="text-[#93c5fd] font-bold text-lg mr-2 border-r border-white/10 pr-2">
              Rs
            </span>
            <input
              type="number"
              value={amount}
              onChange={handleAmountChange}
              className="flex-1 outline-none text-[#93c5fd] font-bold text-lg bg-transparent"
            />
            {amount && (
              <X
                className="w-5 h-5 text-gray-400 cursor-pointer border border-white/10 rounded-full p-0.5"
                onClick={() => {
                  setAmount("");
                  setSelectedAmount(null);
                }}
              />
            )}
          </div>
          <div className="text-sm text-gray-300">
            <span className="text-[#60a5fa] font-bold">Rs{amount || "0"}</span>
            <span className="text-gray-300"> + Bonus </span>
            <span className="text-[#60a5fa] font-bold">Rs{currentBonus}</span>
          </div>

          {/* Bonus note */}
          <div className="text-xs text-green-300 mt-1">
            Get 2% Bonus on all deposits! {amount && !isNaN(Number(amount)) && (
              <span>Deposit {Number(amount).toLocaleString()} → Get {(Number(amount) * 1.02).toLocaleString()}</span>
            )}
          </div>
        </div>

        {/* Quick Amounts */}
        <div className="grid grid-cols-4 gap-2">
          {(selectedPaymentMethod === 'easypaisa' ? quickAmounts.filter(q => EASY_PAISA_LINKS[q.value]) : quickAmounts).map((q) => {
            const isSelected = selectedAmount === q.value;
            return (
              <button
                key={q.value}
                onClick={() => handleAmountSelect(q.value)}
                type="button"
                className={`relative py-3 rounded-xl font-bold text-sm transition-all shadow-sm flex flex-col items-center justify-center ${isSelected ? "bg-[#2563eb] text-white shadow-[#2563eb]/30" : "bg-[#0f172a] text-gray-300 border border-white/10"}`}
              >
                <div
                  className={`absolute -top-2 -right-2 text-[10px] px-1.5 py-0.5 rounded-tl-lg rounded-br-lg font-bold ${isSelected ? "bg-[#93c5fd] text-slate-900" : "bg-[#2563eb] text-white"}`}
                >
                  +{q.bonus}
                </div>
                Rs{q.value.toLocaleString()}
              </button>
            );
          })}
        </div>

        {/* Payment Methods - Jazzcash & Easypaisa Only (USDT removed) */}
        <div className="mt-6">
          <div className="flex items-center gap-1 mb-3">
            <span className="text-white text-sm">Payment methods</span>
            <span className="text-[#ff4757] text-sm">*</span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <div
              onClick={() => setSelectedPaymentMethod("jazzcash")}
              className={`flex-shrink-0 relative flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedPaymentMethod === "jazzcash" ? "border-[#2563eb] bg-[#111827] shadow-sm" : "border-transparent bg-[#111827] shadow-sm opacity-80"}`}
            >
              <div className="absolute -top-1 -left-1 bg-[#ff4757] text-white text-[10px] w-7 h-5 rounded-full flex items-center justify-center font-bold">
                👍
              </div>
              <div className="absolute -top-0 -right-0 bg-[#4a85f6] text-white text-[10px] px-1.5 py-0.3 rounded-tl-lg rounded-br-lg font-bold">
                +2%
              </div>
              <div className="flex items-center gap-2">
                <div className="w-12 h-12 flex items-center justify-center">
                  <img
                    src="/assets/svg/Jazzcash.webp"
                    alt="Jazzcash"
                    className="w-12 h-12 object-contain"
                  />
                </div>
                <span
                  className="font-bold text-sm text-white"
                >
                  Jazzcash
                </span>
              </div>
              {selectedPaymentMethod === "jazzcash" && (
                <div className="absolute -bottom-0 -right-0 bg-[#ffc107] rounded-tl-lg rounded-br-sm w-4 h-4 flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </div>

            <div
              onClick={() => setSelectedPaymentMethod("easypaisa")}
              className={`flex-shrink-0 relative flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedPaymentMethod === "easypaisa" ? "border-[#2563eb] bg-[#111827] shadow-sm" : "border-transparent bg-[#111827] shadow-sm opacity-80"}`}
            >
              <div className="absolute -top-2 -right-2 bg-[#4a85f6] text-white text-[10px] px-1.5 py-0.5 rounded-tl-lg rounded-br-lg font-bold">
                +2%
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 flex items-center justify-center">
                  <img
                    src="/assets/svg/Easypaisa.webp"
                    alt="Easypaisa"
                    className="w-8 h-8 object-contain"
                  />
                </div>
                <span
                  className="font-bold text-sm text-white"
                >
                  Easypaisa
                </span>
              </div>
              {selectedPaymentMethod === "easypaisa" && (
                <div className="absolute -bottom-0 -right-0 bg-[#ffc107] rounded-tl-lg rounded-br-sm w-4 h-4 flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Deposit Tips */}
        <div className="mt-6 text-sm text-gray-300 space-y-3 font-medium">
          <p className="text-white font-bold mb-1">Deposit tips:</p>
          <p>1.Each deposit will be credited within 1-5 minutes</p>
          <p>
            2.After the payment is successful, please return to the WinClub
            deposit page to check your account balance.
          </p>
          <p>
            3.If your deposit does not arrive within 30 minutes, please contact
            customer service for help.
          </p>

          <p className="text-white font-bold mt-4 mb-1">Important notes:</p>
          <p>
            Please do not modify the payment amount. Avoid reusing saved QR
            codes or UPI accounts for multiple payments.
          </p>
        </div>
      </div>

{/* Pay Now Button - Fixed Center (Non-Scrollable) with Neon Blue Glow */}
<div className="fixed bottom-[74px] left-0 right-0 z-40 px-4 max-w-md mx-auto pointer-events-none">
  <div className="w-full flex justify-center pointer-events-auto">
    <button
      onClick={handlePayNow}
      type="button"
      disabled={!isAmountSupported}
      className={`w-11/12 max-w-xs text-white font-bold text-base py-3 rounded-full transition-all duration-300 active:scale-[0.97] border ${
        isAmountSupported 
          ? 'bg-[#1C2DFF] hover:bg-[#2563eb] border-blue-400/40 shadow-[0_0_18px_rgba(28,45,255,0.6)] hover:shadow-[0_0_25px_rgba(37,99,235,0.8)] cursor-pointer' 
          : 'bg-slate-800/90 border-white/5 opacity-50 cursor-not-allowed' 
      }`}
    >
      Pay with {selectedPaymentMethod === "easypaisa" ? "Easypaisa" : "Jazzcash"}
    </button>
  </div>
</div>
    </div>
  );
}