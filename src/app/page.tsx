'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Season } from '../types';
import { getCurrentSeason, determineNextSeason } from '../utils/season';
import SeasonRankings from '../components/SeasonRankings';
import RecordGame from '../components/RecordGame';
import GameHistory from '../components/GameHistory';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchSeasons = async () => {
      try {
        const response = await fetch('/api/seasons');
        const seasons = await response.json();
        const activeSeason = seasons.find((season: Season) => season.isActive);
        setCurrentSeason(activeSeason || null);
      } catch (error) {
        console.error('Error fetching seasons:', error);
      }
    };

    fetchSeasons();
  }, []);

  const handleGameRecorded = () => {
    // Refresh the page to show updated rankings
    window.location.reload();
  };

  // Always show the sign-in page (no SSR auth check here)
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Welcome Pickleheads</h1>
          <p className="text-sm text-gray-500 mb-8">
            Shoutout 24 hour shami
          </p>
          <button
            onClick={() => router.push('/auth/signin')}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Sign In
          </button>
        </div>
        {currentSeason && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">Current Season Rankings</h2>
            <SeasonRankings seasonId={currentSeason.id} />
          </div>
        )}
      </div>
    </div>
  );
} 