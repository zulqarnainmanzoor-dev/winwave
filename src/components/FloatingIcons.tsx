import { useState } from 'react';
import RouletteWheel from './RouletteWheel';

const icons = [
  { src: '/assets/gameCategories/Crash.webp', alt: 'Crash' },
  { src: '/assets/gameCategories/Fish.webp', alt: 'Fish' },
  { src: '/assets/gameCategories/Slots.webp', alt: 'Slots' },
];

export default function FloatingIcons() {
  const [showWheel, setShowWheel] = useState(false);

  return (
    <>
      <div className="fixed right-4 bottom-24 flex flex-col items-center gap-3 z-50">
        {/* Roulette / Lucky wheel — no background, slightly larger, opens modal */}
        <button
          type="button"
          onClick={() => setShowWheel(true)}
          className="w-16 h-16 cursor-pointer hover:scale-110 transition-transform drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)] animate-[spin_8s_linear_infinite]"
          aria-label="Lucky Wheel"
        >
          <img
            src="assets/svg/wheel.png"
            alt="Lucky Wheel"
            className="w-full h-full object-contain"
            draggable={false}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </button>

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

      {showWheel && <RouletteWheel onClose={() => setShowWheel(false)} />}
    </>
  );
}
