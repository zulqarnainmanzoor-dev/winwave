import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronDown, Copy, Check, AlertCircle } from "lucide-react";
import { adminSupabase } from "../lib/adminSupabase";

interface WithdrawalRequest {
  id: string;
  user_id: string;
  amount: number;
  method: string;
  order_id: string | null;
  merchant_order_id: string | null;
  gateway_ref: string | null;
  pkpay_transaction_id: string | null;
  callback_status: string | null;
  callback_time: string | null;
  gateway_response: any;
  payment_gateway: string | null;
  account_name: string | null;
  account_no: string | null;
  bank_name: string | null;
  status: string;
  remarks: string | null;
  created_at: string;
  user?: {
    phone_number: string | null;
    referral_code: string | null;
  };
}

export default function WithdrawalRequestDetails({
  withdrawalId,
  onBack,
}: {
  withdrawalId: string;
  onBack: () => void;
}) {
  const [withdrawal, setWithdrawal] = useState<WithdrawalRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedJson, setExpandedJson] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    const fetchWithdrawal = async () => {
      try {
        const { data, error: fetchError } = await adminSupabase
          .from("withdrawal_history")
          .select(
            `
            id, user_id, amount, method, order_id, merchant_order_id, gateway_ref,
            pkpay_transaction_id, callback_status, callback_time, gateway_response,
            payment_gateway, account_name, account_no, bank_name, status, remarks, created_at,
            users:user_id(phone_number, referral_code)
          `
          )
          .eq("id", withdrawalId)
          .single();

        if (fetchError) throw fetchError;
        setWithdrawal(data as WithdrawalRequest);
      } catch (err: any) {
        setError(err?.message || "Failed to load withdrawal details");
      } finally {
        setLoading(false);
      }
    };

    fetchWithdrawal();
  }, [withdrawalId]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-PK", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const DetailField = ({
    label,
    value,
    copyable = false,
  }: {
    label: string;
    value: string | number | null | undefined;
    copyable?: boolean;
  }) => (
    <div className="flex items-center justify-between py-3 px-4 border-b border-white/5 last:border-b-0">
      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-mono text-white text-right">
          {value || "—"}
        </span>
        {copyable && value && (
          <button
            onClick={() => copyToClipboard(String(value), label)}
            className="p-1 hover:bg-white/10 rounded transition-colors"
          >
            {copiedField === label ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <Copy className="w-4 h-4 text-gray-500 hover:text-white" />
            )}
          </button>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex-1 flex flex-col bg-[#0A0A0B] min-h-screen">
        <div className="h-12 bg-[#161618] flex items-center px-4 border-b border-white/5">
          <button
            onClick={onBack}
            className="p-1 hover:bg-white/10 rounded-full text-gray-400 hover:text-white"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-white text-base font-black tracking-widest flex-1 text-center pr-9 uppercase">
            Withdrawal Details
          </h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !withdrawal) {
    return (
      <div className="flex-1 flex flex-col bg-[#0A0A0B] min-h-screen">
        <div className="h-12 bg-[#161618] flex items-center px-4 border-b border-white/5">
          <button
            onClick={onBack}
            className="p-1 hover:bg-white/10 rounded-full text-gray-400 hover:text-white"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-white text-base font-black tracking-widest flex-1 text-center pr-9 uppercase">
            Withdrawal Details
          </h1>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <p className="text-sm text-gray-400">
              {error || "Withdrawal not found"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const userPhone = withdrawal.user?.[0]?.phone_number || "—";
  const userUid = withdrawal.user?.[0]?.referral_code || "—";
  const statusColor =
    withdrawal.status === "completed"
      ? "text-green-400"
      : withdrawal.status === "pending"
        ? "text-yellow-400"
        : withdrawal.status === "processing"
          ? "text-blue-400"
          : "text-red-400";

  return (
    <div className="flex-1 flex flex-col bg-[#0A0A0B] min-h-screen text-gray-200 pb-[90px]">
      {/* Header */}
      <div className="h-12 bg-[#161618] flex items-center px-4 border-b border-white/5 sticky top-0 z-20">
        <button
          onClick={onBack}
          className="p-1 hover:bg-white/10 rounded-full text-gray-400 hover:text-white"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-white text-base font-black tracking-widest flex-1 text-center pr-9 uppercase">
          Withdrawal Request Details
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Status Badge */}
        <div className="bg-[#1C1C1E] border border-white/5 rounded-2xl p-4 flex items-center justify-between">
          <span className="text-xs font-bold text-gray-400 uppercase">Status</span>
          <span className={`text-sm font-black uppercase ${statusColor}`}>
            {withdrawal.status}
          </span>
        </div>

        {/* User Information Section */}
        <div className="bg-[#1C1C1E] border border-white/5 rounded-2xl overflow-hidden">
          <div className="bg-[#252528] px-4 py-3 border-b border-white/5">
            <h2 className="text-xs font-black text-white uppercase tracking-wider">
              User Information
            </h2>
          </div>
          <DetailField label="UID" value={userUid} copyable />
          <DetailField label="Phone" value={userPhone} copyable />
          <DetailField label="User ID" value={withdrawal.user_id} copyable />
        </div>

        {/* Withdrawal Amount Section */}
        <div className="bg-[#1C1C1E] border border-white/5 rounded-2xl overflow-hidden">
          <div className="bg-[#252528] px-4 py-3 border-b border-white/5">
            <h2 className="text-xs font-black text-white uppercase tracking-wider">
              Withdrawal Amount
            </h2>
          </div>
          <DetailField
            label="Amount"
            value={`Rs ${Number(withdrawal.amount).toLocaleString("en-PK", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}
          />
          <DetailField label="Method" value={withdrawal.method} />
          <DetailField label="Date" value={formatDate(withdrawal.created_at)} />
        </div>

        {/* User Withdrawal Information Section */}
        <div className="bg-[#1C1C1E] border border-white/5 rounded-2xl overflow-hidden">
          <div className="bg-[#252528] px-4 py-3 border-b border-white/5">
            <h2 className="text-xs font-black text-white uppercase tracking-wider">
              User Withdrawal Information
            </h2>
          </div>
          <DetailField label="Account Name" value={withdrawal.account_name} />
          <DetailField label="Account Number" value={withdrawal.account_no} />
          <DetailField label="Bank / Wallet Name" value={withdrawal.bank_name} />
        </div>

        {/* Payout Information Section */}
        <div className="bg-[#1C1C1E] border border-white/5 rounded-2xl overflow-hidden">
          <div className="bg-[#252528] px-4 py-3 border-b border-white/5">
            <h2 className="text-xs font-black text-white uppercase tracking-wider">
              Payout Information
            </h2>
          </div>
          <DetailField
            label="Payout Order ID"
            value={withdrawal.order_id}
            copyable
          />
          <DetailField
            label="Merchant Order ID"
            value={withdrawal.merchant_order_id}
            copyable
          />
          <DetailField
            label="PKPay Payout Transaction ID"
            value={withdrawal.pkpay_transaction_id}
            copyable
          />
          <DetailField
            label="Gateway Reference"
            value={withdrawal.gateway_ref}
            copyable
          />
          <DetailField label="Payment Gateway" value={withdrawal.payment_gateway} />
          <DetailField
            label="Callback Status"
            value={withdrawal.callback_status}
          />
          {withdrawal.callback_time && (
            <DetailField
              label="Callback Time"
              value={formatDate(withdrawal.callback_time)}
            />
          )}
        </div>

        {/* Gateway Response Section */}
        {withdrawal.gateway_response && (
          <div className="bg-[#1C1C1E] border border-white/5 rounded-2xl overflow-hidden">
            <button
              onClick={() => setExpandedJson(!expandedJson)}
              className="w-full flex items-center justify-between px-4 py-3 bg-[#252528] border-b border-white/5 hover:bg-[#2C2C2E] transition-colors"
            >
              <h2 className="text-xs font-black text-white uppercase tracking-wider">
                Gateway Response
              </h2>
              <ChevronDown
                className={`w-4 h-4 text-gray-500 transition-transform ${
                  expandedJson ? "rotate-180" : ""
                }`}
              />
            </button>
            {expandedJson && (
              <div className="p-4">
                <pre className="text-[10px] text-gray-300 bg-black/30 p-3 rounded overflow-x-auto font-mono">
                  {JSON.stringify(withdrawal.gateway_response, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Remarks Section */}
        {withdrawal.remarks && (
          <div className="bg-[#1C1C1E] border border-white/5 rounded-2xl overflow-hidden">
            <div className="bg-[#252528] px-4 py-3 border-b border-white/5">
              <h2 className="text-xs font-black text-white uppercase tracking-wider">
                Remarks
              </h2>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-300">{withdrawal.remarks}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
