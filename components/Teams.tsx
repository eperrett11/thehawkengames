import React, { useEffect, useMemo, useState } from 'react';
import { useTournament } from '../store';
import PlayerCardStats, { getPlayerCardDisplayName } from './PlayerCardStats';

const PLACEHOLDER_SRC = '/images/player-card-placeholder.jpg';
const PLAYER_CARD_SRC: Record<string, string> = {
  Andrew: '/images/playercards/andrew.webp',
  Ben: '/images/playercards/ben.webp',
  Bobby: '/images/playercards/bobby.webp',
  Brendan: '/images/playercards/brendan.webp',
  Clay: '/images/playercards/clay.webp',
  Cole: '/images/playercards/cole.webp',
  Connor: '/images/playercards/connor.webp',
  Eli: '/images/playercards/eli.webp',
  Forrest: '/images/playercards/forrest.webp',
  Hawken: '/images/playercards/hawken.webp',
  Jack: '/images/playercards/jack.webp',
  Jordan: '/images/playercards/jordan.webp',
  Justin: '/images/playercards/justin.webp',
  Kai: '/images/playercards/kai.webp',
  Luke: '/images/playercards/luke.webp',
  Nolan: '/images/playercards/nolan.webp'
};

const getPlayerCardSrc = (name: string) => PLAYER_CARD_SRC[name] || PLAYER_CARD_SRC[name.split(' ')[0]] || PLACEHOLDER_SRC;

