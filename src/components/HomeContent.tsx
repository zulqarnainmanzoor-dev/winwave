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

export default function HomeContent({
  onWinGoClick,
}: {
  onWinGoClick?: () => void;
}) {
  const [showMaintenance, setShowMaintenance] = useState(false);

  return (
    <div className="px-4 flex flex-col gap-6 pb-6 relative">
      {/* Lottery */}
      <section>
        <SectionHeader
          title="Lottery"
          icon={<Dices className="w-5 h-5 text-amber-500" />}
        />
        <GameGrid cols={2}>
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
          <div
            className="rounded-3xl overflow-hidden relative cursor-pointer group aspect-[1.4/1.8]"
            onClick={() => setShowMaintenance(true)}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#E68A33] to-[#B35900]" />
            <img
              src="assets/Games Sections/Lottery/Featured Games/K3.webp"
              alt="K3"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-3 z-10">
              <div className="text-amber-500 font-black tracking-widest text-[10px] uppercase">K3 Lottery</div>
              <div className="text-white font-black text-xl leading-tight">K3</div>
            </div>
          </div>
          <div
            className="rounded-3xl overflow-hidden relative cursor-pointer group aspect-[1.4/1.8]"
            onClick={() => setShowMaintenance(true)}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#4DA6FF] to-[#0059B3]" />
            <img
              src="assets/Games Sections/Lottery/Featured Games/5D.webp"
              alt="5D"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-3 z-10">
              <div className="text-amber-500 font-black tracking-widest text-[10px] uppercase">5D Lottery</div>
              <div className="text-white font-black text-xl leading-tight">5D</div>
            </div>
          </div>
          <div
            className="rounded-3xl overflow-hidden relative cursor-pointer group aspect-[1.4/1.8]"
            onClick={() => setShowMaintenance(true)}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#33CCCC] to-[#008080]" />
            <img
              src="assets/Games Sections/Lottery/Featured Games/TRX Win.webp"
              alt="TRX Wingo"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-3 z-10">
              <div className="text-amber-500 font-black tracking-widest text-[10px] uppercase">TRX Win</div>
              <div className="text-white font-black text-xl leading-tight">TRX Win</div>
            </div>
          </div>
        </GameGrid>
      </section>

      {/* Recommended Games */}
      <section>
        <SectionHeader
          title="Recommended Games"
          icon={<Crown className="w-5 h-5 text-amber-500" />}
        />
        <GameGrid cols={3}>
          {/* Recommended Game Logos */}
          <GameCard
            title="AVIATOR"
            img="assets/Games Sections/Recommended Games/Aviator.webp"
            bgColor="bg-[#2B2735]"
            onClick={() => setShowMaintenance(true)}
          />
          <GameCard
            title="BOOM"
            bgColor="bg-[#0080ff]"
            onClick={() => setShowMaintenance(true)}
          />
          <GameCard
            title="GOAL"
            img="assets/Games Sections/Recommended Games/Goal.png"
            bgColor="bg-[#2B2735]"
            onClick={() => setShowMaintenance(true)}
          />
          <GameCard
            title="WIN GO"
            img="assets/Games Sections/Recommended Games/WinGo.webp"
            bgColor="bg-[#2B2735]"
            onClick={onWinGoClick}
          />
          <GameCard
            title="CRICKET"
            img="assets/Games Sections/Recommended Games/Cricket.webp"
            bgColor="bg-[#33cc33]"
            onClick={() => setShowMaintenance(true)}
          />
          <GameCard
            title="MINES PRO"
            img="assets/Games Sections/Recommended Games/Mines Pro.webp"
            bgColor="bg-[#2B2735]"
            onClick={() => setShowMaintenance(true)}
          />
        </GameGrid>
      </section>

      {/* Mini games */}
      <section>
        <SectionHeader
          title="Mini games"
          icon={<Rocket className="w-5 h-5 text-amber-500" />}
        />
        <GameGrid cols={2}>
          <GameCard
            title="HOTLINE"
            bgColor="bg-[#0033cc]"
            onClick={() => setShowMaintenance(true)}
          />
          <GameCard
            title="KENO"
            bgColor="bg-[#cc0066]"
            onClick={() => setShowMaintenance(true)}
          />
        </GameGrid>
      </section>

      {/* Casino */}
      <section>
        <SectionHeader
          title="Casino"
          icon={<Sparkles className="w-5 h-5 text-amber-500" />}
        />
        <GameGrid cols={3}>
          <GameCard
            title="WG"
            bgColor="bg-gradient-to-br from-[#666] to-[#333]"
            onClick={() => setShowMaintenance(true)}
          />
          <GameCard
            title="SEXY"
            bgColor="bg-gradient-to-br from-[#888] to-[#444]"
            onClick={() => setShowMaintenance(true)}
          />
          <GameCard
            title="MG LIVE"
            bgColor="bg-gradient-to-br from-[#555] to-[#222]"
            onClick={() => setShowMaintenance(true)}
          />
          <GameCard
            title="AG"
            bgColor="bg-gradient-to-br from-[#999] to-[#555]"
            onClick={() => setShowMaintenance(true)}
          />
          <GameCard
            title="EVO"
            bgColor="bg-gradient-to-br from-[#777] to-[#444]"
            onClick={() => setShowMaintenance(true)}
          />
          <GameCard
            title="PP"
            bgColor="bg-gradient-to-br from-[#888] to-[#555]"
            onClick={() => setShowMaintenance(true)}
          />
        </GameGrid>
      </section>

      {/* Slots */}
      <section>
        <SectionHeader
          title="Slots"
          icon={<Gamepad2 className="w-5 h-5 text-amber-500" />}
        />
        <GameGrid cols={2}>
          <GameCard
            title="JILI GAMES"
            bgColor="bg-[#4a154b]"
            onClick={() => setShowMaintenance(true)}
          />
          <GameCard
            title="EVOLUTION"
            bgColor="bg-[#14234b]"
            onClick={() => setShowMaintenance(true)}
          />
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


      {/* Sports */}
      <section>
        <SectionHeader
          title="Sports"
          icon={<Flame className="w-5 h-5 text-amber-500" />}
        />
        <GameGrid cols={3}>
          <GameCard
            title="K9"
            bgColor="bg-[#cc5200]"
            onClick={() => setShowMaintenance(true)}
          />
          <GameCard
            title="CMD"
            bgColor="bg-[#0052cc]"
            onClick={() => setShowMaintenance(true)}
          />
          <GameCard
            title="SABA"
            bgColor="bg-[#cc7a00]"
            onClick={() => setShowMaintenance(true)}
          />
          <GameCard
            title="IM"
            bgColor="bg-[#002b80]"
            onClick={() => setShowMaintenance(true)}
          />
        </GameGrid>
      </section>

      {/* Rummy */}
      <section>
        <SectionHeader
          title="Rummy"
          icon={<Layers className="w-5 h-5 text-amber-500" />}
        />
        <GameGrid cols={2}>
          <GameCard
            title="365"
            bgColor="bg-[#1a1a1a]"
            onClick={() => setShowMaintenance(true)}
          />
          <GameCard
            title="V8 POKER"
            bgColor="bg-[#1a1a1a]"
            onClick={() => setShowMaintenance(true)}
          />
        </GameGrid>
      </section>

      {/* Fishing */}
      <section>
        <SectionHeader
          title="Fishing"
          icon={<Fish className="w-5 h-5 text-amber-500" />}
        />
        <GameGrid cols={3}>
          <GameCard
            title="JILI"
            bgColor="bg-[#0066cc]"
            onClick={() => setShowMaintenance(true)}
          />
          <GameCard
            title="FC"
            bgColor="bg-[#0099cc]"
            onClick={() => setShowMaintenance(true)}
          />
          <GameCard
            title="JDB"
            bgColor="bg-[#00cccc]"
            onClick={() => setShowMaintenance(true)}
          />
        </GameGrid>
      </section>

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
            {/* Avatar block */}
            <div className="w-12 h-12 rounded-full border border-slate-400 bg-slate-950/80 z-10 flex items-center justify-center mb-[-8px] shadow-lg relative">
              <span className="text-slate-400 text-[10px] font-extrabold tracking-tight">NO.2</span>
            </div>
            {/* Podium Bar */}
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
            {/* Avatar block with absolute Crown icon */}
            <div className="w-16 h-16 rounded-full border-2 border-amber-500 bg-amber-950/30 z-10 flex items-center justify-center mb-[-12px] shadow-[0_0_15px_rgba(245,158,11,0.25)] relative">
              <Crown className="w-5 h-5 text-[#ffa502] absolute -top-4 animate-bounce" style={{ animationDuration: '3s' }} />
              <span className="text-amber-500 text-[11px] font-extrabold tracking-tight">NO.1</span>
            </div>
            {/* Podium Bar */}
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
            {/* Avatar block */}
            <div className="w-12 h-12 rounded-full border border-amber-800 bg-amber-950/80 z-10 flex items-center justify-center mb-[-8px] shadow-lg relative">
              <span className="text-amber-700 text-[10px] font-extrabold tracking-tight">NO.3</span>
            </div>
            {/* Podium Bar */}
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
                Under Maintenance
              </h2>
              <p className="text-gray-400 text-xs font-medium leading-relaxed">
                This game is currently undergoing maintenance. Please try again
                later.
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
