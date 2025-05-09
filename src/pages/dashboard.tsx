'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SeasonRankings from '@/components/SeasonRankings';
import RecordGame from '@/components/RecordGame';
import GameHistory from '@/components/GameHistory';
import { Season } from '@/types';
import { signOut } from '../client/auth';

export default function Dashboard() {
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'game' | 'rankings'>('game');
  const [refreshKey, setRefreshKey] = useState(0);
  const router = useRouter();

  // TODO: Replace with real user context
  const user = {
    phoneNumber: '+15856831831', // Replace with actual user phone number from auth context
    isAdmin: false,
  };
  if (user.phoneNumber === '+15856831831') {
    user.isAdmin = true;
  }

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
    // TODO: Move auth check to a client context or API route
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loading) {
      fetchSeasons();
    }
  }, [loading]);

  const handleGameRecorded = () => {
    // Instead of refreshing the page, just fetch the latest data
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <div className="flex items-center gap-4">
              {currentSeason && (
                <div className="text-lg text-gray-600">
                  {currentSeason.name}
                </div>
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
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Season Selector */}
          {seasons.length > 0 && (
            <div className="mb-4">
              <label htmlFor="season-select" className="block text-sm font-medium text-gray-700 mb-1">Select Season</label>
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
                    <div className="mt-4 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                      <p className="text-yellow-700">
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
            <div className="bg-white rounded-lg shadow">
              <div className="border-b border-gray-200">
                <nav className="flex -mb-px">
                  <button
                    onClick={() => setActiveTab('game')}
                    className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                      activeTab === 'game'
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Enter Game
                  </button>
                  <button
                    onClick={() => setActiveTab('rankings')}
                    className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                      activeTab === 'rankings'
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
        </div>
      </div>
    </div>
  );
} 