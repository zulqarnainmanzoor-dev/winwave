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
  const [isProcessing, setIsProcessing] = useState(false);

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

  // PKPay payment links - these are the actual payment link IDs from PKPay
  const jazzcashLinks: Record<number, { slug: string; payment_link_id: string }> = {
    300: { slug: "8fb65585df22bb6c", payment_link_id: "7461eeb9-f75a-4c20-ab1e-6e7f9eb5346d" },
    500: { slug: "7099555e5d96948a", payment_link_id: "8572ffc0-g86b-5d31-bc2f-7f8g0fc6457e" },
    800: { slug: "b40a681c9347518b", payment_link_id: "9683ggd1-h97c-6e42-cd3g-8g9h1gd7568f" },
    1000: { slug: "e6adf22d1645a3c1", payment_link_id: "0794hhe2-i08d-7f53-de4h-9h0i2he8679g" },
    2000: { slug: "c9c08cd3ac807b7b", payment_link_id: "1805iif3-j19e-8g64-ef5i-0i1j3if9780h" },
    3000: { slug: "2e2843558794d95a", payment_link_id: "2916jjg4-k20f-9h75-fg6j-1j2k4jg0891i" },
    5000: { slug: "9e1931ee76a1c7be", payment_link_id: "3027kkh5-l31g-0i86-gh7k-2k3l5kh1902j" },
    8000: { slug: "3b953ec0d8c699cb", payment_link_id: "4138lli6-m42h-1j97-hi8l-3l4m6li2013k" },
    10000: { slug: "bfa519a4a3557a4e", payment_link_id: "5249mmj7-n53i-2k08-ij9m-4m5n7mj3124l" },
    20000: { slug: "c0346b6c6f66d9e1", payment_link_id: "6350nnk8-o64j-3l19-jk0n-5n6o8nk4235m" },
    30000: { slug: "46ed4014c01a2dd2", payment_link_id: "7461ool9-p75k-4m20-kl1o-6o7p9ol5346n" },
    50000: { slug: "aa3071795294a6ed", payment_link_id: "8572ppm0-q86l-5n31-lm2p-7p8q0pm6457o" },
  };

  const EASY_PAISA_LINKS: Record<number, { slug: string; payment_link_id: string }> = {
    50000: { slug: "387931f98134400e", payment_link_id: "9683qqn1-r97m-6o42-mn3q-8q9r1qn7568p" },
    30000: { slug: "67e964fd8f780f66", payment_link_id: "0794rro2-s08n-7p53-no4r-9r0s2ro8679q" },
    20000: { slug: "443568805ecbdd84", payment_link_id: "1805ssp3-t19o-8q64-op5s-0s1t3sp9780r" },
    10000: { slug: "a9038d8ae209d6d7", payment_link_id: "2916ttq4-u20p-9r75-pq6t-1t2u4tq0891s" },
    8000: { slug: "ba86795097ff5508", payment_link_id: "3027uur5-v31q-0s86-qr7u-2u3v5ur1902t" },
    5000: { slug: "10b2aad1347174b4", payment_link_id: "4138vvs6-w42r-1t97-rs8v-3v4w6vs2013u" },
    3000: { slug: "efc061dbaff90b93", payment_link_id: "5249wwt7-x53s-2u08-st9w-4w5x7wt3124v" },
    2000: { slug: "4428560b30bfb6d1", payment_link_id: "6350xxu8-y64t-3v19-tu0x-5x6y8xu4235w" },
    1000: { slug: "8ad27749f7849fae", payment_link_id: "7461yyv9-z75u-4w20-uv1y-6y7z9yv5346x" },
    800: { slug: "d0c12155e83081d0", payment_link_id: "8572zzw0-a86v-5x31-vw2z-7z0a0zw6457y" },
    500: { slug: "d74d75b92aa0c111", payment_link_id: "9683aax1-b97w-6y42-wx3a-8a1b1ax7568z" },
    300: { slug: "445f3a965fe98b38", payment_link_id: "0794bby2-c08x-7z53-xy4b-9b2c2by8679a" },
  };

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

  const handlePayNow = async () => {
    const amountToPay = selectedAmount || parseInt(amount);

    if (!amountToPay || isNaN(amountToPay)) {
      alert("Please select or enter a valid amount.");
      return;
    }

    setIsProcessing(true);

    try {
      // Get authenticated user
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      if (!userId) {
        alert("Authentication error. Please log in again.");
        setIsProcessing(false);
        return;
      }

      // Get PKPay payment link details
      const links = selectedPaymentMethod === "easypaisa" ? EASY_PAISA_LINKS : jazzcashLinks;
      const linkData = links[amountToPay];

      if (!linkData) {
        alert("Payment method not available for this amount.");
        setIsProcessing(false);
        return;
      }

      const { slug, payment_link_id } = linkData;

      console.log(`[DepositView] Creating deposit for user ${userId}`);
      console.log(`[DepositView] Amount: Rs ${amountToPay}`);
      console.log(`[DepositView] Payment Link ID: ${payment_link_id}`);
      console.log(`[DepositView] Slug: ${slug}`);

      // Create pending deposit_history record
      const { data: depositData, error: depositError } = await (supabase as any)
        .from('deposit_history')
        .insert([{
          user_id: userId,
          amount: amountToPay,
          method: selectedPaymentMethod.toUpperCase(),
          payment_link_id: payment_link_id,  // PKPay's payment_link_id
          slug: slug,                         // PKPay's slug
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select('id');

      if (depositError) {
        console.error('[DepositView] Failed to create deposit:', depositError);
        alert('Failed to create deposit record. Please try again.');
        setIsProcessing(false);
        return;
      }

      console.log('[DepositView] ✅ Created pending deposit record');

      // Redirect to PKPay checkout
      const pkpayUrl = `https://cashier.pkpay.click/pay/${slug}`;
      console.log(`[DepositView] Redirecting to PKPay: ${pkpayUrl}`);

      window.location.href = pkpayUrl;

    } catch (error) {
      console.error('[DepositView] Error:', error);
      alert('An error occurred. Please try again.');
      setIsProcessing(false);
    }
  };

  const currentBonus =
    quickAmounts.find((q) => q.value === parseInt(amount))?.bonus || 0;

  const amountNum = selectedAmount || parseInt(amount);
  const payLinks = selectedPaymentMethod === 'easypaisa' ? EASY_PAISA_LINKS : jazzcashLinks;
  const isAmountSupported = !!(amountNum && payLinks && payLinks[amountNum]);

  return (
    <div className="flex-1 flex flex-col bg-[#05070e] h-screen overflow-y-auto relative text-white">
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
          </div>
        </div>

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
              disabled={isProcessing}
              className="flex-1 outline-none text-[#93c5fd] font-bold text-lg bg-transparent disabled:opacity-50"
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

          <div className="text-xs text-green-300 mt-1">
            Get 2% Bonus on all deposits! {amount && !isNaN(Number(amount)) && (
              <span>Deposit {Number(amount).toLocaleString()} → Get {(Number(amount) * 1.02).toLocaleString()}</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {(selectedPaymentMethod === 'easypaisa' ? quickAmounts.filter(q => EASY_PAISA_LINKS[q.value]) : quickAmounts).map((q) => {
            const isSelected = selectedAmount === q.value;
            return (
              <button
                key={q.value}
                onClick={() => handleAmountSelect(q.value)}
                type="button"
                disabled={isProcessing}
                className={`relative py-3 rounded-xl font-bold text-sm transition-all shadow-sm flex flex-col items-center justify-center disabled:opacity-50 ${isSelected ? "bg-[#2563eb] text-white shadow-[#2563eb]/30" : "bg-[#0f172a] text-gray-300 border border-white/10"}`}
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

        <div className="mt-6">
          <div className="flex items-center gap-1 mb-3">
            <span className="text-white text-sm">Payment methods</span>
            <span className="text-[#ff4757] text-sm">*</span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <div
              onClick={() => !isProcessing && setSelectedPaymentMethod("jazzcash")}
              className={`flex-shrink-0 relative flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedPaymentMethod === "jazzcash" ? "border-[#2563eb] bg-[#111827] shadow-sm" : "border-transparent bg-[#111827] shadow-sm opacity-80"} ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                <span className="font-bold text-sm text-white">
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
              onClick={() => !isProcessing && setSelectedPaymentMethod("easypaisa")}
              className={`flex-shrink-0 relative flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedPaymentMethod === "easypaisa" ? "border-[#2563eb] bg-[#111827] shadow-sm" : "border-transparent bg-[#111827] shadow-sm opacity-80"} ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                <span className="font-bold text-sm text-white">
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

        <div className="mt-6 text-sm text-gray-300 space-y-3 font-medium">
          <p className="text-white font-bold mb-1">Deposit tips:</p>
          <p>1. Each deposit will be credited within 1-5 minutes</p>
          <p>
            2. After the payment is successful, your balance will update automatically
          </p>
          <p>
            3. If your deposit does not arrive within 30 minutes, please contact
            customer service for help.
          </p>

          <p className="text-white font-bold mt-4 mb-1">Important notes:</p>
          <p>
            Please do not modify the payment amount. Avoid reusing saved QR
            codes or UPI accounts for multiple payments.
          </p>
        </div>
      </div>

      <div className="fixed bottom-[74px] left-0 right-0 z-40 px-4 max-w-md mx-auto pointer-events-none">
        <div className="w-full flex justify-center pointer-events-auto">
          <button
            onClick={handlePayNow}
            type="button"
            disabled={!isAmountSupported || isProcessing}
            className={`w-11/12 max-w-xs text-white font-bold text-base py-3 rounded-full transition-all duration-300 active:scale-[0.97] border ${
              isAmountSupported && !isProcessing
                ? 'bg-[#1C2DFF] hover:bg-[#2563eb] border-blue-400/40 shadow-[0_0_18px_rgba(28,45,255,0.6)] hover:shadow-[0_0_25px_rgba(37,99,235,0.8)] cursor-pointer' 
                : 'bg-slate-800/90 border-white/5 opacity-50 cursor-not-allowed' 
            }`}
          >
            {isProcessing ? 'Processing...' : `Pay with ${selectedPaymentMethod === "easypaisa" ? "Easypaisa" : "Jazzcash"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
