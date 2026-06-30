import { CloudDownload, Check } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";

export default function Header() {
  const { language, setLanguage, t } = useLanguage();
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);

  return (
    <>
      <header className="flex justify-between items-center px-4 py-3 bg-[#121214] border-b border-white/5 shadow-xl">
        <div className="flex items-center gap-2">
          <div 
            className="w-7 h-7 bg-gradient-to-br from-amber-400 to-amber-600 rounded flex items-center justify-center text-black font-black text-sm shadow-[0_0_8px_rgba(245,158,11,0.6)]" 
          >
            {t('logoText')}
          </div>
          <span className="text-amber-500 font-black text-lg tracking-tighter uppercase">
            <span className="winwave-flash">{t('brand')}</span>
          </span>

        </div>
        <div className="flex items-center gap-4">
          <CloudDownload className="text-gray-400 w-5 h-5 hover:text-amber-400 transition-colors" />
          <div 
            className="flex items-center gap-1.5 text-xs font-bold text-gray-300 uppercase tracking-widest bg-[#1C1C1F] px-2.5 py-1 rounded-full border border-white/10 shadow-inner cursor-pointer hover:bg-white/5 transition-colors"
            onClick={() => setIsLangMenuOpen(true)}
          >
            <div className="w-4 h-4 rounded-full overflow-hidden relative shadow-sm border border-white/10">
              <img 
                src={language === 'EN' ? "https://flagcdn.com/us.svg" : "https://flagcdn.com/pk.svg"} 
                alt={language} 
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
            <span>{language}</span>
          </div>
        </div>
      </header>

      {/* Language Bottom Sheet */}
      {isLangMenuOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsLangMenuOpen(false)}></div>
          <div className="relative bg-[#1A1A1D] rounded-t-3xl p-4 animate-slide-up border-t border-white/10 w-full max-w-md mx-auto shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
            <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6"></div>
            
            <div className="space-y-3 pb-8">
              <div 
                className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all ${language === 'EN' ? 'bg-white/5 border border-amber-500/30 shadow-lg' : 'hover:bg-white/5 border border-transparent'}`}
                onClick={() => { setLanguage('EN'); setIsLangMenuOpen(false); }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white/10">
                    <img src="https://flagcdn.com/us.svg" alt="EN" className="w-full h-full object-cover" />
                  </div>
                  <span className="text-white font-bold tracking-wide">English (EN)</span>
                </div>
                {language === 'EN' && <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center shadow-[0_0_8px_rgba(245,158,11,0.5)]"><Check className="w-4 h-4 text-black" strokeWidth={3} /></div>}
              </div>

              <div 
                className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all ${language === 'UR' ? 'bg-white/5 border border-amber-500/30 shadow-lg' : 'hover:bg-white/5 border border-transparent'}`}
                onClick={() => { setLanguage('UR'); setIsLangMenuOpen(false); }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white/10">
                    <img src="https://flagcdn.com/pk.svg" alt="UR" className="w-full h-full object-cover" />
                  </div>
                  <span className="text-white font-bold tracking-wide">اردو (UR)</span>
                </div>
                {language === 'UR' && <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center shadow-[0_0_8px_rgba(245,158,11,0.5)]"><Check className="w-4 h-4 text-black" strokeWidth={3} /></div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
