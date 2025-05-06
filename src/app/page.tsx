'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Season } from '../types';
import { getCurrentSeason, determineNextSeason } from '../utils/season';
import SeasonRankings from '../components/SeasonRankings';
import RecordGame from '../components/RecordGame';
import GameHistory from '../components/GameHistory';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function Home() {
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
      if (user) {
        router.push('/dashboard');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Loading...</h1>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
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
          <footer className="mt-8 text-center text-sm text-gray-500">
            <p>© {new Date().getFullYear()} PickleRank. All rights reserved.</p>
            <div className="mt-2 space-x-4">
              <Link href="/terms" className="hover:text-indigo-600">
                Terms of Service
              </Link>
              <Link href="/privacy" className="hover:text-indigo-600">
                Privacy Policy
              </Link>
            </div>
          </footer>
        </div>
      </div>
    );
  }

  return null; // This should never be reached due to the redirect in useEffect
} 