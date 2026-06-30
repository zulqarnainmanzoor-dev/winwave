import { ChevronLeft, ChevronRight } from "lucide-react";

export function SectionHeader({ title, icon }: { title: string, icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 flex items-center justify-center">
          {icon}
        </div>
        <h3 className="text-white font-bold text-sm">{title}</h3>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500 font-bold bg-[#1C1C1F] px-2 py-1 rounded">Detail</span>
        <div className="flex items-center gap-1">
          <button className="w-5 h-5 bg-[#1C1C1F] rounded flex items-center justify-center text-gray-400 hover:text-white">
            <ChevronLeft className="w-3 h-3" />
          </button>
          <button className="w-5 h-5 bg-[#1C1C1F] rounded flex items-center justify-center text-gray-400 hover:text-white">
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function GameGrid({ children, cols = 2 }: { children: React.ReactNode, cols?: number }) {
  const gridClasses = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  }[cols] || 'grid-cols-2';

  return (
    <div className={`grid ${gridClasses} gap-3`}>
      {children}
    </div>
  );
}

export function GameCard({
  img,
  title,
  subtitle,
  bgColor,
  onClick,
  aspectClassName = "aspect-[4/3]",
}: {
  img?: string;
  title: string;
  subtitle?: string;
  bgColor: string;
  onClick?: () => void;
  aspectClassName?: string;
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl overflow-hidden relative cursor-pointer group ${aspectClassName} ${bgColor}`}
    >
      <div className="absolute inset-0 z-10 flex flex-col justify-end p-2 bg-gradient-to-t from-black/60 to-transparent">
        <span className="text-white font-bold text-xs">{title}</span>
        {subtitle && <span className="text-white/70 text-[10px]">{subtitle}</span>}
      </div>
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        {/* Fallback pattern */}
        <div className="w-full h-full opacity-20 mix-blend-overlay bg-[radial-gradient(circle_at_center,_white_0%,_transparent_70%)]"></div>
        {img && (
           <img src={img} alt={title} className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-110" onError={(e) => e.currentTarget.style.display='none'} />
        )}
      </div>
    </div>
  );
}
