import React, { useEffect, useMemo, useState } from 'react';
import { TournamentProvider, useTournament } from './store';
import Login from './components/Login';
import Navbar from './components/Navbar';
import Schedule from './components/Schedule';
import Leaderboard from './components/Leaderboards';
import MyBets from './components/MyBets';
import Admin from './components/Admin';
import Teams from './components/Teams';
import BirdIcon from './components/BirdIcon';
import HawkenLogo from './components/HawkenLogo';
import PlayerCardStats, { getPlayerCardDisplayName } from './components/PlayerCardStats';
import { FORMAT_RULES } from './constants';

const ADMIN_PIN = '3370';
const ADMIN_SESSION_KEY = 'hawken_admin_authed';
const WELCOME_DISMISSED_PREFIX = 'hawken_welcome_dismissed_';
const LIVE_WELCOME_DISMISSED_KEY = 'hawken_live_welcome_dismissed';
const ACTIVE_TAB_PREFIX = 'hawken_active_tab_';
const ALERT_DISMISSED_PREFIX = 'hawken_dismissed_alerts_';
const PLAYER_TABS = ['Schedule', 'Teams', 'Leaderboard', 'Betting', 'Rules'];
const LIVE_TABS = PLAYER_TABS;
const PLAYER_CARD_PLACEHOLDER_SRC = '/images/player-card-placeholder.jpg';
const PLAYER_CARD_SRC: Record<string, string> = {
  Andrew: '/images/playercards/andrew.jpg',
  Ben: '/images/playercards/ben.jpg',
  Bobby: '/images/playercards/bobby.jpg',
  Brendan: '/images/playercards/brendan.jpg',
  Clay: '/images/playercards/clay.jpg',
  Cole: '/images/playercards/cole.jpg',
  Connor: '/images/playercards/connor.jpg',
  Eli: '/images/playercards/eli.jpg',
  Forrest: '/images/playercards/forrest.jpg',
  Hawken: '/images/playercards/hawken.jpg',
  Jack: '/images/playercards/jack.jpg',
  Jordan: '/images/playercards/jordan.jpg',
  Justin: '/images/playercards/justin.jpg',
  Kai: '/images/playercards/kai.jpg',
  Luke: '/images/playercards/luke.jpg',
  Nolan: '/images/playercards/nolan.jpg'
};

const getPlayerCardSrc = (name: string) => PLAYER_CARD_SRC[name] || PLAYER_CARD_SRC[name.split(' ')[0]] || PLAYER_CARD_PLACEHOLDER_SRC;

type DisplayAlert = {
  id: string;
  title: string;
  message: string;
  eventId: string;
  day: 1 | 2;
  createdAt: number;
};

const formatAlertGameLabel = (eventName: string, itemLabel: string) => {
  const gameMatch = itemLabel.match(/^Game\s+(\d+)$/i);
  if (!gameMatch) return itemLabel;

  const gameNumber = Number(gameMatch[1]);
  if (['Pickleball', 'Spikeball', 'Beer Dye', 'Cornhole', 'ALT SPORT 2v2'].includes(eventName)) {
    if (gameNumber >= 1 && gameNumber <= 4) return `Quarterfinal Game ${gameNumber}`;
    if (gameNumber >= 5 && gameNumber <= 6) return `Semi Final Game ${gameNumber - 4}`;
    if (gameNumber === 7) return 'Final Game';
  }

  if (['Volleyball', 'Soccer', 'Basketball', 'ALT SPORT 4v4'].includes(eventName)) {
    if (gameNumber >= 1 && gameNumber <= 2) return `Semi Final Game ${gameNumber}`;
    if (gameNumber === 3) return 'Final Game';
  }

  if (eventName === 'Baseball' && gameNumber === 1) return 'Final Game';
  return itemLabel;
};

const formatAlertSideLabel = (label: string) => {
  const pairedMatch = label.match(/^([A-Za-z]+ Team [AB]):\s*(.+)$/i);
  if (pairedMatch) return `${pairedMatch[1]} (${pairedMatch[2]})`;
  return label;
};

