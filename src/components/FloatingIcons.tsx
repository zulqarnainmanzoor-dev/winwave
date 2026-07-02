const icons = [
  { src: '/assets/gameCategories/roulette_icon.png', alt: 'Roulette', orange: false },
  { src: '/assets/gameCategories/Crash.webp',        alt: 'Crash',    orange: false },
  { src: '/assets/gameCategories/Fish.webp',         alt: 'Fish',     orange: false },
  { src: '/assets/gameCategories/Slots.webp',        alt: 'Slots',    orange: false },
  { src: '/assets/svg/icon_sevice.png',              alt: 'Support',  orange: true  },
];

// CSS filter to recolor any image to #ffa502 orange
const ORANGE_FILTER =
  'brightness(0) saturate(100%) invert(62%) sepia(97%) saturate(1200%) hue-rotate(1deg) brightness(103%) contrast(104%)';

export default function FloatingIcons() {
  return (
    <div className="fixed right-4 bottom-24 flex flex-col gap-3 z-50">
      {icons.map((item) => (
        <button
          key={item.alt}
          type="button"
          className="w-12 h-12 rounded-full cursor-pointer hover:scale-110 transition-transform overflow-hidden shadow-lg border-2 border-white/10 bg-[#111214] flex items-center justify-center"
          aria-label={item.alt}
        >
          <img
            src={item.src}
            alt={item.alt}
            className="w-full h-full object-cover"
            style={item.orange ? { filter: ORANGE_FILTER } : undefined}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </button>
      ))}
    </div>
  );
}
