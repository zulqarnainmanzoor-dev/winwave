import { useState } from "react";
import {
  ChevronLeft,
  HeadphonesIcon,
  FileClock,
  RefreshCw,
  X,
  Check,
} from "lucide-react";
import { useUser } from "../context/UserContext";
import { useLanguage } from "../context/LanguageContext";

export default function DepositView({
  onBack,
  onTransactionClick,
}: {
  onBack: () => void;
  onTransactionClick: () => void;
}) {
  const { balance, selectedPaymentMethod, setSelectedPaymentMethod } = useUser();
  const { t } = useLanguage();
  const [amount, setAmount] = useState<string>("300");
  const [selectedAmount, setSelectedAmount] = useState<number | null>(300);
  const [isRefreshing, setIsRefreshing] = useState(false);


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

  const handleRefresh = () => {
    setIsRefreshing(true);
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

  const currentBonus =
    quickAmounts.find((q) => q.value === parseInt(amount))?.bonus || 0;

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
                {balance.toFixed(2)}
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
                {balance.toFixed(2)}
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
        </div>

        {/* Quick Amounts */}
          <div className="grid grid-cols-4 gap-2">
            {quickAmounts.map((q) => {
              const isSelected = selectedAmount === q.value;
              return (
                <button
                  key={q.value}
                  onClick={() => handleAmountSelect(q.value)}
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

        {/* Payment Methods */}
        <div className="mt-6">
          <div className="flex items-center gap-1 mb-3">
            <span className="text-gray-800 text-sm">Payment methods</span>
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
                  className={`font-bold text-sm ${selectedPaymentMethod === "jazzcash" ? "text-gray-800" : "text-gray-400"}`}
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
                  className={`font-bold text-sm ${selectedPaymentMethod === "easypaisa" ? "text-gray-800" : "text-gray-400"}`}
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

            <div
              onClick={() => setSelectedPaymentMethod("usdt")}
              className={`flex-shrink-0 relative flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedPaymentMethod === "usdt" ? "border-[#2563eb] bg-[#111827] shadow-sm" : "border-transparent bg-[#111827] shadow-sm opacity-80"}`}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 flex items-center justify-center">
                  <img
                    src="/assets/svg/USDT.webp"
                    alt="USDT"
                    className="w-8 h-8 object-contain"
                  />
                </div>
                <span
                  className={`font-bold text-sm ${selectedPaymentMethod === "usdt" ? "text-gray-800" : "text-gray-400"}`}
                >
                  USDT
                </span>
              </div>
              {selectedPaymentMethod === "usdt" && (
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
            2.After the payment is successful, please return to the POPZAR
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

      {/* Pay Now Button */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-[#08101f] backdrop-blur-sm z-50 border-t border-white/10">
        <button className="w-full bg-[#2563eb] text-white font-bold text-lg py-3.5 rounded-full shadow-lg shadow-[#2563eb]/30 hover:bg-[#1d4ed8] transition-all">
          Pay now
        </button>
      </div>
    </div>
  );
}