const AdminGate: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const [pin, setPin] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (pin !== ADMIN_PIN) {
      alert('Incorrect PIN.');
      return;
    }

    sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
    onSuccess();
  };

  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm rounded-[28px] border border-slate-800 bg-[linear-gradient(145deg,rgba(15,23,42,0.98)_0%,rgba(8,15,35,0.96)_100%)] p-6 shadow-2xl">
        <div className="mb-5 text-center">
          <HawkenLogo className="mb-4" />
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Commissioner Access</div>
          <h1 className="mt-2 text-2xl font-black italic uppercase tracking-tight text-white">Enter Admin PIN</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-center text-2xl font-black tracking-[0.35em] text-white outline-none transition focus:border-white/30"
            placeholder="0000"
          />
          <button
            type="submit"
            className="w-full rounded-2xl bg-white py-4 text-sm font-black uppercase tracking-[0.16em] text-black transition-transform active:scale-[0.98]"
          >
            Enter Admin
          </button>
        </form>
      </div>
    </div>
  );
};

const Main: React.FC = () => {
  const { currentUser, isLoading, state } = useTournament();
  const [activeTab, setActiveTab] = useState('Schedule');
  const [selectedRuleSport, setSelectedRuleSport] = useState<string | null>(null);
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const [isAdminAuthed, setIsAdminAuthed] = useState(() => sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true');
  const [showWelcome, setShowWelcome] = useState(false);
  const [showIntroCard, setShowIntroCard] = useState(false);
  const [isIntroCardOpen, setIsIntroCardOpen] = useState(false);
  const [rulesCategory, setRulesCategory] = useState<'Leaderboard' | 'Tournament' | 'Betting' | 'Sports'>('Leaderboard');
  const [scheduleFocus, setScheduleFocus] = useState<{ eventId: string; day: 1 | 2; nonce: number } | null>(null);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>([]);

  useEffect(() => {
    const syncLocation = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', syncLocation);
    return () => window.removeEventListener('popstate', syncLocation);
  }, []);

  useEffect(() => {
    [...new Set(Object.values(PLAYER_CARD_SRC))].forEach((src) => {
      const image = new Image();
      image.decoding = 'async';
      image.src = src;
    });
  }, []);

  useEffect(() => {
    if (pathname === '/live') {
      setShowWelcome(localStorage.getItem(LIVE_WELCOME_DISMISSED_KEY) !== 'true');
      setShowIntroCard(false);
      setIsIntroCardOpen(false);
      return;
    }

    if (!currentUser || pathname === '/admin') {
      setShowWelcome(false);
      setShowIntroCard(false);
      setIsIntroCardOpen(false);
      return;
    }

    setShowWelcome(localStorage.getItem(`${WELCOME_DISMISSED_PREFIX}${currentUser.id}`) !== 'true');
  }, [currentUser, pathname]);

  useEffect(() => {
    if (!currentUser || pathname === '/admin' || pathname === '/live') return;

    const savedTab = localStorage.getItem(`${ACTIVE_TAB_PREFIX}${currentUser.id}`);
    if (savedTab && PLAYER_TABS.includes(savedTab)) {
      setActiveTab(savedTab);
    }
  }, [currentUser?.id, pathname]);

  useEffect(() => {
    if (!currentUser || pathname === '/admin' || pathname === '/live' || !PLAYER_TABS.includes(activeTab)) return;

    localStorage.setItem(`${ACTIVE_TAB_PREFIX}${currentUser.id}`, activeTab);
  }, [activeTab, currentUser, pathname]);

  useEffect(() => {
    if (!showIntroCard) return;

    const raf = window.requestAnimationFrame(() => setIsIntroCardOpen(true));
    return () => window.cancelAnimationFrame(raf);
  }, [showIntroCard]);

  useEffect(() => {
    if (pathname === '/live' && !LIVE_TABS.includes(activeTab)) {
      setActiveTab('Schedule');
    }
  }, [activeTab, pathname]);

  const isAdminPath = pathname === '/admin';
  const isLivePath = pathname === '/live';
  const alertAudienceKey = isLivePath ? 'live' : currentUser?.id || 'guest';
  const alertStorageKey = `${ALERT_DISMISSED_PREFIX}${alertAudienceKey}`;

  useEffect(() => {
    try {
      setDismissedAlertIds(JSON.parse(localStorage.getItem(alertStorageKey) || '[]'));
    } catch {
      setDismissedAlertIds([]);
    }
  }, [alertStorageKey]);

  const appAlerts = useMemo<DisplayAlert[]>(() => {
    const visibleEvents = state.events.filter((event) => event.isVisible);
    const visibleEventMap = new Map<string, (typeof state.events)[number]>(visibleEvents.map((event) => [event.id, event]));
    const alerts: DisplayAlert[] = [];

    (state.appAlerts || []).forEach((manualAlert) => {
      if (manualAlert.targetPlayerId && manualAlert.targetPlayerId !== currentUser?.id) return;

      const event = visibleEventMap.get(manualAlert.eventId);
      if (!event) return;

      alerts.push({
        id: manualAlert.id,
        title: manualAlert.title || 'Event Alert',
        message: manualAlert.message,
        eventId: event.id,
        day: event.day,
        createdAt: manualAlert.createdAt
      });
    });

    state.bettableItems.forEach((item) => {
      const event = visibleEventMap.get(item.eventId);
      if (!event || item.status !== 'OPEN' || item.bettingLocked || item.options.length < 2) return;

      const itemBets = state.bets.filter((bet) => bet.bettableItemId === item.id && !bet.refunded && !bet.voided);
      const totalPool = itemBets.reduce((sum, bet) => sum + bet.amount, 0);
      const gameLabel = formatAlertGameLabel(event.name, item.label);
      const eventLabel = `${event.name} - ${gameLabel}`;
      const latestBetTime = itemBets.reduce((latest, bet) => Math.max(latest, bet.timestamp), 0);

      if (totalPool >= 50) {
        alerts.push({
          id: `auto-high-pot-${item.id}`,
          title: 'High Pot Alert',
          message: `${eventLabel} has a $${totalPool.toFixed(0)} pot building.`,
          eventId: event.id,
          day: event.day,
          createdAt: latestBetTime || Date.now()
        });
      }

      itemBets
        .filter((bet) => bet.amount >= 20)
        .forEach((bet) => {
          const selectedOption = item.options.find((option) => option.id === bet.optionId);
          const selectedSide = selectedOption ? formatAlertSideLabel(selectedOption.label) : 'one side';

          alerts.push({
            id: `auto-big-bet-${bet.id}`,
            title: 'Big Bet Alert',
            message: `Someone just placed a $${bet.amount.toFixed(0)} bet on ${selectedSide} in ${eventLabel}.`,
            eventId: event.id,
            day: event.day,
            createdAt: bet.timestamp
          });
        });

      if (totalPool >= 30) {
        const optionStats = item.options.map((option) => {
          const optionPool = itemBets
            .filter((bet) => bet.optionId === option.id)
            .reduce((sum, bet) => sum + bet.amount, 0);
          return {
            option,
            optionPool,
            percentage: totalPool > 0 ? (optionPool / totalPool) * 100 : 0
          };
        });
        const lowSide = optionStats.sort((a, b) => a.percentage - b.percentage)[0];

        if (lowSide && lowSide.percentage < 25 && lowSide.optionPool > 0) {
          const payoutReturn = (totalPool / lowSide.optionPool) * 100;
          alerts.push({
            id: `auto-underdog-${item.id}-${lowSide.option.id}`,
            title: 'High Odds Alert',
            message: `${formatAlertSideLabel(lowSide.option.label)} only has ${lowSide.percentage.toFixed(0)}% of the bets. Betting on the underdog pays out a ${payoutReturn.toFixed(0)}% return.`,
            eventId: event.id,
            day: event.day,
            createdAt: latestBetTime || Date.now()
          });
        }
      }
    });

    return alerts.sort((a, b) => b.createdAt - a.createdAt);
  }, [state.events, state.bettableItems, state.bets, state.appAlerts, currentUser?.id]);

  const dismissAlert = (alertId: string) => {
    setDismissedAlertIds((current) => {
      const next = [...new Set([...current, alertId])];
      localStorage.setItem(alertStorageKey, JSON.stringify(next));
      return next;
    });
  };

  const isCommish = isAdminPath && isAdminAuthed;
  const isAuthScreen = !currentUser && !isAdminPath && !isLivePath;
  const activeAppAlert = !isAdminPath && !isAuthScreen && !showWelcome && !showIntroCard
    ? appAlerts.find((alert) => !dismissedAlertIds.includes(alert.id))
    : undefined;

  if (isLoading) return (
    <div className="h-screen flex items-center justify-center bg-slate-950 text-slate-400 px-4">
      <div className="text-center w-full max-w-sm">
        <HawkenLogo className="mb-4" />
        <div>Loading Games...</div>
      </div>
    </div>
  );

  const handleShowRules = (sport: string) => {
    const lower = sport.toLowerCase();
    const ruleKey = lower.includes('baseball') && lower.includes('derby') ? 'baseball - HR derby' : sport;

    setSelectedRuleSport(FORMAT_RULES[ruleKey] ? ruleKey : null);
    setActiveTab('Rules');
  };

  const introCardTeam = currentUser ? state.teams.find((team) => team.playerIds.includes(currentUser.id)) : undefined;
  const introCardPlayer = currentUser ? {
    name: currentUser.name,
    teamName: introCardTeam?.name || 'The Hawken Games',
    colorHex: introCardTeam?.colorHex || '#ffffff',
    cardSrc: getPlayerCardSrc(currentUser.name)
  } : null;

  const handleDismissWelcome = () => {
    if (isLivePath) {
      localStorage.setItem(LIVE_WELCOME_DISMISSED_KEY, 'true');
    } else if (currentUser) {
      localStorage.setItem(`${WELCOME_DISMISSED_PREFIX}${currentUser.id}`, 'true');
    }
    setShowWelcome(false);
    if (!isLivePath && introCardPlayer) {
      setShowIntroCard(true);
    }
  };

  const handleCloseIntroCard = () => {
    setIsIntroCardOpen(false);
    window.setTimeout(() => setShowIntroCard(false), 220);
  };

  const renderContent = () => {
    if (isAdminPath && !isAdminAuthed) return <AdminGate onSuccess={() => setIsAdminAuthed(true)} />;
    if (isCommish) return <Admin />;
    if (!currentUser && !isLivePath) return <Login />;

    switch (activeTab) {
      case 'Schedule': return <Schedule onShowRules={handleShowRules} focusEvent={scheduleFocus} />;
      case 'Teams': return <Teams />;
      case 'Leaderboard': return <Leaderboard />;
      case 'Betting': return <MyBets />;
      case 'Rules': {
        const selectedRule = selectedRuleSport ? FORMAT_RULES[selectedRuleSport] : null;
        const visibleSportNames = new Set(state.events.filter((event) => event.isVisible).map((event) => event.id === 'e9' ? 'baseball - HR derby' : event.name));
        const allRuleSports = ['Golf', ...Object.keys(FORMAT_RULES).filter((sport) => sport !== 'Golf')].filter((sport) => visibleSportNames.has(sport));
        const visibleSports = selectedRuleSport && selectedRule ? [selectedRuleSport] : allRuleSports;

        return (
          <div className="space-y-6 px-3 py-4 pb-24 animate-in fade-in duration-500">
            {selectedRule && (
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setSelectedRuleSport(null);
                    setActiveTab('Schedule');
                  }}
                  className="text-[10px] font-black uppercase tracking-widest text-slate-500 border border-slate-800 px-2 py-1 rounded"
                >
                  Back to Schedule
                </button>
              </div>
            )}

            <div className="space-y-8">
              {!selectedRule && (
                <>
                  <div className="relative grid grid-cols-4 gap-1.5 rounded-2xl border border-slate-800 bg-slate-900/75 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                    {!['Leaderboard', 'Tournament'].includes(rulesCategory) && (
                      <div className="pointer-events-none absolute bottom-3 left-1/4 top-3 w-px -translate-x-1/2 bg-white/10" />
                    )}
                    {!['Tournament', 'Sports'].includes(rulesCategory) && (
                      <div className="pointer-events-none absolute bottom-3 left-1/2 top-3 w-px -translate-x-1/2 bg-white/10" />
                    )}
                    {!['Sports', 'Betting'].includes(rulesCategory) && (
                      <div className="pointer-events-none absolute bottom-3 left-3/4 top-3 w-px -translate-x-1/2 bg-white/10" />
                    )}
                    {[
                      { id: 'Leaderboard', lines: ['Leaderboard', 'Scoring'] },
                      { id: 'Tournament', lines: ['Tournament', 'Rules'] },
                      { id: 'Sports', lines: ['Sports', 'Rules'] },
                      { id: 'Betting', lines: ['Betting', 'Rules'] }
                    ].map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => setRulesCategory(category.id as 'Leaderboard' | 'Tournament' | 'Betting' | 'Sports')}
                        className={`relative z-10 rounded-xl py-4 text-[9px] font-black uppercase leading-tight tracking-[0.06em] transition-all ${
                          rulesCategory === category.id ? 'bg-white text-black shadow-lg' : 'text-slate-500'
                        }`}
                      >
                        <span className="block">{category.lines[0]}</span>
                        <span className="block">{category.lines[1]}</span>
                      </button>
                    ))}
                  </div>

                  {rulesCategory === 'Leaderboard' && (
                  <section className="space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 border-b border-slate-800 pb-1">Leaderboard Scoring</h3>
                    <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-4 text-[11px] leading-relaxed text-slate-400">
                      <div>
                        <h4 className="mb-1 text-[10px] font-black uppercase tracking-widest text-emerald-500">Team Leaderboard</h4>
                        <p>The Team Leaderboard tracks overall event wins. When a team wins a completed event, that team earns 1 point.</p>
                      </div>

                      <div>
                        <h4 className="mb-1 text-[10px] font-black uppercase tracking-widest text-emerald-500">Individual Leaderboard</h4>
                        <p>The Individual Leaderboard tracks <span className="font-bold text-white">player wins across games</span>, not overall team points.</p>
                        <p className="mt-2">This means a player can be high on the Individual Leaderboard even if their team is not leading overall. A player may win multiple games inside bracket events even if their team loses other events.</p>
                      </div>

                      <div>
                        <h4 className="mb-1 text-[10px] font-black uppercase tracking-widest text-emerald-500">How Individual Wins Are Awarded</h4>
                        <ul className="space-y-2">
                          <li>For 2v2 tournament games, the two players on the winning pair each receive 1 individual win.</li>
                          <li>For full-team tournament games, every player on the winning team receives 1 individual win.</li>
                          <li>Aggregate events are team scoring events only. They award points on the Team Leaderboard, but they <span className="font-bold text-white">do not add individual wins</span>.</li>
                        </ul>
                      </div>
                    </div>
                  </section>
                  )}

                  {rulesCategory === 'Tournament' && (
                  <section className="space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 border-b border-slate-800 pb-1">Tournament Rules</h3>
                    <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-4 text-[11px] leading-relaxed text-slate-400">
                      <div>
                        <h4 className="mb-1 text-[10px] font-black uppercase tracking-widest text-emerald-500">Full-Team Tournaments</h4>
                        <p>Full-team tournament events use a simple four-team bracket with two semifinal games and one final game.</p>
                        <p className="mt-2">The winner of each semifinal advances to the final. The winner of the final wins the event and earns 1 point for their team.</p>
                      </div>

                      <div>
                        <h4 className="mb-1 text-[10px] font-black uppercase tracking-widest text-emerald-500">2v2 Tournaments</h4>
                        <p>2v2 tournament events use an eight-pair bracket and starts in the quarterfinals. The quarterfinal pairs are <span className="font-bold text-white">fixed before the event starts</span>, and the app shows the exact pairings on the Schedule.</p>
                        <p className="mt-2">Because each team has two pair entries, both pairs from the same team may win their quarterfinal games and face each other in the semifinal.</p>
                        <p className="mt-2">This is expected. The bracket is arranged so the <span className="font-bold text-white">final will always be between two different teams</span>. Betting will be locked for semifinal matchups in 2v2 tournaments, but betting for the final matchups will automatically open when the scores are entered for the semis.</p>
                        <p className="mt-2">For semifinals and finals, <span className="font-bold text-white">teams may choose which players they want to send into the matchup</span>. Because of that, the app may show only the team name for those later rounds until the commissioner enters the result.</p>
                        <p className="mt-2">When the commissioner enters a semifinal or final result, they select which two players from the winning team receive the individual win.</p>
                      </div>

                    </div>
                  </section>
                  )}

                  {rulesCategory === 'Betting' && (
                  <section className="space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 border-b border-slate-800 pb-1">Betting Rules</h3>
                    <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">

                    <div className="space-y-3">
                      <div className="space-y-3 text-[11px] text-slate-400 leading-relaxed">
                        <p>
                          The Hawken Games uses a <span className="text-white font-bold italic">parimutuel system</span>, meaning players bet against each other and payouts come from the total money in the pool.
                        </p>
                        <p>
                          Each game has its own betting pool. Players can place one bet per game with a minimum bet of $5 on the side they think will win.
                        </p>
                        <p>
                          After the game ends, the entire pool is split among the people who bet on the winning team. Your payout depends on how much of the pool was bet on that team.
                        </p>
                        <p>
                          If nobody bets against your side, the bet is <span className="font-bold text-white">void</span>. Your wager is returned to your bankroll and it does not count as a win or loss.
                        </p>
                        <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-3 space-y-3">
                          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Example</div>
                          <p>
                            You bet <span className="font-bold text-white">$5 on Red Team</span>.
                          </p>
                          <p>
                            Everyone combined bets <span className="font-bold text-white">$60</span> on the game. Only <span className="font-bold text-white">$15</span> of that was bet on Red Team.
                          </p>
                          <p>
                            If <span className="font-bold text-white">Red Team wins</span>, the full <span className="font-bold text-white">$60 pool</span> is paid out to the people who bet on Red Team.
                          </p>
                          <p>
                            Your <span className="font-bold text-white">$5 bet</span> was one-third of all Red Team bets, so you get one-third of the <span className="font-bold text-white">$60 pool</span>.
                          </p>
                          <p>
                            Your payout would be <span className="font-bold text-emerald-400">$20</span>.
                          </p>
                        </div>
                        <p>
                          Your bankroll updates automatically when results are entered.
                        </p>
                        <p>
                          The Betting Leaderboard is ranked by <span className="font-bold text-white">total profit</span>, not current bankroll or number of bets won. Profit only counts settled bets that paid out. Voided bets do not count.
                        </p>
                        <p>
                          At the end of the weekend, the commissioner will Venmo each player their <span className="font-bold text-white">final bankroll amount</span>. Your final bankroll is the amount you cash out with.
                        </p>
                      </div>
                    </div>
                  </div>
                  </section>
                  )}
                </>
              )}

              {(selectedRule || rulesCategory === 'Sports') && (
              <section className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 border-b border-slate-800 pb-1">Sports Rules</h3>
                <div className="space-y-4">
                  {visibleSports.map((sport) => {
                    const ruleSet = FORMAT_RULES[sport];
                    return (
                      <div key={sport} className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                        <div className="space-y-1 mb-3">
                          <h4 className="text-sm font-black uppercase italic text-emerald-500">{sport}</h4>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{ruleSet.style}</p>
                        </div>
                        <ul className="space-y-2">
                          {ruleSet.rules.map((rule, ridx) => (
                            <li key={ridx} className="flex items-start space-x-2">
                              <div className="w-1 h-1 bg-slate-600 rounded-full mt-1.5 flex-shrink-0" />
                              <p className="text-[11px] text-slate-400 font-medium leading-tight">{rule}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </section>
              )}
            </div>
          </div>
        );
      }
      default: return <Schedule onShowRules={handleShowRules} />;
    }
  };

  return (
    <div className="flex h-[100svh] flex-col max-w-screen-sm mx-auto bg-slate-950 shadow-2xl">
      {(currentUser || isLivePath) && !isCommish && !isAdminPath && (
        <header className="py-3 px-3 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-slate-950/80 backdrop-blur-md z-50">
          <div className="flex items-center gap-1 min-w-0">
            <BirdIcon size={40} className="mr-2 ml-1" />
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-black tracking-tight uppercase italic text-white leading-tight whitespace-nowrap">The Hawken Games</h1>
              <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5 whitespace-nowrap ml-1.5">Invitational Tournament</p>
            </div>
          </div>
          {isLivePath || currentUser ? (
            <button
              type="button"
              onClick={() => setActiveTab('Betting')}
              className="pl-3 shrink-0 flex flex-col items-center text-center transition-transform active:scale-95"
              aria-label="Open betting tab"
            >
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">My Bankroll</div>
              <div className="text-lg sm:text-xl font-black text-emerald-400 leading-tight">${(currentUser?.balance || 0).toFixed(2)}</div>
            </button>
          ) : null}
        </header>
      )}

      <main className={isAuthScreen ? 'flex-1 overflow-hidden' : activeTab === 'Teams' && !isAdminPath ? 'flex-1 overflow-hidden pb-[calc(5.5rem+env(safe-area-inset-bottom))]' : activeTab === 'Leaderboard' && !isAdminPath ? 'flex-1 overflow-hidden' : `flex-1 overflow-y-auto overscroll-y-contain ${isAdminPath ? '' : 'pb-24'}`}>
        {renderContent()}
      </main>

      {(currentUser || isLivePath) && !isCommish && !isAdminPath && (
        <Navbar activeTab={activeTab} setActiveTab={setActiveTab} tabs={isLivePath ? LIVE_TABS : PLAYER_TABS} />
      )}

      {activeAppAlert && (
        <div className="fixed inset-0 z-[115] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[28px] border border-amber-400/30 bg-[linear-gradient(145deg,rgba(15,23,42,0.98)_0%,rgba(2,6,23,0.98)_100%)] p-5 text-center shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-amber-400 text-xl font-black text-black">
              !
            </div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">{activeAppAlert.title}</div>
            <p className="mt-3 text-lg font-black uppercase leading-tight text-white">{activeAppAlert.message}</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => dismissAlert(activeAppAlert.id)}
                className="rounded-2xl border border-slate-700 bg-slate-950 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-300"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => {
                  dismissAlert(activeAppAlert.id);
                  setSelectedRuleSport(null);
                  setActiveTab('Schedule');
                  setScheduleFocus({ eventId: activeAppAlert.eventId, day: activeAppAlert.day, nonce: Date.now() });
                }}
                className="rounded-2xl bg-white py-3 text-[10px] font-black uppercase tracking-[0.16em] text-black"
              >
                View Event
              </button>
            </div>
          </div>
        </div>
      )}

      {showWelcome && (currentUser || isLivePath) && !isCommish && !isAdminPath && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/92 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-slate-700 bg-[linear-gradient(145deg,rgba(15,23,42,0.98)_0%,rgba(2,6,23,0.98)_100%)] p-5 shadow-2xl">
            <div className="mb-4 text-center">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">Welcome{currentUser ? `, ${currentUser.name}` : ''}</div>
                <h2 className="mt-1 text-2xl font-black italic uppercase leading-tight text-white">The Hawken Games</h2>
              </div>
            </div>

            <div className="space-y-3 text-center text-[12px] font-medium leading-relaxed text-slate-300">
              <p>
                This app is your homebase for the weekend. Use it to preview events, matchups, team rosters, leaderboards, and place bets.
              </p>

              <p>
                When the commissioner enters game results, betting bankrolls and leaderboards update automatically.
              </p>

              <p>
                Head over to the <span className="font-black text-white">Rules</span> tab to learn more about the events, scoring, and betting.
              </p>
            </div>

            <button
              type="button"
              onClick={handleDismissWelcome}
              className="mt-5 w-full rounded-2xl bg-white py-4 text-[12px] font-black uppercase tracking-[0.16em] text-black transition-transform active:scale-[0.98]"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {showIntroCard && introCardPlayer && !isCommish && !isAdminPath && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/92 p-4 backdrop-blur-sm transition-opacity duration-200"
          style={{ opacity: isIntroCardOpen ? 1 : 0 }}
        >
          <div
            className="w-full max-w-md transition-opacity duration-200"
            style={{ opacity: isIntroCardOpen ? 1 : 0.12, perspective: '1400px' }}
          >
            <div
              className="relative aspect-[4/5] w-full transition-transform duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{
                transformStyle: 'preserve-3d',
                transform: isIntroCardOpen ? 'rotateY(0deg) scale(1)' : 'rotateY(180deg) scale(0.92)'
              }}
            >
              <div
                className="absolute inset-0 overflow-hidden rounded-[22px] border-2 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
                style={{
                  borderColor: introCardPlayer.colorHex,
                  boxShadow: `0 0 0 1px ${introCardPlayer.colorHex}55, 0 20px 60px rgba(0,0,0,0.45)`,
                  background: `linear-gradient(135deg, ${introCardPlayer.colorHex}EE 0%, ${introCardPlayer.colorHex}88 45%, rgba(15,23,42,0.96) 100%)`,
                  transform: 'rotateY(180deg)',
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden'
                }}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.22),rgba(255,255,255,0)_45%)]" />
                <div className="relative flex h-full flex-col items-center justify-center px-6 text-center text-white">
                  <div className="text-[10px] font-black uppercase tracking-[0.28em] text-white/75">The Hawken Games</div>
                  <div className="mt-4 text-4xl font-black italic uppercase leading-none text-white">{getPlayerCardDisplayName(introCardPlayer.name)}</div>
                  <div className="mt-3 text-sm font-black uppercase tracking-[0.22em]">{introCardPlayer.teamName}</div>
                </div>
              </div>

              <div
                className="absolute inset-0 overflow-hidden rounded-[22px] border-2 bg-slate-950 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
                style={{
                  borderColor: introCardPlayer.colorHex,
                  boxShadow: `0 0 0 1px ${introCardPlayer.colorHex}55, 0 20px 60px rgba(0,0,0,0.45)`,
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden'
                }}
              >
                <img
                  src={introCardPlayer.cardSrc}
                  alt={`${introCardPlayer.name} player card`}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>

            <div
              className="mt-3 text-center transition-opacity duration-200"
              style={{ opacity: isIntroCardOpen ? 1 : 0 }}
            >
              <div
                className="text-lg font-black italic uppercase tracking-tight text-white"
                style={{ textShadow: '0 2px 14px rgba(255,255,255,0.14), 0 2px 10px rgba(0,0,0,0.65)' }}
              >
                {getPlayerCardDisplayName(introCardPlayer.name)}
              </div>
              <div
                className="text-[11px] font-black uppercase tracking-[0.18em]"
                style={{ color: introCardPlayer.colorHex }}
              >
                {introCardPlayer.teamName}
              </div>
              <PlayerCardStats playerName={introCardPlayer.name} colorHex={introCardPlayer.colorHex} />
            </div>

            <button
              type="button"
              onClick={handleCloseIntroCard}
              className="mt-5 w-full rounded-2xl bg-white py-4 text-[12px] font-black uppercase tracking-[0.16em] text-black transition-transform active:scale-[0.98]"
            >
              Enter Games
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <TournamentProvider>
      <Main />
    </TournamentProvider>
  );
};

export default App;





