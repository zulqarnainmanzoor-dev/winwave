import { useState } from "react";
import { ChevronLeft, Wallet, ArrowRightLeft, X } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { useUser } from "../context/UserContext";

interface WalletViewProps {
  onBack: () => void;
}

export default function WalletView({ onBack }: WalletViewProps) {
  const { t } = useLanguage();
  const {
    totalBalance,
    mainWalletBalance,
    thirdPartyWalletBalance,
    transferWallet,
  } = useUser();
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferDirection, setTransferDirection] = useState<'to-game' | 'to-main'>('to-game');
  const [transferAmount, setTransferAmount] = useState("");

  const mainShare = totalBalance > 0 ? Math.round((mainWalletBalance / totalBalance) * 100) : 0;
  const gameShare = totalBalance > 0 ? 100 - mainShare : 0;

  const openTransfer = (direction: 'to-game' | 'to-main') => {
    setTransferDirection(direction);
    setTransferAmount("");
    setShowTransferModal(true);
  };

  const handleTransfer = () => {
    const amount = parseFloat(transferAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    const success = transferWallet(transferDirection, amount);
    if (!success) {
      alert(
        transferDirection === 'to-game'
          ? "Insufficient main wallet balance."
          : "Insufficient game wallet balance."
      );
      return;
    }

    setShowTransferModal(false);
    setTransferAmount("");
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0A0A0B] animate-slide-up min-h-screen">
      <div className="flex items-center justify-between p-4 bg-[#161618] border-b border-white/5 sticky top-0 z-50">
        <ChevronLeft className="w-6 h-6 text-white cursor-pointer" onClick={onBack} />
        <span className="text-white font-bold text-lg tracking-wide">{t('wallet')}</span>
        <div className="w-6 h-6" />
      </div>

      <div className="flex flex-col items-center justify-center py-8 bg-[#161618] border-b border-white/5">
        <div className="w-14 h-14 rounded-2xl bg-[#1C1C1E] border border-white/5 flex items-center justify-center mb-4">
          <Wallet className="w-8 h-8 text-amber-500" strokeWidth={1.5} />
        </div>
        <span className="text-white text-3xl font-black tracking-tight">Rs {totalBalance.toFixed(2)}</span>
        <span className="text-amber-500 text-[10px] font-bold mt-2 tracking-widest uppercase">{t('totalBalance')}</span>
      </div>

      <div className="px-4 -mt-4 relative z-10 pb-8">
        <div className="bg-[#1C1C1E] rounded-2xl p-5 shadow-xl border border-white/5">
          <div className="flex justify-around mb-6">
            <button
              type="button"
              onClick={() => openTransfer('to-main')}
              className="flex flex-col items-center w-1/2 group"
            >
              <div className="w-[88px] h-[88px] rounded-full border-[8px] border-[#2A2A2E] flex items-center justify-center mb-3 shadow-inner group-hover:border-amber-500/30 transition-colors">
                <span className="text-amber-500 font-black text-sm">{mainShare}%</span>
              </div>
              <span className="text-amber-500 font-bold text-sm tracking-tight mb-1">Rs {mainWalletBalance.toFixed(2)}</span>
              <span className="text-gray-400 text-[11px] font-bold tracking-wide">{t('mainWallet')}</span>
            </button>

            <button
              type="button"
              onClick={() => openTransfer('to-game')}
              className="flex flex-col items-center w-1/2 group"
            >
              <div className="w-[88px] h-[88px] rounded-full border-[8px] border-[#2A2A2E] flex items-center justify-center mb-3 shadow-inner group-hover:border-orange-500/30 transition-colors">
                <span className="text-orange-400 font-black text-sm">{gameShare}%</span>
              </div>
              <span className="text-orange-400 font-bold text-sm tracking-tight mb-1">Rs {thirdPartyWalletBalance.toFixed(2)}</span>
              <span className="text-gray-400 text-[11px] font-bold tracking-wide">{t('thirdPartyWallet')}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => openTransfer('to-game')}
            className="w-full py-3 rounded-xl font-bold tracking-wide text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-lg shadow-orange-500/20 hover:brightness-110 transition-all flex items-center justify-center gap-2"
          >
            <ArrowRightLeft className="w-4 h-4" />
            {t('mainWalletTransfer')}
          </button>

          <p className="text-[10px] text-gray-500 text-center mt-4 leading-relaxed">
            Transfer funds between your main wallet and 3rd party game wallet before playing or withdrawing.
          </p>
        </div>
      </div>

      {showTransferModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowTransferModal(false)} />
          <div className="bg-[#1C1C1E] rounded-2xl w-full max-w-sm relative z-10 border border-white/10 shadow-2xl p-5 animate-slide-up">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold text-sm uppercase tracking-widest">Transfer Funds</h3>
              <button onClick={() => setShowTransferModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setTransferDirection('to-game')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                  transferDirection === 'to-game'
                    ? 'bg-amber-500 text-black'
                    : 'bg-white/5 text-gray-400 border border-white/10'
                }`}
              >
                Main → Game
              </button>
              <button
                type="button"
                onClick={() => setTransferDirection('to-main')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                  transferDirection === 'to-main'
                    ? 'bg-amber-500 text-black'
                    : 'bg-white/5 text-gray-400 border border-white/10'
                }`}
              >
                Game → Main
              </button>
            </div>

            <div className="bg-[#0A0A0B] rounded-xl border border-white/10 p-3 mb-4">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Available</span>
              <span className="text-amber-500 font-bold text-lg">
                Rs {(transferDirection === 'to-game' ? mainWalletBalance : thirdPartyWalletBalance).toFixed(2)}
              </span>
            </div>

            <div className="flex items-center bg-[#0A0A0B] border border-white/10 rounded-xl px-4 py-3 mb-5">
              <span className="text-gray-400 font-bold text-sm mr-2 border-r border-white/10 pr-2">Rs</span>
              <input
                type="number"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                placeholder="Enter amount"
                className="flex-1 bg-transparent outline-none text-white font-bold text-sm"
              />
              <button
                type="button"
                onClick={() =>
                  setTransferAmount(
                    (transferDirection === 'to-game' ? mainWalletBalance : thirdPartyWalletBalance).toFixed(2)
                  )
                }
                className="text-amber-500 text-xs font-bold hover:text-amber-400"
              >
                All
              </button>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="flex-1 py-2.5 rounded-xl font-bold text-xs border border-white/10 text-gray-300 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTransfer}
                className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-amber-500 text-black hover:bg-amber-400"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
