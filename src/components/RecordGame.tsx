'use client';

import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { useAuth } from '../contexts/AuthContext';
import type { Team, Season } from '@/types';

interface RecordGameProps {
  seasonId: string;
  onGameRecorded: () => void;
}

export default function RecordGame({ seasonId, onGameRecorded }: RecordGameProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [team1, setTeam1] = useState<Team>({ players: [], score: 0 });
  const [team2, setTeam2] = useState<Team>({ players: [], score: 0 });
  const [gameTime, setGameTime] = useState<Date>(new Date());
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<User[]>([]);

  // Form state
  const [team1Player1, setTeam1Player1] = useState('');
  const [team1Player2, setTeam1Player2] = useState('');
  const [team2Player1, setTeam2Player1] = useState('');
  const [team2Player2, setTeam2Player2] = useState('');
  const [team1Score, setTeam1Score] = useState('');
  const [team2Score, setTeam2Score] = useState('');

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const response = await fetch('/api/users');
        const data = await response.json();
        setAvailablePlayers(data);
      } catch (error) {
        console.error('Error fetching players:', error);
        setError('Failed to load players');
      } finally {
        setLoading(false);
      }
    };

    fetchPlayers();
  }, []);

  const validateTeams = () => {
    // Check for duplicate players
    const allPlayers = [team1Player1, team1Player2, team2Player1, team2Player2];
    const uniquePlayers = new Set(allPlayers);
    
    if (uniquePlayers.size !== 4) {
      setError('Each player can only play once per game');
      return false;
    }

    // Validate scores
    const score1 = parseInt(team1Score);
    const score2 = parseInt(team2Score);
    
    if (isNaN(score1) || isNaN(score2) || score1 < 0 || score2 < 0) {
      setError('Scores must be non-negative numbers');
      return false;
    }

    // In pickleball, a team must win by 2 points
    if (Math.abs(score1 - score2) < 2) {
      setError('A team must win by at least 2 points');
      return false;
    }

    // A team must score at least 11 points to win
    if (score1 < 11 && score2 < 11) {
      setError('A team must score at least 11 points to win');
      return false;
    }

    return true;
  };

  const resetForm = () => {
    setTeam1Player1('');
    setTeam1Player2('');
    setTeam2Player1('');
    setTeam2Player2('');
    setTeam1Score('');
    setTeam2Score('');
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000); // Clear success message after 3 seconds
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      if (!user) throw new Error('No authenticated user found');
      const idToken = await user.getIdToken(true);

      const payload = {
        team1,
        team2,
        gameTime: gameTime.toISOString(),
        seasonId: selectedSeasonId,
        recordedBy: user.uid
      };

      const response = await fetch('/api/seasons/' + selectedSeasonId + '/games', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `auth-token=${idToken}`
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to record game');
      }

      setSuccess(true);
      setShowModal(false);
      onGameRecorded();
    } catch (err: any) {
      setError(err.message || 'Failed to record game');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading players...</div>;
  }

  // Sort players alphabetically by first name (then last name)
  const sortedPlayers = [...availablePlayers].sort((a, b) => {
    if (a.firstName.toLowerCase() === b.firstName.toLowerCase()) {
      return a.lastName.toLowerCase().localeCompare(b.lastName.toLowerCase());
    }
    return a.firstName.toLowerCase().localeCompare(b.firstName.toLowerCase());
  });

  return (
    <div className="card space-y-4">
      <h3 className="text-xl font-semibold">Record Game</h3>
      
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border-l-4 border-green-400 p-4">
          <p className="text-green-700">Game recorded successfully!</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium mb-2">Team 1</h4>
            <div className="space-y-2">
              <select
                value={team1Player1}
                onChange={(e) => setTeam1Player1(e.target.value)}
                className="input-field"
                required
                disabled={loading}
              >
                <option value="">Select Player 1</option>
                {sortedPlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.displayName}
                  </option>
                ))}
              </select>
              <select
                value={team1Player2}
                onChange={(e) => setTeam1Player2(e.target.value)}
                className="input-field"
                required
                disabled={loading}
              >
                <option value="">Select Player 2</option>
                {sortedPlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.displayName}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={team1Score}
                onChange={(e) => setTeam1Score(e.target.value)}
                placeholder="Score"
                className="input-field"
                min="0"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-2">Team 2</h4>
            <div className="space-y-2">
              <select
                value={team2Player1}
                onChange={(e) => setTeam2Player1(e.target.value)}
                className="input-field"
                required
                disabled={loading}
              >
                <option value="">Select Player 1</option>
                {sortedPlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.displayName}
                  </option>
                ))}
              </select>
              <select
                value={team2Player2}
                onChange={(e) => setTeam2Player2(e.target.value)}
                className="input-field"
                required
                disabled={loading}
              >
                <option value="">Select Player 2</option>
                {sortedPlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.displayName}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={team2Score}
                onChange={(e) => setTeam2Score(e.target.value)}
                placeholder="Score"
                className="input-field"
                min="0"
                required
                disabled={loading}
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={loading || !user?.uid}
        >
          {loading ? 'Recording...' : 'Record Game'}
        </button>
      </form>
    </div>
  );
} 