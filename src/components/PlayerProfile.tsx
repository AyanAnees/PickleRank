import { useState, useEffect } from 'react';
import { User, Game } from '@/types';

interface PlayerProfileProps {
  player: User;
  seasonId: string;
  onClose: () => void;
}

interface PlayerStats {
  headToHead: {
    [opponentId: string]: {
      wins: number;
      losses: number;
      games: number;
    };
  };
  partners: {
    [partnerId: string]: {
      wins: number;
      losses: number;
      games: number;
    };
  };
}

// Tooltip component
function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative ml-1">
      <button
        type="button"
        className="text-gray-400 hover:text-gray-600 focus:outline-none"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        aria-label="Info"
      >
        <svg className="inline w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0-4h.01" />
        </svg>
      </button>
      {show && (
        <div className="absolute z-50 left-1/2 -translate-x-1/2 mt-2 w-56 p-2 bg-white border border-gray-200 rounded shadow text-xs text-gray-700">
          {text}
        </div>
      )}
    </span>
  );
}

export default function PlayerProfile({ player, seasonId, onClose }: PlayerProfileProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<PlayerStats>({ headToHead: {}, partners: {} });
  const [loading, setLoading] = useState(true);
  const [hotStreaks, setHotStreaks] = useState<{ max: number; current: number }>({ max: 0, current: 0 });

  useEffect(() => {
    const fetchGamesAndUsers = async () => {
      try {
        const [gamesRes, usersRes] = await Promise.all([
          fetch(`/api/seasons/${seasonId}/games`),
          fetch('/api/users'),
        ]);
        if (!gamesRes.ok) throw new Error('Failed to fetch games');
        if (!usersRes.ok) throw new Error('Failed to fetch users');
        const gamesData = await gamesRes.json();
        const usersData = await usersRes.json();
        setGames(gamesData || []);
        setUsers(usersData || []);
        
        // Calculate stats
        const newStats: PlayerStats = { headToHead: {}, partners: {} };
        
        gamesData.forEach((game: Game) => {
          const isTeam1 = game.team1.players.some((p: any) => p.id === player.id);
          const isTeam2 = game.team2.players.some((p: any) => p.id === player.id);
          if (!isTeam1 && !isTeam2) return;

          const playerTeam = isTeam1 ? game.team1 : game.team2;
          const opponentTeam = isTeam1 ? game.team2 : game.team1;
          const won = (isTeam1 && game.team1.score > game.team2.score) || 
                     (isTeam2 && game.team2.score > game.team1.score);

          // Update head-to-head stats
          opponentTeam.players.forEach((opponent: any) => {
            if (!newStats.headToHead[opponent.id]) {
              newStats.headToHead[opponent.id] = { wins: 0, losses: 0, games: 0 };
            }
            newStats.headToHead[opponent.id].games++;
            if (won) newStats.headToHead[opponent.id].wins++;
            else newStats.headToHead[opponent.id].losses++;
          });

          // Update partner stats
          playerTeam.players.forEach((partner: any) => {
            if (partner.id === player.id) return;
            if (!newStats.partners[partner.id]) {
              newStats.partners[partner.id] = { wins: 0, losses: 0, games: 0 };
            }
            newStats.partners[partner.id].games++;
            if (won) newStats.partners[partner.id].wins++;
            else newStats.partners[partner.id].losses++;
          });
        });

        setStats(newStats);

        // --- HOT STREAK LOGIC ---
        // Sort games oldest to newest
        const gamesChrono = [...gamesData].sort((a, b) => new Date(a.gameTime).getTime() - new Date(b.gameTime).getTime());
        let currentStreak = 0;
        let maxStreak = 0;
        for (const game of gamesChrono) {
          const isTeam1 = game.team1.players.some((p: any) => p.id === player.id);
          const isTeam2 = game.team2.players.some((p: any) => p.id === player.id);
          if (!isTeam1 && !isTeam2) continue;
          const won = (isTeam1 && game.team1.score > game.team2.score) || 
                     (isTeam2 && game.team2.score > game.team1.score);
          if (won) {
            currentStreak++;
            if (currentStreak > maxStreak) maxStreak = currentStreak;
          } else {
            currentStreak = 0;
          }
        }
        setHotStreaks({ max: maxStreak, current: currentStreak });
        // --- END HOT STREAK LOGIC ---

      } catch (error) {
        console.error('Error fetching games or users:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGamesAndUsers();
  }, [player.id, seasonId]);

  // Helper to get display name from user ID
  const getDisplayName = (id: string) => {
    return users.find(u => u.id === id)?.displayName || id;
  };

  // Find all nemeses (players who beat them most by margin, only if you have actually lost to them)
  const nemesisEntries = Object.entries(stats.headToHead)
    .filter(([, record]) => record.losses > 0);

  let nemesisList: [string, typeof nemesisEntries[0][1]][] = [];
  if (nemesisEntries.length > 0) {
    const maxNemesisScore = Math.max(...nemesisEntries.map(([, r]) => r.losses - r.wins));
    const maxScoreEntries = nemesisEntries.filter(([, r]) => (r.losses - r.wins) === maxNemesisScore);
    if (maxScoreEntries.length > 0) {
      const maxGames = Math.max(...maxScoreEntries.map(([, r]) => r.games));
      nemesisList = maxScoreEntries.filter(([, r]) => r.games === maxGames);
    }
  }

  // Find all best partners (highest win rate, min 1 game, tiebreaker: most games played)
  const partnerEntries = Object.entries(stats.partners).filter(([, r]) => r.games > 0);
  let bestPartnerList: [string, typeof partnerEntries[0][1]][] = [];
  if (partnerEntries.length > 0) {
    const maxWinRate = Math.max(...partnerEntries.map(([, r]) => r.wins / r.games));
    const maxRateEntries = partnerEntries.filter(([, r]) => (r.wins / r.games) === maxWinRate);
    if (maxRateEntries.length > 0) {
      const maxGames = Math.max(...maxRateEntries.map(([, r]) => r.games));
      bestPartnerList = maxRateEntries.filter(([, r]) => r.games === maxGames);
    }
  }

  // Calculate win rate for the season
  const seasonStats = player.seasonStats?.[seasonId];
  const wins = seasonStats?.wins || 0;
  const losses = seasonStats?.losses || 0;
  const gamesPlayed = seasonStats?.gamesPlayed || 0;
  const winRate = gamesPlayed > 0 ? (wins / gamesPlayed) : 0;
  const winRatePercent = (winRate * 100).toFixed(0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 dark:text-gray-100 rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold">{player.displayName}</h2>
            <div className="flex items-center gap-4 mt-1 mb-2">
              <div className="flex flex-col">
                {hotStreaks.current >= 3 && (
                  <span className="text-orange-500 text-xs font-semibold flex items-center mb-1">🔥 Currently on a win streak: {hotStreaks.current} games</span>
                )}
                <span className="text-orange-400 text-xs font-semibold flex items-center">
                  Longest win streak: {hotStreaks.max} games
                </span>
              </div>
            </div>
            <div className="text-sm text-gray-400 dark:text-gray-400 font-semibold mt-1 mb-2 tracking-wide uppercase">Season Stats</div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded font-semibold">Win Rate: {winRatePercent}%</span>
              <span className="text-xs text-gray-500 dark:text-gray-300">({wins}W / {losses}L)</span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        {loading ? (
          <div className="text-center py-4">Loading stats...</div>
        ) : (
          <div className="space-y-6">
            {/* Fun Stats (moved to top) */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              {nemesisList.length > 0 && (
                <div className="p-3 bg-red-50 dark:bg-red-700/20 dark:text-red-200 rounded">
                  <div className="flex items-center mb-1">
                    <h4 className="font-medium text-red-700">Nemesis</h4>
                    <InfoTooltip text="Your Nemesis is the player who has beaten you by the largest margin (losses minus wins) this season. If there is a tie, the tiebreaker is the number of games played against you." />
                  </div>
                  {nemesisList.map(([id, rec]) => (
                    <p key={id} className="text-sm text-red-600">
                      {getDisplayName(id)} ({rec.wins}W - {rec.losses}L)
                    </p>
                  ))}
                </div>
              )}
              {bestPartnerList.length > 0 && (
                <div className="p-3 bg-green-50 dark:bg-green-700/20 dark:text-green-200 rounded">
                  <div className="flex items-center mb-1">
                    <h4 className="font-medium text-green-700">Best Partner</h4>
                    <InfoTooltip text="Your Best Partner is the teammate you have the highest win rate with (minimum 1 game together) this season. If there is a tie, the tiebreaker is the number of games played together." />
                  </div>
                  {bestPartnerList.map(([id, rec]) => (
                    <p key={id} className="text-sm text-green-600">
                      {getDisplayName(id)} ({rec.wins}W - {rec.losses}L)
                    </p>
                  ))}
                </div>
              )}
            </div>
            {/* Head-to-Head Records */}
            <div>
              <h3 className="text-lg font-semibold mb-2">Head-to-Head Records</h3>
              <div className="space-y-2">
                {Object.entries(stats.headToHead)
                  .sort(([, a], [, b]) => b.games - a.games)
                  .map(([opponentId, record]) => (
                    <div key={opponentId} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                      <span className="font-medium dark:text-gray-100">{getDisplayName(opponentId)}</span>
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        {record.wins}W - {record.losses}L ({record.games} games)
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Partner Chemistry */}
            <div>
              <h3 className="text-lg font-semibold mb-2">Partner Chemistry</h3>
              <div className="space-y-2">
                {Object.entries(stats.partners)
                  .sort(([, a], [, b]) => b.games - a.games)
                  .map(([partnerId, record]) => {
                    const winRate = record.games > 0 ? (record.wins / record.games) : 0;
                    const winRatePercent = (winRate * 100).toFixed(0);
                    return (
                      <div key={partnerId} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                        <span className="font-medium dark:text-gray-100 flex items-center gap-2">
                          {getDisplayName(partnerId)}
                          <span className="text-[11px] text-indigo-600 dark:text-indigo-300 font-semibold">{winRatePercent}%</span>
                        </span>
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          {record.wins}W - {record.losses}L ({record.games} games)
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 