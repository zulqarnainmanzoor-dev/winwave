const icons = [
  { src: '/assets/gameCategories/roulette_icon.png', alt: 'Roulette' },
  { src: '/assets/gameCategories/Crash.webp', alt: 'Crash' },
  { src: '/assets/gameCategories/Fish.webp', alt: 'Fish' },
  { src: '/assets/gameCategories/Slots.webp', alt: 'Slots' },
];

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
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </button>
      ))}
    </div>
  );
}
