import { Volume2 } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

export default function NoticeBar({
  onDetailClick,
}: {
  onDetailClick?: () => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="px-4 py-1">
      <div className="bg-[#121214] rounded-full py-2 px-3 flex items-center justify-between gap-3 shadow-md border border-white/5">
        <Volume2 className="text-amber-500 w-4 h-4 shrink-0" />
        <div className="flex-1 overflow-hidden relative h-4">
          <div className="absolute whitespace-nowrap text-xs text-gray-400 animate-marquee font-medium flex items-center h-full">
            {t('notice')}
          </div>
        </div>
        <button
          className="bg-amber-500 text-black px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shrink-0 shadow-lg shadow-amber-500/20 hover:bg-amber-400 transition-colors"
          onClick={onDetailClick}
          type="button"
        >
          {t('detail')}
        </button>
      </div>
    </div>
  );
}
