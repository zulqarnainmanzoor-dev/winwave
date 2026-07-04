import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle, ArrowRight, Home, TrendingUp } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

interface DepositDetails {
  amount: number;
  bonus: number;
  total: number;
  newBalance: number;
  transactionId: string;
  timestamp: string;
}

export default function DepositSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [details, setDetails] = useState<DepositDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDepositDetails = async () => {
      try {
        const txId = searchParams.get("tx");
        const amount = searchParams.get("amount");
        const bonus = searchParams.get("bonus");
        const total = searchParams.get("total");
        const balance = searchParams.get("balance");

        if (!txId) {
          setError("Invalid transaction reference");
          setLoading(false);
          return;
        }

        // If we have all params in URL, use them directly
        if (amount && bonus && total && balance) {
          setDetails({
            amount: Number(amount),
            bonus: Number(bonus),
            total: Number(total),
            newBalance: Number(balance),
            transactionId: txId,
            timestamp: new Date().toISOString(),
          });
          setLoading(false);
          return;
        }

        // Otherwise, fetch from database using transaction ID
        const { data: transaction, error: txError } = await supabase
          .from("transactions")
          .select("*")
          .eq("gateway_ref", `pkpay:${txId}`)
          .eq("type", "deposit")
          .eq("status", "completed")
          .maybeSingle();

        if (txError || !transaction) {
          // Try deposit_history if transaction not found
          const { data: deposit, error: depError } = await supabase
            .from("deposit_history")
            .select("*")
            .eq("gateway_ref", `pkpay:${txId}`)
            .eq("status", "completed")
            .maybeSingle();

          if (depError || !deposit) {
            setError("Transaction not found");
            setLoading(false);
            return;
          }

          // Fetch user balance
          const { data: user } = await supabase
            .from("users")
            .select("main_balance")
            .eq("id", (deposit as any).user_id)
            .single();

          const bonusAmount = Number((deposit as any).amount) * 0.02;
          setDetails({
            amount: Number((deposit as any).amount),
            bonus: bonusAmount,
            total: Number((deposit as any).amount) + bonusAmount,
            newBalance: Number(user?.main_balance || 0),
            transactionId: txId,
            timestamp: (deposit as any).created_at || (deposit as any).updated_at || new Date().toISOString(),
          });
        } else {
          const bonusAmount = Number(transaction.bonus || 0);
          setDetails({
            amount: Number(transaction.amount),
            bonus: bonusAmount,
            total: Number(transaction.amount) + bonusAmount,
            newBalance: Number(balance || 0),
            transactionId: txId,
            timestamp: transaction.created_at || new Date().toISOString(),
          });
        }

        setLoading(false);
      } catch (err) {
        console.error("Error fetching deposit details:", err);
        setError("Failed to load transaction details");
        setLoading(false);
      }
    };

    fetchDepositDetails();
  }, [searchParams]);

  const formatCurrency = (amount: number) => {
    return `Rs ${amount.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center p-4">
        <div className="bg-[#1C1C1E] border border-white/5 rounded-3xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">⚠️</span>
          </div>
          <h1 className="text-2xl font-black text-white mb-2">Oops!</h1>
          <p className="text-gray-400 mb-6">{error || "Something went wrong"}</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:brightness-110 active:scale-[0.98] transition-all rounded-full font-black text-sm tracking-widest text-black shadow-[0_6px_20px_rgba(249,115,22,0.25)] flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center p-4">
      <div className="bg-[#1C1C1E] border border-white/5 rounded-3xl p-8 max-w-md w-full shadow-[0_12px_24px_rgba(0,0,0,0.6)]">
        {/* Success Icon */}
        <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 relative">
          <CheckCircle className="w-12 h-12 text-green-500" />
          <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping" />
        </div>

        {/* Success Message */}
        <h1 className="text-3xl font-black text-white text-center mb-2">Deposit Successful!</h1>
        <p className="text-gray-400 text-center text-sm mb-8">
          Your deposit has been processed successfully
        </p>

        {/* Transaction Details Card */}
        <div className="bg-[#0A0A0B] border border-white/5 rounded-2xl p-6 space-y-4 mb-6">
          {/* Deposit Amount */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">Deposit Amount</span>
            <span className="text-lg font-black text-white">{formatCurrency(details.amount)}</span>
          </div>

          {/* Bonus */}
          <div className="flex justify-between items-center border-t border-white/5 pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#ffa502]" />
              <span className="text-sm text-gray-400">2% Bonus</span>
            </div>
            <span className="text-lg font-black text-[#ffa502]">+{formatCurrency(details.bonus)}</span>
          </div>

          {/* Total */}
          <div className="flex justify-between items-center border-t border-white/5 pt-4">
            <span className="text-sm font-bold text-gray-300">Total Credited</span>
            <span className="text-xl font-black text-green-400">{formatCurrency(details.total)}</span>
          </div>

          {/* New Balance */}
          <div className="flex justify-between items-center border-t border-white/5 pt-4">
            <span className="text-sm font-bold text-gray-300">New Balance</span>
            <span className="text-xl font-black text-white">{formatCurrency(details.newBalance)}</span>
          </div>

          {/* Transaction ID */}
          <div className="border-t border-white/5 pt-4">
            <span className="text-xs text-gray-500 block mb-1">Transaction ID</span>
            <span className="text-xs font-mono text-gray-400 break-all">{details.transactionId}</span>
          </div>

          {/* Timestamp */}
          <div className="border-t border-white/5 pt-4">
            <span className="text-xs text-gray-500 block mb-1">Date & Time</span>
            <span className="text-xs text-gray-400">{formatDate(details.timestamp)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:brightness-110 active:scale-[0.98] transition-all rounded-full font-black text-sm tracking-widest text-black shadow-[0_6px_20px_rgba(249,115,22,0.25)] flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            Go to Dashboard
          </button>

          <button
            onClick={() => navigate("/games")}
            className="w-full py-3.5 bg-[#2C2C2E] border border-white/5 hover:border-orange-500/30 transition-all rounded-full font-black text-sm tracking-widest text-white flex items-center justify-center gap-2"
          >
            <TrendingUp className="w-4 h-4" />
            Start Betting
          </button>
        </div>

        {/* Footer Note */}
        <p className="text-xs text-gray-500 text-center mt-6">
          A confirmation has been sent to your account
        </p>
      </div>
    </div>
  );
}