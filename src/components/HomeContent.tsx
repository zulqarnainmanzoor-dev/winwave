import { useState } from "react";
import { SectionHeader, GameGrid, GameCard } from "./HomeSections";
import { 
  Trophy, 
  Crown, 
  Phone, 
  Wrench, 
  TrendingUp, 
  Coins, 
  Award, 
  Dices, 
  Rocket, 
  Gamepad2, 
  Compass, 
  Gem, 
  Fish, 
  Layers, 
  Flame,
  Star,
  Sparkles
} from "lucide-react";

// Generate 120 fake leaderboard members to simulate a highly active real-time community
const generateLeaderboardUsers = () => {
  const prefix = ["Ali", "Ahm", "Hus", "Zah", "Sub", "She", "Saj", "Bil", "Asi", "Kha", "Muha", "Usm", "Ham", "Uma", "Far", "Fai", "Ibr", "Yau", "Taq", "Waq", "Naf", "Sal", "Har", "Kam"];
  const middle = ["***", "---", "###", "...", "***"];
  const suffix = ["12", "77", "88", "15", "55", "92", "44", "32", "99", "01", "23", "45", "89", "11", "22", "33", "777", "999", "101", "505", "202", "303", "404", "808"];
  
  const users = [];
  let currentEarnings = 42100;
  for (let i = 4; i <= 125; i++) {
    const name = `${prefix[i % prefix.length]}${middle[i % middle.length]}${suffix[(i * 7) % suffix.length]}`;
    // Gradual decay in earnings down to Rs 150 minimum
    const decay = Math.floor(Math.random() * 250) + 120;
    currentEarnings = Math.max(150, currentEarnings - decay);
    users.push({
      rank: i,
      name,
      earnings: `Rs.${currentEarnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    });
  }
  return users;
};

const LEADERBOARD_MEMBERS = generateLeaderboardUsers();

// Game visibility array - all games are visible by default
// Use visibleGames.includes(game.name) to hide under-maintenance games
const VISIBLE_GAMES = [
  'Win Go',
  'Aviator',
  'Cricket', 
  'Mines Pro',
  'Mines',
  'Spride Aviator',
];

export default function HomeContent({
  onWinGoClick,
}: {
  onWinGoClick?: () => void;
}) {
  const [showMaintenance, setShowMaintenance] = useState(false);
  const [maintenanceGame, setMaintenanceGame] = useState('');

  // Check if a game is in the visible list
  const isGameVisible = (gameName: string) => {
    return VISIBLE_GAMES.includes(gameName);
  };

  // Handle click on visible games that aren't WinGo
  const handleVisibleGameClick = (gameName: string) => {
    setMaintenanceGame(gameName);
    setShowMaintenance(true);
  };

  return (
    <div className="px-4 flex flex-col gap-6 pb-6 relative">
      {/* Lottery Section - always visible, all games with proper posters */}
      <section>
        <SectionHeader
          title="Lottery"
          icon={<Dices className="w-5 h-5 text-amber-500" />}
        />
        <GameGrid cols={2}>
          {/* Win Go - already has poster */}
          {isGameVisible('Win Go') && (
            <div
              className="rounded-3xl overflow-hidden relative cursor-pointer group aspect-[1.4/1.8]"
              onClick={onWinGoClick}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#D94C4C] to-[#8C2323]" />
              <img
                src="assets/Games Sections/Popular Games/WinGo 1Min.webp"
                alt="Win Go"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3 z-10">
                <div className="text-amber-500 font-black tracking-widest text-[10px] uppercase">Win Go</div>
                <div className="text-white font-black text-xl leading-tight">Win Go</div>
              </div>
            </div>
          )}
          {/* Aviator - with poster from Recommended Games */}
          {isGameVisible('Aviator') && (
            <div
              className="rounded-3xl overflow-hidden relative cursor-pointer group aspect-[1.4/1.8]"
              onClick={() => handleVisibleGameClick('Aviator')}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#1a4c8c] to-[#0d2b5c]" />
              <img
                src="assets/Games Sections/Recommended Games/Aviator.webp"
                alt="Aviator"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3 z-10">
                <div className="text-amber-500 font-black tracking-widest text-[10px] uppercase">Popular</div>
                <div className="text-white font-black text-xl leading-tight">Aviator</div>
              </div>
            </div>
          )}
          {/* Cricket - with poster from Popular Games */}
          {isGameVisible('Cricket') && (
            <div
              className="rounded-3xl overflow-hidden relative cursor-pointer group aspect-[1.4/1.8]"
              onClick={() => handleVisibleGameClick('Cricket')}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#2d5c2d] to-[#143014]" />
              <img
                src="assets/Games Sections/Popular Games/Cricket.webp"
                alt="Cricket"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3 z-10">
                <div className="text-amber-500 font-black tracking-widest text-[10px] uppercase">Sports</div>
                <div className="text-white font-black text-xl leading-tight">Cricket</div>
              </div>
            </div>
          )}
          {/* Mines Pro - with poster from Recommended Games */}
          {isGameVisible('Mines Pro') && (
            <div
              className="rounded-3xl overflow-hidden relative cursor-pointer group aspect-[1.4/1.8]"
              onClick={() => handleVisibleGameClick('Mines Pro')}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#6b3a8a] to-[#3a1a5c]" />
              <img
                src="assets/Games Sections/Recommended Games/Mines Pro.webp"
                alt="Mines Pro"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3 z-10">
                <div className="text-amber-500 font-black tracking-widest text-[10px] uppercase">Mines</div>
                <div className="text-white font-black text-xl leading-tight">Mines Pro</div>
              </div>
            </div>
          )}
          {/* Mines - with poster from Popular Games */}
          {isGameVisible('Mines') && (
            <div
              className="rounded-3xl overflow-hidden relative cursor-pointer group aspect-[1.4/1.8]"
              onClick={() => handleVisibleGameClick('Mines')}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#8a6b3a] to-[#5c3a1a]" />
              <img
                src="assets/Games Sections/Popular Games/Mines.webp"
                alt="Mines"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3 z-10">
                <div className="text-amber-500 font-black tracking-widest text-[10px] uppercase">Classic</div>
                <div className="text-white font-black text-xl leading-tight">Mines</div>
              </div>
            </div>
          )}
          {/* Spride Aviator - with poster from Popular Games */}
          {isGameVisible('Spride Aviator') && (
            <div
              className="rounded-3xl overflow-hidden relative cursor-pointer group aspect-[1.4/1.8]"
              onClick={() => handleVisibleGameClick('Spride Aviator')}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#c44c2d] to-[#8c2d1a]" />
              <img
                src="assets/Games Sections/Popular Games/Spribe Aviator.webp"
                alt="Spride Aviator"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3 z-10">
                <div className="text-amber-500 font-black tracking-widest text-[10px] uppercase">Crash</div>
                <div className="text-white font-black text-xl leading-tight">Spride Aviator</div>
              </div>
            </div>
          )}
        </GameGrid>
      </section>

      {/* Recommended Games - always visible */}
      <section>
        <SectionHeader
          title="Recommended Games"
          icon={<Crown className="w-5 h-5 text-amber-500" />}
        />
        <GameGrid cols={3}>
          <GameCard
            title="WIN GO"
            img="assets/Games Sections/Recommended Games/WinGo.webp"
            bgColor="bg-[#2B2735]"
            onClick={onWinGoClick}
          />
          {isGameVisible('Aviator') && (
            <GameCard
              title="AVIATOR"
              img="assets/Games Sections/Recommended Games/Aviator.webp"
              bgColor="bg-[#1C2A3D]"
              onClick={() => handleVisibleGameClick('Aviator')}
            />
          )}
          {isGameVisible('Cricket') && (
            <GameCard
              title="CRICKET"
              img="assets/Games Sections/Recommended Games/Cricket.webp"
              bgColor="bg-[#1C3D1C]"
              onClick={() => handleVisibleGameClick('Cricket')}
            />
          )}
          {isGameVisible('Mines Pro') && (
            <GameCard
              title="MINES PRO"
              img="assets/Games Sections/Recommended Games/Mines Pro.webp"
              bgColor="bg-[#2D1C3D]"
              onClick={() => handleVisibleGameClick('Mines Pro')}
            />
          )}
          {isGameVisible('Mines') && (
            <GameCard
              title="MINES"
              img="assets/Games Sections/Popular Games/Mines.webp"
              bgColor="bg-[#3D3D1C]"
              onClick={() => handleVisibleGameClick('Mines')}
            />
          )}
          {isGameVisible('Spride Aviator') && (
            <GameCard
              title="SPRIDE AVIATOR"
              img="assets/Games Sections/Recommended Games/Aviator.webp"
              bgColor="bg-[#3D1C1C]"
              onClick={() => handleVisibleGameClick('Spride Aviator')}
            />
          )}
        </GameGrid>
      </section>

      {/* Mini Games - always visible, with posters */}
      <section>
        <SectionHeader
          title="Mini Games"
          icon={<Sparkles className="w-5 h-5 text-amber-500" />}
        />
        <GameGrid cols={3}>
          {isGameVisible('Mines') && (
            <GameCard
              title="MINES"
              img="assets/Games Sections/Popular Games/Mines.webp"
              bgColor="bg-[#2B2735]"
              onClick={() => handleVisibleGameClick('Mines')}
            />
          )}
          {isGameVisible('Mines Pro') && (
            <GameCard
              title="MINES PRO"
              img="assets/Games Sections/Recommended Games/Mines Pro.webp"
              bgColor="bg-[#1C2A3D]"
              onClick={() => handleVisibleGameClick('Mines Pro')}
            />
          )}
          {isGameVisible('Aviator') && (
            <GameCard
              title="AVIATOR"
              img="assets/Games Sections/Recommended Games/Aviator.webp"
              bgColor="bg-[#1C3D1C]"
              onClick={() => handleVisibleGameClick('Aviator')}
            />
          )}
          {isGameVisible('Spride Aviator') && (
            <GameCard
              title="SPRIDE AVIATOR"
              img="assets/Games Sections/Popular Games/Spribe Aviator.webp"
              bgColor="bg-[#2D1C3D]"
              onClick={() => handleVisibleGameClick('Spride Aviator')}
            />
          )}
          {isGameVisible('Cricket') && (
            <GameCard
              title="CRICKET"
              img="assets/Games Sections/Recommended Games/Cricket.webp"
              bgColor="bg-[#3D3D1C]"
              onClick={() => handleVisibleGameClick('Cricket')}
            />
          )}
        </GameGrid>
      </section>

      {/* Promo Banners */}
      <div className="flex gap-3">
        <div className="flex-1 rounded-xl bg-gradient-to-r from-[#2a2a2a] to-[#1a1a1a] border border-[#ffcc00]/20 p-3 flex items-center justify-between cursor-pointer group">
          <span className="text-white font-bold text-xs w-1/2">
            Wheel of fortune
          </span>
          <div className="w-10 h-10 bg-[#ffcc00]/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
            <Compass className="w-5 h-5 text-[#ffa502] animate-spin" style={{ animationDuration: '6s' }} />
          </div>
        </div>
        <div className="flex-1 rounded-xl bg-gradient-to-r from-[#2a2a2a] to-[#1a1a1a] border border-[#ffcc00]/20 p-3 flex items-center justify-between cursor-pointer group">
          <span className="text-white font-bold text-xs w-1/2">
            VIP privileges
          </span>
          <div className="w-10 h-10 bg-[#ffcc00]/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
            <Gem className="w-5 h-5 text-[#ffa502]" />
          </div>
        </div>
      </div>

      {/* Super Jackpot */}
      <section className="bg-[#1C1C1F] border border-white/5 rounded-xl p-4 flex flex-col gap-3">
        <div className="flex gap-2 items-center">
          <Crown className="w-5 h-5 text-amber-500" />
          <span className="text-amber-500 font-bold text-sm">
            Super Jackpot
          </span>
        </div>
        <p className="text-gray-400 text-[10px]">
          When you win a super jackpot, you will receive additional rewards.
          Maximum bonus{" "}
          <span className="text-amber-500 font-bold">Rs.500.00</span>
        </p>
        <button className="w-full bg-gradient-to-r from-[#fcd34d] to-[#fbbf24] text-black font-bold py-2.5 rounded-full text-xs shadow-md">
          Look Super Jackpot
        </button>
      </section>

      {/* Today's earnings chart */}
      <section className="bg-[#1C1C1F] border border-white/5 rounded-3xl p-5 shadow-xl relative overflow-hidden">
        {/* Header with premium Trophy icon and custom badge */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#ffa502]/10 flex items-center justify-center border border-[#ffa502]/20">
              <Trophy className="w-4 h-4 text-[#ffa502]" />
            </div>
            <div>
              <h3 className="text-white font-black text-sm tracking-wide uppercase">
                Today's Earnings
              </h3>
              <p className="text-[9px] text-gray-500 font-bold tracking-wider">REALTIME LEADERBOARD</p>
            </div>
          </div>
          <div className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-[#ffa502] animate-pulse" />
            <span className="text-[9px] text-[#ffa502] font-black uppercase tracking-widest">LIVE</span>
          </div>
        </div>

        {/* Podium container */}
        <div className="flex items-end justify-center gap-3.5 h-44 mb-6">
          {/* Rank 2 */}
          <div className="w-[30%] flex flex-col items-center">
            <div className="w-12 h-12 rounded-full border border-slate-400 bg-slate-950/80 z-10 flex items-center justify-center mb-[-8px] shadow-lg relative">
              <span className="text-slate-400 text-[10px] font-extrabold tracking-tight">NO.2</span>
            </div>
            <div className="w-full bg-gradient-to-t from-[#151518] to-[#1F2123] border-t border-slate-400 rounded-t-2xl pt-4 pb-2 flex flex-col items-center h-28 shadow-xl">
              <span className="text-gray-400 text-[9px] font-bold truncate w-full text-center px-1">
                Zah***88
              </span>
              <span className="text-slate-300 text-[9px] font-black tracking-tight mt-0.5">
                Rs.184.2K
              </span>
              <span className="text-slate-400 font-black text-lg mt-auto tracking-widest">
                2
              </span>
            </div>
          </div>

          {/* Rank 1 */}
          <div className="w-[36%] flex flex-col items-center">
            <div className="w-16 h-16 rounded-full border-2 border-amber-500 bg-amber-950/30 z-10 flex items-center justify-center mb-[-12px] shadow-[0_0_15px_rgba(245,158,11,0.25)] relative">
              <Crown className="w-5 h-5 text-[#ffa502] absolute -top-4 animate-bounce" style={{ animationDuration: '3s' }} />
              <span className="text-amber-500 text-[11px] font-extrabold tracking-tight">NO.1</span>
            </div>
            <div className="w-full bg-gradient-to-t from-[#151518] to-[#3a2a1a] border-t-2 border-amber-500 rounded-t-2xl pt-5 pb-2 flex flex-col items-center h-36 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 to-[#ffa502] opacity-80" />
              <span className="text-gray-200 text-[10px] font-black truncate w-full text-center px-1">
                Win***999
              </span>
              <span className="text-amber-500 text-[10px] font-black tracking-tight mt-0.5">
                Rs.492.5K
              </span>
              <span className="text-[#ffa502] font-black text-3xl mt-auto drop-shadow-md">
                1
              </span>
            </div>
          </div>

          {/* Rank 3 */}
          <div className="w-[30%] flex flex-col items-center">
            <div className="w-12 h-12 rounded-full border border-amber-800 bg-amber-950/80 z-10 flex items-center justify-center mb-[-8px] shadow-lg relative">
              <span className="text-amber-700 text-[10px] font-extrabold tracking-tight">NO.3</span>
            </div>
            <div className="w-full bg-gradient-to-t from-[#151518] to-[#221C16] border-t border-amber-700 rounded-t-2xl pt-4 pb-2 flex flex-col items-center h-24 shadow-xl">
              <span className="text-gray-400 text-[9px] font-bold truncate w-full text-center px-1">
                Ali***77
              </span>
              <span className="text-amber-700 text-[9px] font-black tracking-tight mt-0.5">
                Rs.94.1K
              </span>
              <span className="text-amber-800 font-black text-lg mt-auto tracking-widest">
                3
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable Rank List underneath */}
        <div className="border-t border-white/5 pt-4">
          <div className="max-h-[280px] overflow-y-auto pr-1 space-y-2 no-scrollbar scroll-smooth">
            {LEADERBOARD_MEMBERS.map((member) => (
              <div 
                key={member.rank}
                className="flex items-center justify-between bg-[#151518]/60 px-4 py-2.5 rounded-2xl border border-white/5 hover:border-[#ffa502]/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black text-gray-400 w-6">
                    {member.rank}
                  </span>
                  <span className="text-xs font-bold text-gray-300">
                    {member.name}
                  </span>
                </div>
                <span className="text-xs font-black text-amber-500/90">
                  {member.earnings}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer Info */}
      <section className="flex flex-col items-center mt-6 gap-4">
        <div className="flex justify-center gap-6 mb-2">
          <div className="w-10 h-10 rounded-full border border-red-500 text-red-500 flex items-center justify-center font-bold text-sm">
            +18
          </div>
          <div className="w-10 h-10 rounded-full border border-gray-600 bg-gray-800 text-white flex items-center justify-center">
            <Phone className="w-5 h-5 text-gray-300" />
          </div>
        </div>

        <div className="text-[9px] text-gray-500 leading-tight space-y-2 mb-4">
          <ul className="list-disc pl-4 space-y-1">
            <li>
              The platform advocates fairness, justice, and openness. We mainly
              operate fair lottery, blockchain games, live casinos, and slot
              machine games.
            </li>
            <li>
              B9 Game works with more than 10,000 online live game dealers and
              slot games, all of which are verified fair games.
            </li>
            <li>
              B9 Game supports fast deposit and withdrawal, and looks forward to
              your visit.
            </li>
          </ul>
          <p className="text-amber-500 text-center font-medium">
            Gambling can be addictive, please play rationally.
            <br />
            B9 Game only accepts customers above the age of 18.
          </p>
        </div>
      </section>

      {/* Maintenance Modal */}
      {showMaintenance && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1C1C1F] rounded-2xl w-full max-w-xs overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-6 text-center border-b border-white/5 flex flex-col items-center">
              <div className="w-14 h-14 bg-[#ffa502]/10 rounded-2xl flex items-center justify-center border border-[#ffa502]/20 mb-4 animate-pulse">
                <Wrench className="w-7 h-7 text-[#ffa502]" />
              </div>
              <h2 className="text-white text-lg font-black tracking-wide uppercase mb-2">
                {maintenanceGame} - Coming Soon
              </h2>
              <p className="text-gray-400 text-xs font-medium leading-relaxed">
                This game is currently under development. Please check back later.
              </p>
            </div>

            <div className="p-4 flex justify-center bg-[#151518]">
              <button
                onClick={() => setShowMaintenance(false)}
                className="w-full bg-gradient-to-r from-[#ffa502] to-[#ffbe59] text-black font-black py-2.5 rounded-full hover:brightness-110 transition-all cursor-pointer uppercase tracking-wider text-xs shadow-lg shadow-amber-500/10"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}