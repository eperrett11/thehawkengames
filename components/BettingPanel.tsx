import React, { useEffect, useMemo, useState } from 'react';
import { useTournament } from '../store';

interface BettingPanelProps {
  itemId: string;
  minimal?: boolean;
  autoExpand?: boolean;
  pickerTitle?: string;
  alwaysOpen?: boolean;
  onBetPlaced?: () => void;
}

const BettingPanel: React.FC<BettingPanelProps> = ({ itemId, minimal = false, autoExpand = false, pickerTitle, alwaysOpen = false, onBetPlaced }) => {
  const { state, currentUser, placeBet } = useTournament();
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [betAmountInput, setBetAmountInput] = useState<string>('5');
  const [showBettors, setShowBettors] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [betPin, setBetPin] = useState('');
  const [betPinError, setBetPinError] = useState('');

  const item = state.bettableItems.find((entry) => entry.id === itemId);
  const itemBets = state.bets.filter((entry) => entry.bettableItemId === itemId && !entry.refunded && !entry.voided);
  const latestPlayer = currentUser ? state.players.find((entry) => entry.id === currentUser.id) || currentUser : null;
  const userBet = itemBets.find((entry) => entry.playerId === currentUser?.id);

  const poolStats = useMemo(() => {
    const total = itemBets.reduce((acc, entry) => acc + entry.amount, 0);
    const options = (item?.options || []).map((option) => {
      const amount = itemBets
        .filter((entry) => entry.optionId === option.id)
        .reduce((acc, entry) => acc + entry.amount, 0);
      const percentage = total > 0 ? (amount / total) * 100 : 0;
      return { ...option, amount, percentage };
    });
    return { total, options };
  }, [itemBets, item]);

  if (!item) return null;

  const betAmount = Number(betAmountInput || 0);
  const availableBalance = latestPlayer?.balance || 0;
  const isLocked = item.status !== 'OPEN';
  const pickerIsOpen = alwaysOpen || isExpanded;
  const hasFunding = availableBalance >= 5;
  const isBetValid = !userBet && Number.isFinite(betAmount) && betAmount >= 5 && betAmount <= availableBalance;


  useEffect(() => {
    if (!autoExpand || isLocked) return;
    if (!hasFunding && !userBet) return;

    setIsExpanded(true);
    setSelectedOption(userBet?.optionId || item?.options?.[0]?.id || null);
    setBetAmountInput(userBet ? String(userBet.amount) : '5');
  }, [autoExpand, hasFunding, isLocked, item?.options, userBet]);

  const handleBet = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser || !selectedOption) return;
    if (userBet) return;
    if (betAmount < 5) {
      window.alert('Minimum bet is $5.');
      return;
    }

    setBetPin('');
    setBetPinError('');
    setShowConfirmModal(true);
  };

  const submitBetWithPin = () => {
    if (!currentUser || !selectedOption) return;
    if (betPin.length !== 4) {
      setBetPinError('Enter your 4 digit PIN.');
      return;
    }
    if ((latestPlayer?.pin || currentUser?.pin || '') !== betPin) {
      setBetPinError('Incorrect PIN.');
      return;
    }

    placeBet(currentUser.id, item.id, selectedOption, betAmount);
    setShowConfirmModal(false);
    setShowSuccessModal(true);
    setIsExpanded(false);
    setBetPin('');
    setBetPinError('');
    onBetPlaced?.();
  };

  const event = state.events.find((entry) => entry.id === item.eventId);
  const matchup = event?.matchups?.find((entry) => entry.id === item.matchupId);

  const getResolvedTeam = (optionId: string, fallbackLabel: string) => {
    const participantIndex = matchup?.participantIds?.findIndex((participantId) => participantId === optionId) ?? -1;
    const participantTeamId = participantIndex >= 0 ? matchup?.participantTeamIds?.[participantIndex] : optionId;
    return state.teams.find((entry) => entry.id === participantTeamId) || state.teams.find((entry) => fallbackLabel.toLowerCase().includes(entry.color.toLowerCase()));
  };

  const getOptionTone = (optionId: string, fallbackLabel: string) => {
    const team = getResolvedTeam(optionId, fallbackLabel);
    const teamColor = team?.colorHex || '#334155';

    return {
      teamColor,
      background: `linear-gradient(90deg, ${teamColor}CC 0%, rgba(15,23,42,0.58) 100%)`,
      mutedBackground: `linear-gradient(90deg, ${teamColor}88 0%, rgba(15,23,42,0.45) 100%)`
    };
  };

  const getDisplayOptionLabel = (optionId: string, fallbackLabel: string) => {
    if (!matchup) return fallbackLabel;

    const participantIndex = matchup.participantIds?.findIndex((participantId) => participantId === optionId) ?? -1;
    const team = getResolvedTeam(optionId, fallbackLabel);
    const showTeamOnly = matchup.round === 'Semifinal' || matchup.round === 'Final';

    if (showTeamOnly) {
      return team?.name || (participantIndex >= 0 ? matchup.participants?.[participantIndex] : fallbackLabel) || fallbackLabel;
    }

    return fallbackLabel.replace(/^[A-Za-z]+ Team [AB]:\s*/i, '');
  };

  const selectedOptionLabel = selectedOption
    ? getDisplayOptionLabel(selectedOption, poolStats.options.find((option) => option.id === selectedOption)?.label || 'Selected Team')
    : '';

  return (
    <div
      className={minimal ? 'space-y-3' : 'rounded-2xl border border-slate-800 bg-slate-900/70 p-3.5'}
      onClick={(e) => e.stopPropagation()}
    >
      <div className={`flex items-center justify-between gap-3 ${minimal ? '' : 'pb-1'}`}>
        <div className={minimal ? 'min-w-0' : 'min-w-0'}>
          {!minimal ? <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Betting Market</div> : null}
          <div className={`font-black uppercase tracking-[0.16em] ${minimal ? 'text-[10px] text-slate-500' : 'text-[11px] text-slate-500'}`}>
            {userBet ? `Wagered $${userBet.amount.toFixed(2)}` : isLocked ? 'Locked' : ''}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!minimal && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowBettors((value) => !value);
              }}
              className="rounded-full border border-slate-700 bg-slate-950/40 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-slate-300"
            >
              {showBettors ? 'Hide Bets' : 'Show Bets'}
            </button>
          )}
          {!alwaysOpen && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!isLocked && hasFunding && !userBet) setIsExpanded((value) => !value);
              }}
              disabled={!!userBet || isLocked || !hasFunding}
              className={`rounded-xl border px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
                isLocked
                  ? 'border-slate-700 bg-slate-900/60 text-slate-400'
                  : hasFunding || userBet
                    ? 'border-white/15 bg-white text-black'
                    : 'border-slate-700 bg-slate-950/40 text-slate-500'
              }`}
            >
              {userBet ? 'Bet Wagered' : 'Place Bet'}
            </button>
          )}
        </div>
      </div>

      {!minimal && (
        <div className="space-y-2">
          {poolStats.options.map((option) => {
            const tone = getOptionTone(option.id, option.label);
            const isWinner = item.winnerOptionId === option.id;

            return (
              <div key={option.id} className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/45">
                <div
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                  style={{ background: tone.mutedBackground }}
                >
                  <div className="min-w-0 text-[11px] font-black leading-tight text-white">{getDisplayOptionLabel(option.id, option.label)}</div>
                  <div className="shrink-0 text-right">
                    <div className="text-[11px] font-black text-white">{option.percentage.toFixed(0)}%</div>
                    <div className="text-[9px] font-bold text-slate-200">${option.amount.toFixed(0)}</div>
                  </div>
                </div>
                {isWinner ? (
                  <div className="border-t border-white/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-amber-300">Winner</div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {!minimal && showBettors && (
        <div className="space-y-1 rounded-2xl border border-slate-800 bg-slate-950/45 p-3 animate-in fade-in duration-200">
          {itemBets.length === 0 ? (
            <p className="text-[10px] italic text-slate-500">No bets placed yet.</p>
          ) : (
            itemBets.map((bet) => {
              const player = state.players.find((entry) => entry.id === bet.playerId);
              const optionLabel = poolStats.options.find((entry) => entry.id === bet.optionId)?.label || 'Option';

              return (
                <div key={bet.id} className="flex items-center justify-between gap-3 border-b border-slate-800/80 py-1.5 text-[10px] last:border-0">
                  <span className="font-black text-slate-300">{player?.name}</span>
                  <span className="text-right text-slate-500">
                    <span className="text-slate-300">{optionLabel}</span> · <span className="text-emerald-400">${bet.amount}</span>
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}

      {pickerIsOpen && !isLocked && (
        <div className={`space-y-4 animate-in slide-in-from-top-3 duration-200 ${
          alwaysOpen
            ? ''
            : 'rounded-[22px] border border-emerald-500/20 bg-[linear-gradient(145deg,rgba(3,7,18,0.96)_0%,rgba(6,35,28,0.48)_100%)] p-4 shadow-[0_12px_34px_rgba(16,185,129,0.08)]'
        }`}>
          <div className="space-y-1">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">{pickerTitle || 'Choose Winner'}</div>
          </div>
          <div className="grid gap-2.5">
            {poolStats.options.map((option) => {
              const tone = getOptionTone(option.id, option.label);
              const selected = selectedOption === option.id;

              return (
                <button
                  key={option.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedOption(option.id);
                  }}
                  className={`relative overflow-hidden rounded-2xl border px-3.5 py-3.5 text-left transition-all active:scale-[0.99] ${
                    selected
                      ? 'border-emerald-300 text-white shadow-[0_0_0_1px_rgba(110,231,183,0.32),0_0_26px_rgba(16,185,129,0.18)]'
                      : 'border-slate-700 bg-slate-950/70 text-slate-200'
                  }`}
                  style={{ background: selected ? tone.background : undefined }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-black ${
                        selected ? 'border-white bg-white text-black' : 'border-slate-600 text-slate-500'
                      }`}>
                        {selected ? '✓' : ''}
                      </span>
                      <span className="min-w-0 text-[13px] font-black uppercase leading-tight">{getDisplayOptionLabel(option.id, option.label)}</span>
                    </div>
                    <span className="shrink-0 rounded-full bg-black/25 px-2 py-1 text-[10px] font-black text-white/90">
                      {option.percentage.toFixed(0)}% <span className="text-white/60">${option.amount.toFixed(0)}</span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="h-px bg-slate-800/90" />

          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
            <div>
              <label className="mb-1 block text-[9px] font-black uppercase tracking-[0.14em] text-emerald-400">Bet Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">$</span>
                <input
                  type="number"
                  value={betAmountInput}
                  min={5}
                  disabled={!!userBet}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    e.stopPropagation();
                    setBetAmountInput(e.target.value);
                  }}
                  onBlur={(e) => {
                    e.stopPropagation();
                    const value = Number(betAmountInput || 0);
                    if (betAmountInput !== '' && value < 5) {
                      window.alert('Minimum bet is $5.');
                      setBetAmountInput('5');
                    }
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 py-3 pl-8 pr-3 text-center text-base font-black text-white outline-none disabled:opacity-55"
                />
              </div>
            </div>
            <button
              onClick={handleBet}
              disabled={!selectedOption || !isBetValid}
              className="rounded-xl bg-emerald-500 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-black transition-all active:scale-95 disabled:bg-slate-700 disabled:text-slate-500"
            >
              {userBet ? 'Bet Wagered' : !hasFunding ? 'No Funds' : 'Confirm'}
            </button>
          </div>

          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
            <span>Min $5</span>
            <span>Available ${availableBalance.toFixed(2)}</span>
          </div>
        </div>
      )}


      {showSuccessModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 px-4" onClick={() => setShowSuccessModal(false)}>
          <div
            className="w-full max-w-sm rounded-2xl border border-emerald-500/30 bg-slate-950 p-4 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-400">Bet Confirmed</div>
            <div className="mt-3 text-lg font-black italic uppercase text-white">{selectedOptionLabel}</div>
            <div className="mt-1 text-sm font-bold text-slate-400">Wager ${betAmount.toFixed(2)}</div>
            <button
              onClick={() => setShowSuccessModal(false)}
              className="mt-4 w-full rounded-xl bg-white px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-black"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 px-4" onClick={() => setShowConfirmModal(false)}>
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-950 p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Confirm Bet</div>
            <div className="mt-2 text-lg font-black italic uppercase text-white">{selectedOptionLabel}</div>
            <div className="mt-1 text-sm font-black text-emerald-400">Wager ${betAmount.toFixed(2)}</div>

            <div className="mt-4">
              <label className="mb-2 block text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Enter PIN To Submit</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={betPin}
                onChange={(e) => {
                  setBetPin(e.target.value.replace(/\D/g, ''));
                  setBetPinError('');
                }}
                placeholder="0000"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-center text-2xl font-black tracking-[0.45em] text-white outline-none"
              />
              {betPinError ? <div className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] text-rose-400">{betPinError}</div> : null}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setBetPin('');
                  setBetPinError('');
                }}
                className="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={submitBetWithPin}
                className="rounded-xl bg-emerald-500 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-black"
              >
                Place Bet
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default BettingPanel;





