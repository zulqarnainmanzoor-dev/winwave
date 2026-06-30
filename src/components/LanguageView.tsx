import { ChevronLeft, Check } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

export default function LanguageView({ onBack }: { onBack: () => void }) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="flex-1 flex flex-col bg-[#0A0A0B] h-screen text-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 sticky top-0 bg-[#161618] z-40 border-b border-white/5 shadow-md flex-shrink-0">
        <ChevronLeft
          className="w-6 h-6 text-gray-300 hover:text-white cursor-pointer"
          onClick={onBack}
        />
        <h1 className="text-white font-black tracking-widest text-base uppercase">
          {t("selectLanguage")}
        </h1>
        <div className="w-6 h-6" /> {/* Spacer */}
      </div>

      {/* Language List */}
      <div className="p-4 space-y-3 flex-1">
        {/* English option */}
        <button
          onClick={() => {
            setLanguage("EN");
          }}
          className={`w-full bg-[#161618] border rounded-2xl p-4 flex items-center justify-between shadow-lg transition-all text-left ${
            language === "EN" ? "border-[#ffa502]" : "border-white/5 hover:bg-[#1E1E21]"
          }`}
        >
          <div className="flex items-center gap-3">
            <img 
              src="https://flagcdn.com/w40/gb.png" 
              alt="English" 
              className="w-6 h-4 object-cover rounded-sm shadow-sm"
            />
            <span className="text-white font-bold text-sm tracking-wide">
              {t("english")}
            </span>
          </div>
          {language === "EN" && (
            <Check className="w-5 h-5 text-[#ffa502]" strokeWidth={3} />
          )}
        </button>

        {/* Urdu option */}
        <button
          onClick={() => {
            setLanguage("UR");
          }}
          className={`w-full bg-[#161618] border rounded-2xl p-4 flex items-center justify-between shadow-lg transition-all text-left ${
            language === "UR" ? "border-[#ffa502]" : "border-white/5 hover:bg-[#1E1E21]"
          }`}
        >
          <div className="flex items-center gap-3">
            <img 
              src="https://flagcdn.com/w40/pk.png" 
              alt="Urdu" 
              className="w-6 h-4 object-cover rounded-sm shadow-sm"
            />
            <span className="text-white font-bold text-sm tracking-wide">
              {t("urdu")}
            </span>
          </div>
          {language === "UR" && (
            <Check className="w-5 h-5 text-[#ffa502]" strokeWidth={3} />
          )}
        </button>
      </div>
    </div>
  );
}
