import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle, AlertCircle, Loader } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useUser } from "../context/UserContext";

export default function DepositReturnPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { uid, refreshUserData } = useUser();
  
  const [status, setStatus] = useState<"loading" | "success" | "pending" | "error">("loading");
  const [message, setMessage] = useState("Verifying your deposit...");
  const orderId = searchParams.get("order_id");

  useEffect(() => {
    const verifyDeposit = async () => {
      if (!uid || !orderId) {
        setStatus("error");
        setMessage("Invalid deposit information. Please try again.");
        setTimeout(() => navigate("/"), 3000);
        return;
      }

      try {
        console.log(`[DepositReturnPage] Verifying deposit: order_id=${orderId}, user_id=${uid}`);

        // Check deposit status
        const { data: deposit, error: depositError } = await supabase
          .from("deposit_history")
          .select("id, status, amount, method")
          .eq("order_id", orderId)
          .eq("user_id", uid)
          .maybeSingle();

        if (depositError) {
          console.error("[DepositReturnPage] Error checking deposit:", depositError);
          setStatus("error");
          setMessage("Error verifying deposit. Please contact support.");
          return;
        }

        if (!deposit) {
          console.error("[DepositReturnPage] Deposit record not found");
          setStatus("error");
          setMessage("Deposit record not found. Please contact support.");
          return;
        }

        console.log(`[DepositReturnPage] Deposit found: status=${deposit.status}, amount=${deposit.amount}`);

        if (deposit.status === "completed") {
          console.log("[DepositReturnPage] Deposit already completed");
          setStatus("success");
          setMessage(`Deposit of Rs ${deposit.amount} completed successfully! Your balance has been credited.`);
          
          // Refresh user data to show updated balance
          if (refreshUserData) {
            await refreshUserData();
          }
          
          setTimeout(() => navigate("/"), 3000);
          return;
        }

        if (deposit.status === "pending") {
          console.log("[DepositReturnPage] Deposit still pending - calling manual verification endpoint");
          
          // Call manual verification endpoint to check with PKPay
          const verifyResponse = await fetch("/api/verify-deposit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order_id: orderId, user_id: uid }),
          });

          const verifyData = await verifyResponse.json();
          console.log("[DepositReturnPage] Verification response:", verifyData);

          if (verifyData.verified || verifyData.status === "completed") {
            console.log("[DepositReturnPage] Deposit verified and completed");
            setStatus("success");
            setMessage(`Deposit of Rs ${deposit.amount} completed successfully! Your balance has been credited.`);
            
            if (refreshUserData) {
              await refreshUserData();
            }
            
            setTimeout(() => navigate("/"), 3000);
          } else {
            console.log("[DepositReturnPage] Deposit still processing");
            setStatus("pending");
            setMessage(`Your deposit of Rs ${deposit.amount} is being processed. You will receive your balance within 5 minutes.`);
            
            setTimeout(() => navigate("/"), 5000);
          }
          return;
        }

        if (deposit.status === "failed") {
          console.error("[DepositReturnPage] Deposit failed");
          setStatus("error");
          setMessage("Your deposit failed. Please try again or contact support.");
          setTimeout(() => navigate("/"), 3000);
          return;
        }

      } catch (error) {
        console.error("[DepositReturnPage] Exception:", error);
        setStatus("error");
        setMessage("An error occurred. Please try again.");
        setTimeout(() => navigate("/"), 3000);
      }
    };

    verifyDeposit();
  }, [uid, orderId, navigate, refreshUserData]);

  return (
    <div className="flex-1 flex flex-col bg-[#05070e] h-screen items-center justify-center text-white p-4">
      <div className="max-w-md w-full bg-[#0f172a] rounded-3xl border border-white/10 p-8 text-center space-y-4">
        {status === "loading" && (
          <>
            <Loader className="w-12 h-12 text-[#60a5fa] mx-auto animate-spin" />
            <h2 className="text-xl font-bold">Verifying Deposit</h2>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
            <h2 className="text-xl font-bold text-emerald-400">Success!</h2>
          </>
        )}

        {status === "pending" && (
          <>
            <AlertCircle className="w-12 h-12 text-amber-400 mx-auto animate-pulse" />
            <h2 className="text-xl font-bold text-amber-400">Processing</h2>
          </>
        )}

        {status === "error" && (
          <>
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
            <h2 className="text-xl font-bold text-red-400">Error</h2>
          </>
        )}

        <p className="text-gray-300 text-sm">{message}</p>
        <p className="text-gray-500 text-xs">Redirecting in a few seconds...</p>
      </div>
    </div>
  );
}
