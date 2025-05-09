'use client';

import { useEffect, useState } from 'react';
import { User, SeasonRanking } from '@/types';

interface SeasonRankingsProps {
  seasonId: string;
}

interface RankingsResponse {
  rankings: SeasonRanking[];
  users: User[];
  unranked: SeasonRanking[];
}

export default function SeasonRankings({ seasonId }: SeasonRankingsProps) {
  const [rankings, setRankings] = useState<SeasonRanking[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [unranked, setUnranked] = useState<SeasonRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRankings = async () => {
      if (!seasonId) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/seasons/${seasonId}/rankings`);
        if (!response.ok) {
          if (response.status === 404) {
            setRankings([]);
            setUsers([]);
            setUnranked([]);
            return;
          }
          throw new Error('Failed to fetch rankings');
        }
        const data: RankingsResponse = await response.json();
        setRankings(data.rankings || []);
        setUsers(data.users || []);
        setUnranked(data.unranked || []);
      } catch (error) {
        console.error('Error fetching rankings:', error);
        setError(error instanceof Error ? error.message : 'Failed to fetch rankings');
      } finally {
        setLoading(false);
      }
    };

    fetchRankings();
  }, [seasonId]);

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

  if (rankings.length === 0 && unranked.length === 0) {
    return (
      <div className="card space-y-4">
        <h3 className="text-xl font-semibold">Current Season Rankings</h3>
        <p className="text-gray-500">No games played yet</p>
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      <h3 className="text-xl font-semibold">Current Season Rankings</h3>
      <div className="space-y-2">
        {rankings.map((ranking, index) => {
          const user = users.find(u => u.id === ranking.userId);
          let medal = null;
          if (index === 0) {
            medal = <span title="#1" className="ml-2 text-2xl">🥇</span>;
          } else if (index === 1) {
            medal = <span title="#2" className="ml-2 text-2xl">🥈</span>;
          } else if (index === 2) {
            medal = <span title="#3" className="ml-2 text-2xl">🥉</span>;
          }
          return (
            <div key={ranking.userId} className="flex items-center justify-between p-2 bg-white rounded shadow">
              <div className="flex items-center space-x-4">
                <span className="text-lg font-semibold text-gray-600">#{index + 1}</span>
                <div className="flex items-center">
                  <span className="font-medium">{user?.displayName || 'Unknown Player'}</span>
                  {medal}
                </div>
                <div className="ml-4">
                  <div className="text-sm text-gray-500">
                    Games: {ranking.gamesPlayed}/5
                  </div>
                </div>
              </div>
              <span className="text-lg font-semibold text-indigo-600">{ranking.currentElo}</span>
            </div>
          );
        })}
      </div>

      {unranked.length > 0 && (
        <div className="mt-8">
          <h4 className="text-lg font-semibold mb-4">Unranked Players</h4>
          <div className="space-y-2">
            {unranked.map((ranking) => {
              const user = users.find(u => u.id === ranking.userId);
              return (
                <div key={ranking.userId} className="flex items-center justify-between p-2 bg-gray-50 rounded shadow">
                  <div className="flex items-center space-x-4">
                    <div>
                      <span className="font-medium">{user?.displayName || 'Unknown Player'}</span>
                      <div className="text-sm text-gray-500">
                        {ranking.gamesPlayed} games played - {5 - ranking.gamesPlayed} more needed
                      </div>
                    </div>
                  </div>
                  <span className="text-lg font-semibold text-gray-400">Unranked</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
} 