import { useState } from "react";
import { X } from "lucide-react";
import { useUser } from "../context/UserContext";

// Segments in clockwise order starting from the top (12 o'clock), matching the
// labels printed on assets/svg/wheel.png. `weight` controls how likely each
// reward is — big prizes are deliberately rare so the wheel can't be farmed.
const SEGMENTS = [
  { amount: 10, weight: 36 },
  { amount: 30, weight: 25 },
  { amount: 80, weight: 18 },
  { amount: 500, weight: 12 },
  { amount: 5000, weight: 6 },
  { amount: 20000, weight: 2 },
  { amount: 50000, weight: 0.8 },
  { amount: 99999, weight: 0.2 },
];

const SEGMENT_ANGLE = 360 / SEGMENTS.length;
const SPIN_KEY = "winwave_wheel_last_spin";

function pickWeightedIndex(): number {
  const total = SEGMENTS.reduce((sum, s) => sum + s.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < SEGMENTS.length; i++) {
    r -= SEGMENTS[i].weight;
    if (r <= 0) return i;
  }
  return 0;
}

function formatRs(n: number): string {
  return `Rs${n.toLocaleString("en-US")}`;
}

export default function RouletteWheel({ onClose }: { onClose: () => void }) {
  const { mainWalletBalance, setMainWalletBalance, isLoggedIn } = useUser();
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [reward, setReward] = useState<number | null>(null);
  const [alreadySpun, setAlreadySpun] = useState<boolean>(() => {
    try {
      const today = new Date().toDateString();
      return localStorage.getItem(SPIN_KEY) === today;
    } catch {
      return false;
    }
  });

  const handleSpin = () => {
    if (spinning || reward !== null) return;
    if (!isLoggedIn) {
      alert("Please log in to spin the lucky wheel.");
      return;
    }
    if (alreadySpun) return;

    const index = pickWeightedIndex();
    // Bring the chosen segment to the top pointer: rotate by several full
    // turns, then offset so segment `index` lands at 0deg.
    const fullSpins = 5;
    const target = 360 * fullSpins - index * SEGMENT_ANGLE;
    setSpinning(true);
    setRotation((prev) => prev - (prev % 360) + target);

    window.setTimeout(() => {
      const won = SEGMENTS[index].amount;
      setReward(won);
      setSpinning(false);
      setMainWalletBalance(mainWalletBalance + won);
      setAlreadySpun(true);
      try {
        localStorage.setItem(SPIN_KEY, new Date().toDateString());
      } catch {
        /* ignore */
      }
    }, 4200);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#2A2A2E] to-[#1C1C1E] border border-amber-500/30 shadow-2xl p-6 flex flex-col items-center">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 text-gray-400 hover:text-white transition-colors"
        >
          <X size={22} />
        </button>

        <h2 className="text-amber-500 text-xl font-extrabold tracking-wide mb-1">
          Lucky Wheel
        </h2>
        <p className="text-gray-400 text-xs mb-5 text-center">
          Spin to win a bonus credited instantly to your balance
        </p>

        <div className="relative w-72 h-72 flex items-center justify-center">
          {/* Pointer */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-20">
            <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-amber-500 drop-shadow-lg" />
          </div>

          {/* Wheel */}
          <img
            src="assets/svg/wheel.png"
            alt="Lucky wheel"
            className="w-full h-full select-none pointer-events-none"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning
                ? "transform 4s cubic-bezier(0.16, 1, 0.3, 1)"
                : "none",
            }}
            draggable={false}
          />

          {/* GO button */}
          <button
            type="button"
            onClick={handleSpin}
            disabled={spinning || reward !== null || alreadySpun}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-16 h-16 rounded-full bg-gradient-to-b from-[#ff5e5e] to-[#e11d1d] text-white font-extrabold text-lg shadow-[0_0_0_5px_rgba(245,158,11,0.9)] disabled:opacity-80 active:scale-95 transition-transform"
          >
            GO
          </button>
        </div>

        <div className="mt-6 min-h-[48px] text-center">
          {reward !== null ? (
            <div className="animate-in zoom-in-95 duration-300">
              <p className="text-gray-300 text-sm">You won</p>
              <p className="text-amber-500 text-2xl font-extrabold">
                {formatRs(reward)}
              </p>
            </div>
          ) : alreadySpun ? (
            <p className="text-gray-400 text-sm">
              You have already spun today. Come back tomorrow!
            </p>
          ) : (
            <p className="text-gray-500 text-xs">
              One free spin per day. Tap GO to play.
            </p>
          )}
        </div>

        {reward !== null && (
          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-3/4 bg-gradient-to-b from-amber-400 to-amber-500 text-black font-bold py-2.5 rounded-full hover:brightness-110 transition-all shadow-lg shadow-amber-500/20"
          >
            Collect
          </button>
        )}
      </div>
    </div>
  );
}
