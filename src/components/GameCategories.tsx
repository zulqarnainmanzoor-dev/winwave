import { useLanguage } from "../context/LanguageContext";

export default function GameCategories() {
  const { t } = useLanguage();

  // Order required by UI: Popular -> InHouse/Lobby -> Lottery -> Mini Games -> Casino -> Slots
  const categories = [
    { name: t("popular"), icon: "/assets/gameCategories/Popular.webp", active: false },
    { name: t("inHouse"), icon: "/assets/gameCategories/Fish.webp", active: false },
    { name: t("lottery"), icon: "/assets/gameCategories/Lottery.webp", active: false },
    { name: t("miniGame"), icon: "/assets/gameCategories/Bonus.webp", active: false },
    { name: t("casino"), icon: "/assets/gameCategories/Crash.webp", active: false },
    { name: t("slots"), icon: "/assets/gameCategories/Slots.webp", active: false },
  ];

  return (
    <div className="px-4 mt-3">
      <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
        {categories.map((cat, i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-2 min-w-[65px] cursor-pointer group"
          >
            <div
              className={`w-[56px] h-[56px] rounded-[16px] flex items-center justify-center border shadow-lg transition-all ${
                cat.active
                  ? "bg-amber-500/10 border-amber-500/50"
                  : "bg-gradient-to-b from-[#1A1A1D] to-[#121214] border-white/5 group-hover:bg-white/5"
              }`}
            >
              {/* gray by default, colorful on hover */}
              <img
                src={cat.icon}
                alt={cat.name}
                className="w-[34px] h-[34px] object-contain filter grayscale group-hover:grayscale-0 transition-all drop-shadow-md"
              />
            </div>

            <span
              className={`text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
                cat.active
                  ? "text-amber-500"
                  : "text-gray-500 group-hover:text-gray-300"
              }`}
            >
              {cat.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
