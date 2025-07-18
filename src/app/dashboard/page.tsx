'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SeasonRankings from '@/components/SeasonRankings';
import RecordGame from '@/components/RecordGame';
import GameHistory from '@/components/GameHistory';
import { Season } from '@/types';
import { signOut } from '@/client/auth';
import MatchmakingModal from '@/components/MatchmakingModal';

interface User {
  isAdmin: boolean;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
}

export default function Dashboard() {
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'game' | 'rankings'>('game');
  const [refreshKey, setRefreshKey] = useState(0);
  const [showMatchmaking, setShowMatchmaking] = useState(false);
  const router = useRouter();

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/users/me');
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const fetchSeasons = async () => {
    try {
      const response = await fetch('/api/seasons');
      const seasons = await response.json();
      setSeasons(seasons);
      const activeSeason = seasons.find((season: Season) => season.isActive);
      setCurrentSeason(activeSeason || null);
      setSelectedSeasonId((prev) => prev || (activeSeason ? activeSeason.id : (seasons[0]?.id || '')));
    } catch (error) {
      console.error('Error fetching seasons:', error);
    }
  };

  useEffect(() => {
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loading) {
      fetchUserData();
      fetchSeasons();
    }
  }, [loading]);

  const handleGameRecorded = () => {
    fetchSeasons();
    setRefreshKey((k) => k + 1);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Loading...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
            <div className="flex items-center gap-4">
              {currentSeason && (
                <div className="text-lg text-gray-600 dark:text-gray-300">{currentSeason.name}</div>
              )}
              {user?.isAdmin && (
                <button
                  onClick={() => router.push('/admin')}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                >
                  Admin
                </button>
              )}
              <button
                onClick={async () => {
                  try {
                    await signOut();
                    router.push('/');
                  } catch (error) {
                    console.error('Error signing out:', error);
                  }
                }}
                className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Season Selector */}
          {seasons.length > 0 && (
            <div className="mb-4">
              <label htmlFor="season-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Season</label>
              <select
                id="season-select"
                className="input-field w-full max-w-xs"
                value={selectedSeasonId}
                onChange={e => setSelectedSeasonId(e.target.value)}
              >
                {seasons.map(season => (
                  <option key={season.id} value={season.id}>
                    {season.name} ({new Date(season.startDate).toLocaleDateString()} - {new Date(season.endDate).toLocaleDateString()})
                  </option>
                ))}
              </select>
              <button
                className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm font-medium mt-2 focus:outline-none"
                onClick={() => setShowMatchmaking(true)}
                type="button"
              >
                MatchMaker
              </button>
            </div>
          )}

          {currentSeason && (
            <>
              {(() => {
                const endDate = new Date(currentSeason.endDate);
                const now = new Date();
                const daysUntilEnd = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                if (daysUntilEnd <= 14 && daysUntilEnd > 0) {
                  return (
                    <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900 border-l-4 border-yellow-400 dark:border-yellow-700 rounded">
                      <p className="text-yellow-700 dark:text-yellow-200">
                        {currentSeason.name} wraps up in {daysUntilEnd} {daysUntilEnd === 1 ? 'day' : 'days'}. 
                        Last chance to get your games in picklers
                      </p>
                    </div>
                  );
                }
                return null;
              })()}
            </>
          )}

          {selectedSeasonId && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="flex -mb-px">
                  <button
                    onClick={() => setActiveTab('game')}
                    className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                      activeTab === 'game'
                        ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    Enter Game
                  </button>
                  <button
                    onClick={() => setActiveTab('rankings')}
                    className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                      activeTab === 'rankings'
                        ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    Current Rankings
                  </button>
                </nav>
              </div>
              <div className="p-6">
                {activeTab === 'game' ? (
                  <RecordGame seasonId={selectedSeasonId} onGameRecorded={handleGameRecorded} />
                ) : (
                  <SeasonRankings seasonId={selectedSeasonId} />
                )}
              </div>
            </div>
          )}

          {selectedSeasonId && (
            <div className="mt-8">
              <GameHistory seasonId={selectedSeasonId} refreshKey={refreshKey} />
            </div>
          )}

          {showMatchmaking && currentSeason && (
            <MatchmakingModal
              seasonId={currentSeason.id}
              onClose={() => setShowMatchmaking(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
} 