'use client';
import React, { useEffect, useState } from 'react';
import { User } from '../types';
import { Game } from '@/types';
import { formatDistanceToNow, format } from 'date-fns';
import PlayerProfile from './PlayerProfile';

interface GameHistoryProps {
  seasonId: string;
  refreshKey?: number;
}

// TODO: Replace with real user context
const ADMIN_PHONES = ['+15856831831', '+15856831234'];
function isAdmin() {
  // Replace with real auth context
  if (typeof window !== 'undefined') {
    const userPhone = window.localStorage.getItem('phoneNumber');
    return ADMIN_PHONES.includes(userPhone || '');
  }
  return false;
}

type GameWithStreakBonuses = Omit<Game, 'team1' | 'team2'> & {
  team1: Game['team1'] & { streakBonuses?: Record<string, number> };
  team2: Game['team2'] & { streakBonuses?: Record<string, number> };
};

export default function GameHistory({ seasonId, refreshKey }: GameHistoryProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [showCount, setShowCount] = useState(3);
  const [selectedPlayer, setSelectedPlayer] = useState<User | null>(null);
  const [tooltipPlayer, setTooltipPlayer] = useState<{gameId: string, playerId: string} | null>(null);
  const [infoGameId, setInfoGameId] = useState<string | null>(null);

  // Close info popup on outside click
  React.useEffect(() => {
    if (!infoGameId) return;
    function handleClick(e: MouseEvent) {
      // Only close if click is outside any .game-info-popup or .game-info-btn
      const target = e.target as HTMLElement;
      if (!target.closest('.game-info-popup') && !target.closest('.game-info-btn')) {
        setInfoGameId(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [infoGameId]);

  useEffect(() => {
    const fetchGames = async () => {
      if (!seasonId) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/seasons/${seasonId}/games`);
        if (!response.ok) {
          throw new Error('Failed to fetch games');
        }
        const data = await response.json();
        setGames(data || []);

        // Fetch users
        const usersResponse = await fetch('/api/users');
        if (!usersResponse.ok) {
          throw new Error('Failed to fetch users');
        }
        const usersData = await usersResponse.json();
        if (!Array.isArray(usersData)) {
          throw new Error('Invalid users data format');
        }
        setUsers(usersData);
        setError(null);
      } catch (error) {
        console.error('Error fetching games:', error);
        setError(error instanceof Error ? error.message : 'Failed to fetch games');
      } finally {
        setLoading(false);
      }
    };

    fetchGames();
  }, [seasonId, refreshKey, refresh]);

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user?.displayName || 'Unknown Player';
  };

  const formatGameTime = (gameTime: any) => {
    if (!gameTime) return null;
    try {
      const date = new Date(gameTime);
      return {
        full: format(date, 'MMM d, yyyy h:mm a'),
        relative: formatDistanceToNow(date, { addSuffix: true })
      };
    } catch (e) {
      return null;
    }
  };

  const handleDelete = async (gameId: string) => {
    if (!window.confirm('Are you sure you want to delete this game?')) return;
    const token = window.localStorage.getItem('authToken');
    const res = await fetch(`/api/games/${gameId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setRefresh(r => r + 1);
    else alert('Failed to delete game');
  };

  const handleEdit = async (game: any) => {
    const token = window.localStorage.getItem('authToken');
    const newScore1 = window.prompt('New score for Team 1?', game.team1.score);
    const newScore2 = window.prompt('New score for Team 2?', game.team2.score);
    if (newScore1 === null || newScore2 === null) return;
    const updatedTeam1 = { ...game.team1, score: parseInt(newScore1, 10) };
    const updatedTeam2 = { ...game.team2, score: parseInt(newScore2, 10) };
    const res = await fetch(`/api/games/${game.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        team1: updatedTeam1,
        team2: updatedTeam2,
      }),
    });
    if (res.ok) setRefresh(r => r + 1);
    else alert('Failed to edit game');
  };

  if (loading) {
    return null;
  }

  if (error) {
    return (
      <div className="card bg-red-50 border-l-4 border-red-400 p-4">
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  if (!Array.isArray(games) || games.length === 0) {
    return (
      <div className="card space-y-4">
        <h3 className="text-xl font-semibold">Recent Games</h3>
        <p className="text-gray-500">No games have been played yet in this season.</p>
      </div>
    );
  }

  // --- HOT STREAK LOGIC ---
  // Build a map: { [gameId]: { [playerId]: streakCountIf3OrMore } }
  const streaksByGame: Record<string, Record<string, number>> = {};
  const streaks: Record<string, number> = {};
  // Sort games oldest to newest
  const gamesChrono = [...games].sort((a, b) => new Date(a.gameTime).getTime() - new Date(b.gameTime).getTime());
  for (const game of gamesChrono) {
    const team1Won = game.team1.score > game.team2.score;
    const team2Won = game.team2.score > game.team1.score;
    const winner = team1Won ? game.team1 : game.team2;
    const loser = team1Won ? game.team2 : game.team1;
    streaksByGame[game.id] = {};
    // Winners: increment streak
    for (const p of winner.players) {
      const pid = typeof p === 'string' ? p : p.id;
      streaks[pid] = (streaks[pid] || 0) + 1;
      if (streaks[pid] >= 3) {
        streaksByGame[game.id][pid] = streaks[pid];
      }
    }
    // Losers: reset streak
    for (const p of loser.players) {
      const pid = typeof p === 'string' ? p : p.id;
      streaks[pid] = 0;
    }
  }
  // --- END HOT STREAK LOGIC ---

  return (
    <div className="card space-y-4 dark:bg-gray-800">
      <h3 className="text-xl font-semibold">Game History</h3>
      <div className="space-y-4">
        {games.slice(0, showCount).map((gameOrig) => {
          const game = gameOrig as GameWithStreakBonuses;
          const gameTime = formatGameTime(game.gameTime);
          const team1Won = game.team1.score > game.team2.score;
          const team2Won = game.team2.score > game.team1.score;

          // Determine winner and loser for display
          const winner = team1Won ? game.team1 : game.team2;
          const loser = team1Won ? game.team2 : game.team1;
          const winnerScore = team1Won ? game.team1.score : game.team2.score;
          const loserScore = team1Won ? game.team2.score : game.team1.score;
          const winnerTrophy = team1Won ? team1Won : team2Won;

          // Collect all streak bonuses for this game
          const allBonuses: { playerId: string, bonus: number }[] = [];
          if (game.team1?.streakBonuses) {
            Object.entries(game.team1.streakBonuses).forEach(([pid, bonus]) => {
              if (bonus > 0) allBonuses.push({ playerId: pid, bonus });
            });
          }
          if (game.team2?.streakBonuses) {
            Object.entries(game.team2.streakBonuses).forEach(([pid, bonus]) => {
              if (bonus > 0) allBonuses.push({ playerId: pid, bonus });
            });
          }
          const showInfo = allBonuses.length > 0;

          // Helper to render player name as clickable, stacked first/last name, with hot streak below and streak bonus tooltip
          const renderPlayerName = (p: User | string, gameId: string) => {
            const id = typeof p === 'string' ? p : p.id;
            const userObj = users.find(u => u.id === id);
            const displayName = typeof p === 'string' ? getUserName(p) : p.displayName;
            const streak = streaksByGame[gameId]?.[id];
            // Check for streak bonus
            let streakBonus = 0;
            if (game.team1?.streakBonuses && game.team1.streakBonuses[id] && game.team1.streakBonuses[id] > 0) {
              streakBonus = game.team1.streakBonuses[id] || 0;
            } else if (game.team2?.streakBonuses && game.team2.streakBonuses[id] && game.team2.streakBonuses[id] > 0) {
              streakBonus = game.team2.streakBonuses[id] || 0;
            }
            // Split name into first and last (handles middle names)
            const [firstName, ...rest] = displayName.split(' ');
            const lastName = rest.join(' ');
            return (
              <button
                key={id}
                className="hover:underline font-medium px-0.5 flex flex-col items-center"
                onClick={() => userObj && setSelectedPlayer(userObj)}
                type="button"
              >
                <span>{firstName}</span>
                <span>{lastName}</span>
                {streak && (
                  <span
                    className="mt-0.5 text-orange-500 flex items-center text-xs font-bold align-middle relative cursor-pointer"
                    onMouseEnter={() => setTooltipPlayer({gameId, playerId: id})}
                    onMouseLeave={() => setTooltipPlayer(null)}
                    onFocus={() => setTooltipPlayer({gameId, playerId: id})}
                    onBlur={() => setTooltipPlayer(null)}
                    tabIndex={0}
                  >
                    🔥<span className="ml-0.5">{streak}</span>
                    {streakBonus > 0 && tooltipPlayer && tooltipPlayer.gameId === gameId && tooltipPlayer.playerId === id && (
                      <span className="absolute left-1/2 -translate-x-1/2 mt-6 px-2 py-1 bg-gray-800 text-white text-xs rounded shadow z-50 whitespace-nowrap">
                        +{streakBonus} streak bonus ELO
                      </span>
                    )}
                  </span>
                )}
              </button>
            );
          };

          // Helper to render a team as a flex row with & centered
          const renderTeam = (players: (User | string)[], gameId: string) => (
            <div className="flex flex-row items-center gap-2">
              {players.map((p, i) => (
                <React.Fragment key={typeof p === 'string' ? p : p.id}>
                  {renderPlayerName(p, gameId)}
                  {i < players.length - 1 && <span className="mx-1 font-bold text-lg">&</span>}
                </React.Fragment>
              ))}
            </div>
          );

          return (
            <div key={game.id} className="border rounded-lg p-4 bg-white dark:bg-gray-900 shadow-sm relative border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  {/* Winner on top, loser below */}
                  <div className="flex flex-col items-center">
                    <div className={'font-bold text-green-700 flex items-center mb-1'}>
                      <span className="mr-1">🏆</span>
                      {renderTeam(winner.players, game.id)}
                    </div>
                    <div className="my-1 text-xs text-gray-500 dark:text-gray-300 flex items-center">
                      <span className="mx-2">Score: {winnerScore} - {loserScore}</span>
                      <span className="mx-2 text-gray-300 dark:text-gray-600">|</span>
                      <span className="mx-2 text-gray-400 dark:text-gray-400">±{game.eloChange} ELO</span>
                    </div>
                    <div className={'font-medium mt-1'}>
                      {renderTeam(loser.players, game.id)}
                    </div>
                  </div>
                  {game.recordedBy?.name && (
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Recorded by {game.recordedBy.name}
                    </div>
                  )}
                </div>
                {isAdmin() && (
                  <div className="flex flex-col gap-2 ml-4">
                    <button className="text-xs text-blue-600 hover:underline" onClick={() => handleEdit(game)}>Edit</button>
                    <button className="text-xs text-red-600 hover:underline" onClick={() => handleDelete(game.id)}>Delete</button>
                  </div>
                )}
              </div>
              {gameTime && (
                <div className="absolute bottom-2 left-4 text-[10px] text-gray-400 dark:text-gray-500 text-left">
                  {gameTime.full}
                  <span className="ml-1">({gameTime.relative})</span>
                </div>
              )}
              {/* Info icon for streak bonus */}
              {showInfo && (
                <div className="absolute top-2 right-2 z-10">
                  <button
                    className="w-4 h-4 flex items-center justify-center rounded-full border border-gray-300 dark:border-gray-500 bg-white/80 dark:bg-gray-900/60 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 text-[10px] font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400 game-info-btn"
                    style={{ lineHeight: '1', padding: 0 }}
                    onClick={e => {
                      e.stopPropagation();
                      setInfoGameId(infoGameId === game.id ? null : game.id);
                    }}
                    aria-label="Show streak bonus info"
                  >
                    <span style={{fontWeight: 700, fontFamily: 'inherit'}}>i</span>
                  </button>
                  {infoGameId === game.id && (
                    <div className="absolute right-0 mt-2 w-max min-w-[180px] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded shadow-lg p-3 text-xs z-50 game-info-popup">
                      <div className="font-semibold mb-1 text-gray-700 dark:text-gray-200">Streak Bonus ELO</div>
                      {allBonuses.map(({ playerId, bonus }) => {
                        const user = users.find(u => u.id === playerId);
                        return (
                          <div key={playerId} className="mb-1 last:mb-0 text-gray-800 dark:text-gray-100">
                            {user ? user.displayName : playerId}: <span className="text-green-600 font-bold">+{bonus}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {games.length > showCount && (
          <button
            onClick={() => setShowCount(showCount + 3)}
            className="text-xs text-blue-600 mt-2"
          >
            See more
          </button>
        )}
      </div>
      {selectedPlayer && (
        <PlayerProfile
          player={selectedPlayer}
          seasonId={seasonId}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
} 