import { X } from "lucide-react";
import { useState, useEffect } from "react";
import { useLanguage } from "../context/LanguageContext";

export default function InstallPrompt() {
  const [isVisible, setIsVisible] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const { t } = useLanguage();

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      alert("You can install the app from your browser's menu!");
      return;
    }
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsVisible(false);
    }
    setDeferredPrompt(null);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-[95px] left-1/2 -translate-x-1/2 w-full max-w-[280px] z-40">
      <div className="bg-gradient-to-r from-[#1A1A1D] to-[#121214] rounded-full p-1.5 flex items-center justify-between shadow-2xl border border-amber-500/30">
        <div 
          className="flex items-center gap-3 px-3 cursor-pointer flex-1"
          onClick={handleInstallClick}
        >
          <div className="w-5 h-5 bg-gradient-to-br from-amber-400 to-amber-600 rounded flex items-center justify-center text-black font-black text-[10px] shadow-[0_0_8px_rgba(245,158,11,0.6)]">
            {t('logoText')}
          </div>
          <span className="text-gray-200 font-bold text-xs uppercase tracking-widest">{t('addToDesktop')}</span>
        </div>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setIsVisible(false);
          }}
          className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 mr-1 hover:text-white transition-colors shrink-0 z-10"
        >
          <X className="w-3.5 h-3.5" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
