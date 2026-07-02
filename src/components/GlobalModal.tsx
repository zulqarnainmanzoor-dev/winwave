// src/components/GlobalModal.tsx
// Usage:
//   const { showModal, showConfirm } = useModal();
//   await showModal({ title: "Error", message: "Something went wrong" });
//   const ok = await showConfirm({ title: "Delete?", message: "This cannot be undone." });

import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { X, AlertTriangle, CheckCircle, Info } from "lucide-react";

type ModalVariant = "info" | "success" | "warning" | "danger";

interface ModalOptions {
  title: string;
  message: string;
  variant?: ModalVariant;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface ModalState extends ModalOptions {
  isConfirm: boolean;
  resolve: (value: boolean) => void;
}

interface ModalContextType {
  showModal: (opts: ModalOptions) => Promise<void>;
  showConfirm: (opts: ModalOptions) => Promise<boolean>;
}

const ModalContext = createContext<ModalContextType | null>(null);

const ICONS: Record<ModalVariant, React.ReactNode> = {
  info:    <Info className="w-6 h-6 text-blue-400" />,
  success: <CheckCircle className="w-6 h-6 text-green-400" />,
  warning: <AlertTriangle className="w-6 h-6 text-amber-400" />,
  danger:  <AlertTriangle className="w-6 h-6 text-red-400" />,
};

const CONFIRM_BTN: Record<ModalVariant, string> = {
  info:    "bg-blue-600 hover:bg-blue-500",
  success: "bg-green-600 hover:bg-green-500",
  warning: "bg-amber-500 hover:bg-amber-400",
  danger:  "bg-red-600 hover:bg-red-500",
};

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = useState<ModalState | null>(null);

  const showModal = useCallback((opts: ModalOptions): Promise<void> => {
    return new Promise((res) => {
      setModal({ ...opts, isConfirm: false, resolve: (v) => { setModal(null); res(); } });
    });
  }, []);

  const showConfirm = useCallback((opts: ModalOptions): Promise<boolean> => {
    return new Promise((res) => {
      setModal({ ...opts, isConfirm: true, resolve: (v) => { setModal(null); res(v); } });
    });
  }, []);

  return (
    <ModalContext.Provider value={{ showModal, showConfirm }}>
      {children}
      {modal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => modal.resolve(false)}
        >
          <div
            className="w-full max-w-sm bg-[#1a1a2e] border border-[#0f3460] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-3">
                {ICONS[modal.variant ?? "info"]}
                <h3 className="text-white font-bold text-base">{modal.title}</h3>
              </div>
              <button
                onClick={() => modal.resolve(false)}
                className="text-gray-500 hover:text-white transition-colors rounded-full p-1 hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <p className="px-5 pb-5 text-gray-300 text-sm leading-relaxed">{modal.message}</p>

            {/* Actions */}
            <div className="flex border-t border-[#0f3460]">
              {modal.isConfirm && (
                <button
                  onClick={() => modal.resolve(false)}
                  className="flex-1 py-3 text-gray-400 hover:text-white hover:bg-white/5 text-sm font-medium transition-colors"
                >
                  {modal.cancelLabel ?? "Cancel"}
                </button>
              )}
              <button
                onClick={() => modal.resolve(true)}
                className={`flex-1 py-3 text-white text-sm font-semibold transition-colors rounded-br-2xl ${modal.isConfirm ? "rounded-none" : "rounded-bl-2xl"} ${CONFIRM_BTN[modal.variant ?? "info"]}`}
              >
                {modal.confirmLabel ?? (modal.isConfirm ? "Confirm" : "OK")}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error("useModal must be used within ModalProvider");
  return ctx;
}
