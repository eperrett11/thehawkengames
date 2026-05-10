import React, { useMemo, useState } from 'react';
import { useTournament } from '../store';

interface WinnerBetModuleProps {
  itemId: string;
}

const WinnerBetModule: React.FC<WinnerBetModuleProps> = ({ itemId }) => {
  const { state, currentUser, placeBet } = useTournament();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [betAmountInput, setBetAmountInput] = useState<string>('5');

  const item = state.bettableItems.find(i => i.id === itemId);
  const itemBets = state.bets.filter(b => b.bettableItemId === itemId);
  const isLocked = item?.status !== 'OPEN';

  const totalPot = useMemo(() => itemBets.reduce((acc, b) => acc + b.amount, 0), [itemBets]);

  if (!item) return null;
  const betAmount = Number(betAmountInput || 0);
  const isBetValid = Number.isFinite(betAmount) && betAmount >= 5 && betAmount <= (currentUser?.balance || 0);

  const getTeamColor = (teamId: string) => state.teams.find(t => t.id === teamId)?.colorHex || '#334155';

  const handleConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser || !selectedOption) return;
    if (betAmount < 5) {
      window.alert('Minimum bet is $5.');
      return;
    }
    placeBet(currentUser.id, item.id, selectedOption, betAmount);
  };

  return (
    <section className="rounded-2xl border border-slate-800/90 bg-black/15 p-3 space-y-3" onClick={(e) => e.stopPropagation()}>
      <div className="text-[11px] uppercase font-black tracking-[0.12em] text-slate-400 text-center">
        Tournament Winner
      </div>

      <div className="flex justify-center">
        <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded uppercase">
          POT: ${totalPot.toFixed(2)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {item.options.map(option => {
          const color = getTeamColor(option.id);
          return (
            <button
              key={option.id}
              onClick={(e) => {
                e.stopPropagation();
                if (!isLocked) setSelectedOption(option.id);
              }}
              className={`rounded-lg px-3 py-2 text-left text-[11px] font-black transition-all border ${
                selectedOption === option.id ? 'border-white text-white' : 'border-slate-700 text-slate-200'
              }`}
              style={{
                background: `linear-gradient(90deg, ${color}88 0%, rgba(15,23,42,0.62) 100%)`
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-[auto_auto] justify-center items-end gap-2">
        <div className="w-44">
          <label className="block text-[8px] font-black uppercase text-slate-500 mb-1">Bet Amount ($)</label>
          <div className="flex items-center">
            <div className="relative w-24">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-black">$</span>
              <input
                type="number"
                min={5}
                value={betAmountInput}
                onChange={(e) => setBetAmountInput(e.target.value)}
                onBlur={() => {
                  const value = Number(betAmountInput || 0);
                  if (betAmountInput !== '' && value < 5) {
                    window.alert('Minimum bet is $5.');
                    setBetAmountInput('5');
                  }
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded py-1.5 pl-5 pr-4 text-center font-bold text-xs"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleConfirm}
          disabled={!selectedOption || isLocked || !isBetValid}
          className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500 px-3 py-2.5 rounded-lg text-black font-black uppercase tracking-widest text-[10px] whitespace-nowrap"
        >
          Confirm
        </button>
      </div>
    </section>
  );
};

export default WinnerBetModule;
