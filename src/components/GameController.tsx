type GameControllerProps = {
  gameName: string;
  options: string[];
};

export default function GameController({ gameName, options }: GameControllerProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#0D0D11] p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-gray-400">{gameName} configuration</p>
          <h3 className="mt-2 text-xl font-black">Live session rules</h3>
        </div>
        <span className="rounded-full bg-white/5 px-3 py-2 text-sm text-gray-200">Round timer</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {options.map((option) => (
          <label key={option} className="rounded-3xl border border-white/10 bg-[#151518] p-4 cursor-pointer transition hover:border-amber-500/30">
            <div className="flex items-center justify-between gap-4">
              <span className="text-base font-bold">{option}</span>
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.35em] text-gray-300">Mode</span>
            </div>
            <p className="mt-2 text-sm text-gray-400">Manage round timings, entry size, and payout profile for {gameName}.</p>
          </label>
        ))}
      </div>
    </div>
  );
}
