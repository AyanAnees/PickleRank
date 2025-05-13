'use client';
import React, { useEffect, useState } from 'react';
import { User } from '../types';
import { Game } from '@/types';
import { formatDistanceToNow, format } from 'date-fns';

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

export default function GameHistory({ seasonId, refreshKey }: GameHistoryProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

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
          const team1Won = game.team1.score > game.team2.score;
          const team2Won = game.team2.score > game.team1.score;
          return (
            <div key={game.id} className="border rounded-lg p-4 bg-white shadow-sm relative">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  {/* Enhanced stacked teams with winner highlight and centered score/ELO */}
                  <div className="flex flex-col items-center">
                    <div className={team1Won ? 'font-bold text-green-700 flex items-center mb-1' : 'font-medium mb-1'}>
                      {team1Won && <span className="mr-1">🏆</span>}
                      {game.team1.players.map(p => typeof p === 'string' ? p : p.displayName).join(' & ')}
                    </div>
                    <div className="my-1 text-xs text-gray-500 flex items-center">
                      <span className="mx-2">Score: {game.team1.score} - {game.team2.score}</span>
                      <span className="mx-2 text-gray-300">|</span>
                      <span className="mx-2 text-gray-400">±{game.eloChange} ELO</span>
                    </div>
                    <div className={team2Won ? 'font-bold text-green-700 flex items-center mt-1' : 'font-medium mt-1'}>
                      {team2Won && <span className="mr-1">🏆</span>}
                      {game.team2.players.map(p => typeof p === 'string' ? p : p.displayName).join(' & ')}
                    </div>
                  </div>
                  {game.recordedBy?.name && (
                    <div className="mt-1 text-xs text-gray-500">
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
                <div className="absolute bottom-2 left-4 text-[10px] text-gray-400 text-left">
                  {gameTime.full}
                  <span className="ml-1">({gameTime.relative})</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
} 