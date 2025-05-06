import React, { useEffect, useState } from 'react';
import { User } from '../types';
import { Game } from '@/types';
import { formatDistanceToNow, format } from 'date-fns';

interface GameHistoryProps {
  seasonId: string;
}

export default function GameHistory({ seasonId }: GameHistoryProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  }, [seasonId]);

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
        <h3 className="text-xl font-semibold">Game History</h3>
        <p className="text-gray-500">No games have been played yet in this season.</p>
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      <h3 className="text-xl font-semibold">Game History</h3>
      <div className="space-y-4">
        {games.map((game) => {
          const gameTime = formatGameTime(game.gameTime);
          return (
            <div key={game.id} className="border rounded-lg p-4 bg-white shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">
                        {game.team1.players.map(p => typeof p === 'string' ? p : p.displayName).join(' & ')}
                      </span>
                      <span className="text-gray-500">vs</span>
                      <span className="font-medium">
                        {game.team2.players.map(p => typeof p === 'string' ? p : p.displayName).join(' & ')}
                      </span>
                    </div>
                    {gameTime && (
                      <div className="text-sm text-gray-500">
                        <div>{gameTime.full}</div>
                        <div className="text-xs">({gameTime.relative})</div>
                      </div>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-gray-600">
                    Score: {game.team1.score} - {game.team2.score}
                  </div>
                  {game.recordedBy?.name && (
                    <div className="mt-1 text-xs text-gray-500">
                      Recorded by {game.recordedBy.name}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
} 