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
          const isTeam1 = game.team1.players.some(p => p.id === player.id);
          const isTeam2 = game.team2.players.some(p => p.id === player.id);
          if (!isTeam1 && !isTeam2) return;

          const playerTeam = isTeam1 ? game.team1 : game.team2;
          const opponentTeam = isTeam1 ? game.team2 : game.team1;
          const won = (isTeam1 && game.team1.score > game.team2.score) || 
                     (isTeam2 && game.team2.score > game.team1.score);

          // Update head-to-head stats
          opponentTeam.players.forEach(opponent => {
            if (!newStats.headToHead[opponent.id]) {
              newStats.headToHead[opponent.id] = { wins: 0, losses: 0, games: 0 };
            }
            newStats.headToHead[opponent.id].games++;
            if (won) newStats.headToHead[opponent.id].wins++;
            else newStats.headToHead[opponent.id].losses++;
          });

          // Update partner stats
          playerTeam.players.forEach(partner => {
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

  // Find nemesis (player who beats them most by margin, only if you have actually lost to them)
  const nemesis = Object.entries(stats.headToHead)
    .filter(([, record]) => record.losses > 0)
    .sort(([, a], [, b]) => (b.losses - b.wins) - (a.losses - a.wins))[0];

  // Find best partner
  const bestPartner = Object.entries(stats.partners)
    .sort(([, a], [, b]) => (b.wins / b.games) - (a.wins / a.games))[0];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold">{player.displayName}</h2>
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
              {nemesis && nemesis[1].losses > 0 && (
                <div className="p-3 bg-red-50 rounded">
                  <div className="flex items-center mb-1">
                    <h4 className="font-medium text-red-700">Nemesis</h4>
                    <InfoTooltip text="Your Nemesis is the player who has beaten you by the largest margin (losses minus wins) this season." />
                  </div>
                  <p className="text-sm text-red-600">
                    {getDisplayName(nemesis[0])} ({nemesis[1].wins}W - {nemesis[1].losses}L)
                  </p>
                </div>
              )}
              {bestPartner && (
                <div className="p-3 bg-green-50 rounded">
                  <div className="flex items-center mb-1">
                    <h4 className="font-medium text-green-700">Best Partner</h4>
                    <InfoTooltip text="Your Best Partner is the teammate you have the highest win rate with (minimum 1 game together) this season." />
                  </div>
                  <p className="text-sm text-green-600">
                    {getDisplayName(bestPartner[0])} ({bestPartner[1].wins}W - {bestPartner[1].losses}L)
                  </p>
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
                    <div key={opponentId} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span className="font-medium">{getDisplayName(opponentId)}</span>
                      <span className="text-sm text-gray-600">
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
                  .map(([partnerId, record]) => (
                    <div key={partnerId} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span className="font-medium">{getDisplayName(partnerId)}</span>
                      <span className="text-sm text-gray-600">
                        {record.wins}W - {record.losses}L ({record.games} games)
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 