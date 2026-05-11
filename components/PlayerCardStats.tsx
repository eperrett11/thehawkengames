import React from 'react';

const PLAYER_STATS: Record<string, { overall: number; height: string }> = {
  Andrew: { overall: 88, height: "6'2" },
  Ben: { overall: 90, height: "5'10" },
  Bobby: { overall: 68, height: "5'10" },
  Brendan: { overall: 92, height: "6'2" },
  Clay: { overall: 97, height: "6'2" },
  Cole: { overall: 82, height: "6'2" },
  Connor: { overall: 78, height: "5'7" },
  Eli: { overall: 88, height: "5'11" },
  Forrest: { overall: 79, height: "5'9" },
  Hawken: { overall: 99, height: 'Above Avg / Tall' },
  Jack: { overall: 75, height: "5'8" },
  Jordan: { overall: 85, height: "6'4" },
  Justin: { overall: 91, height: "6'3" },
  Kai: { overall: 74, height: "6'1" },
  Luke: { overall: 89, height: "6'2" },
  Nolan: { overall: 80, height: "6'4" }
};

interface PlayerCardStatsProps {
  playerName: string;
  colorHex?: string;
}

export const getPlayerCardDisplayName = (playerName: string) => (
  playerName === 'Andrew' ? 'Andrew "No Bones"' : playerName
);

const PlayerCardStats: React.FC<PlayerCardStatsProps> = ({ playerName }) => {
  const stats = PLAYER_STATS[playerName] || PLAYER_STATS[playerName.split(' ')[0]];
  if (!stats) return null;

  return (
    <div className="mt-2 grid grid-cols-2 gap-2 text-left">
      <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-center">
        <div className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-500">OVR</div>
        <div className="mt-0.5 text-xl font-black leading-none text-white">{stats.overall}</div>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-center">
        <div className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-500">Height</div>
        <div className="mt-0.5 text-sm font-black uppercase leading-none text-white">{stats.height}</div>
      </div>
    </div>
  );
};

export default PlayerCardStats;