const Teams: React.FC = () => {
  const { state } = useTournament();
  const [selectedPlayer, setSelectedPlayer] = useState<{ name: string; teamName: string; colorHex: string; cardSrc: string } | null>(null);
  const [isCardOpen, setIsCardOpen] = useState(false);

  const teamRows = useMemo(() => {
    return state.teams.map((team) => {
      const [firstWord] = team.name.split(' ');
      const players = team.playerIds.map((id) => state.players.find((p) => p.id === id)?.name || 'Unknown');

      return {
        ...team,
        firstWord,
        players
      };
    });
  }, [state.teams, state.players]);

  const handlePlayerCardClick = (name: string, teamName: string, colorHex: string) => {
    setSelectedPlayer({ name, teamName, colorHex, cardSrc: getPlayerCardSrc(name) });
    setIsCardOpen(false);
  };

  useEffect(() => {
    if (!selectedPlayer) return;
    const raf = window.requestAnimationFrame(() => setIsCardOpen(true));
    return () => window.cancelAnimationFrame(raf);
  }, [selectedPlayer]);

  const closePlayerCard = () => {
    setIsCardOpen(false);
    window.setTimeout(() => setSelectedPlayer(null), 220);
  };

  return (
    <>
      <div className="h-full w-full px-3 py-2 animate-in fade-in duration-500 overflow-hidden">
        <div className="h-full grid grid-rows-[repeat(4,minmax(0,1fr))] gap-2">
          {teamRows.map((team) => (
            <div
              key={team.id}
              className="relative rounded-xl border border-slate-700 overflow-hidden min-h-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
              style={{
                background: `linear-gradient(135deg, ${team.colorHex}E0 0%, ${team.colorHex}A8 18%, ${team.colorHex}63 42%, rgba(18,24,44,0.94) 100%)`
              }}
            >
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.02)_16%,rgba(255,255,255,0)_40%)] pointer-events-none" />
              <div
                className="absolute left-0 top-0 bottom-0 w-[76px] pointer-events-none"
                style={{ background: `linear-gradient(90deg, ${team.colorHex}22 0%, rgba(15,23,42,0) 100%)` }}
              />
              <div className="absolute left-[-18px] top-1/2 -translate-y-1/2 pointer-events-none">
                <div className="-rotate-90 flex items-center justify-center leading-none text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.4)] w-[92px]">
                  <span className="text-[1.45rem] sm:text-[1.65rem] font-black italic uppercase tracking-[0.05em] whitespace-nowrap">{team.firstWord}</span>
                </div>
              </div>

              <div className="relative h-full pl-[58px] pr-3 py-2 min-w-0 flex items-center">
                {team.players.length === 0 ? (
                  <p className="text-[10px] text-slate-500 italic uppercase font-bold self-center">Draft Pending</p>
                ) : (
                  <div className="grid grid-cols-4 gap-2.5 w-full h-full items-center">
                    {team.players.map((name, idx) => {
                      const cardId = `${team.id}-${name}-${idx}`;

                      return (
                        <button
                          key={cardId}
                          onClick={() => handlePlayerCardClick(name, team.name, team.colorHex)}
                          className="group min-w-0 h-full flex items-center justify-center focus:outline-none"
                        >
                          <div className="w-full h-full flex flex-col items-center justify-center">
                            <div
                              className="relative aspect-[4/5] w-full rounded-[12px] border-2 bg-slate-950/78 shadow-[0_10px_22px_rgba(2,6,23,0.28)] overflow-hidden transition-transform duration-150 group-active:scale-[0.98]"
                              style={{ borderColor: `${team.colorHex}CC` }}
                            >
                              <img
                                src={getPlayerCardSrc(name)}
                                alt={`${name} player card`}
                                loading="eager"
                                decoding="async"
                                className="absolute inset-0 h-full w-full object-cover"
                              />
                              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0)_28%,rgba(15,23,42,0.12)_100%)]" />
                            </div>
                            <div className="mt-1 min-h-[22px] text-center px-0.5">
                              <div className="text-[11px] sm:text-[12px] font-black uppercase tracking-[0.05em] leading-tight text-white break-words">
                                {name}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedPlayer && (
        <div
          className="fixed inset-0 z-[120] bg-black/92 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity duration-200"
          style={{ opacity: isCardOpen ? 1 : 0 }}
          onClick={closePlayerCard}
        >
          <button
            onClick={closePlayerCard}
            className="absolute top-4 right-4 rounded-full border border-white/15 bg-black/45 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white"
          >
            Close
          </button>
          <div className="w-full max-w-md transition-opacity duration-200" style={{ opacity: isCardOpen ? 1 : 0.12, perspective: '1400px' }}>
            <div
              className="relative aspect-[4/5] w-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ transformStyle: 'preserve-3d', transform: isCardOpen ? 'rotateY(0deg) scale(1)' : 'rotateY(180deg) scale(0.92)' }}
            >
              <div
                className="absolute inset-0 rounded-[22px] overflow-hidden border-2 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
                style={{
                  borderColor: selectedPlayer.colorHex,
                  boxShadow: `0 0 0 1px ${selectedPlayer.colorHex}55, 0 20px 60px rgba(0,0,0,0.45)`,
                  background: `linear-gradient(135deg, ${selectedPlayer.colorHex}EE 0%, ${selectedPlayer.colorHex}88 45%, rgba(15,23,42,0.96) 100%)`,
                  transform: 'rotateY(180deg)',
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden'
                }}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.22),rgba(255,255,255,0)_45%)]" />
                <div className="h-full flex flex-col items-center justify-center px-6 text-center text-white">
                  <div className="text-[10px] font-black uppercase tracking-[0.28em] text-white/75">The Hawken Games</div>
                  <div className="mt-4 text-3xl font-black italic uppercase leading-none text-white">{getPlayerCardDisplayName(selectedPlayer.name)}</div>
                  <div className="mt-2 text-sm font-black uppercase tracking-[0.22em]">{selectedPlayer.teamName}</div>
                </div>
              </div>
              <div
                className="absolute inset-0 rounded-[22px] overflow-hidden border-2 shadow-[0_20px_60px_rgba(0,0,0,0.45)] bg-slate-950"
                style={{
                  borderColor: selectedPlayer.colorHex,
                  boxShadow: `0 0 0 1px ${selectedPlayer.colorHex}55, 0 20px 60px rgba(0,0,0,0.45)`,
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden'
                }}
              >
                <img
                  src={selectedPlayer.cardSrc}
                  alt={`${selectedPlayer.name} full player card`}
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <div className="mt-3 text-center transition-opacity duration-200" style={{ opacity: isCardOpen ? 1 : 0 }}>
              <div
                className="text-lg font-black italic uppercase tracking-tight text-white"
                style={{ textShadow: '0 2px 14px rgba(255,255,255,0.14), 0 2px 10px rgba(0,0,0,0.65)' }}
              >
                {getPlayerCardDisplayName(selectedPlayer.name)}
              </div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: selectedPlayer.colorHex }}>
                {selectedPlayer.teamName}
              </div>
              <PlayerCardStats playerName={selectedPlayer.name} colorHex={selectedPlayer.colorHex} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Teams;
