import { useState, useEffect } from "react";
import { useLanguage } from "../context/LanguageContext";

const generateRandomId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const randomChars = Array.from({length: 9}, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
  return `Mem***${randomChars}`;
};

const generateRandomAmount = () => {
  return `Rs.${(Math.random() * 500 + 10).toFixed(2)}`;
};

export default function WinningInfo() {
  const { t } = useLanguage();
  const [winners, setWinners] = useState(() => 
    Array.from({length: 12}, () => ({
      id: generateRandomId(),
      amount: generateRandomAmount(),
      img: "/assets/banners/Winning Information of WinGo.png"
    }))
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setWinners(prev => {
        const newWinners = [...prev];
        // Update a random winner entry to simulate real-time feed without breaking CSS marquee
        const randomIndex = Math.floor(Math.random() * newWinners.length);
        newWinners[randomIndex] = {
          id: generateRandomId(),
          amount: generateRandomAmount(),
          img: "/assets/banners/Winning Information of K3.png"
        };
        return newWinners;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const scrollItems = [...winners, ...winners, ...winners];

  return (
    <div className="px-4 py-3">
      <div className="bg-gradient-to-b from-[#1A1A1D] to-[#121214] rounded-2xl border border-white/5 p-4 shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 w-56 h-32 bg-amber-500/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
        
        <div className="flex items-center gap-2 justify-center mb-4">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]"></div>
          <h3 className="text-amber-500 font-black text-sm uppercase tracking-widest">
            {t('winningInfo')}
          </h3>
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]"></div>
        </div>
        
        <div className="overflow-hidden relative w-full">
          <div className="flex gap-3 pb-2 w-max animate-infinite-scroll hover:[animation-play-state:paused]">
            {scrollItems.map((w, i) => (
              <div key={i} className="min-w-[100px] flex flex-col items-center">
                <div className="w-[180px] h-[115px] rounded-xl bg-[#1A1A1D] mb-2 overflow-hidden relative border border-white/5 shadow-inner group">
                   <img src={w.img} alt="winner" className="absolute inset-0 w-full h-full object-cover z-0" />
                   <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10 opacity-60"></div>
                   <div className="absolute inset-0 bg-amber-500/40 blur-2xl opacity-0 group-hover:opacity-30 transition-opacity z-10"></div>
                   <div className="absolute bottom-1.5 w-full text-center z-20">
                      <span className="text-[8px] text-amber-400 font-bold uppercase block leading-tight">{t('game')}</span>
                   </div>
                </div>
                <span className="text-[10px] text-gray-400 font-bold">{w.id}</span>
                <span className="text-xs text-green-500 font-black tracking-tight">{w.amount}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
