import React, { useEffect, useState } from 'react';
import { User, Game } from '@/types';

interface MatchmakingModalProps {
  seasonId: string;
  onClose: () => void;
}

function getCombinations(arr: string[], k: number): string[][] {
  // Helper to get all combinations of k elements from arr
  const results: string[][] = [];
  function combine(start: number, combo: string[]) {
    if (combo.length === k) {
      results.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combine(i + 1, [...combo, arr[i]]);
    }
  }
  combine(0, []);
  return results;
}

export default function MatchmakingModal({ seasonId, onClose }: MatchmakingModalProps) {
  const [players, setPlayers] = useState<User[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState<Game[]>([]);
  const [suggested, setSuggested] = useState<{ games: string[][][], sitOut: string[] }>({ games: [], sitOut: [] });
  const [shuffles, setShuffles] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isVarietyMode, setIsVarietyMode] = useState(true); // Default to variety mode
  const [isInitialLoad, setIsInitialLoad] = useState(true); // Track if this is the first load

  useEffect(() => {
    const fetchPlayersAndGames = async () => {
      setLoading(true);
      try {
        const [usersRes, gamesRes] = await Promise.all([
          fetch('/api/users'),
          fetch(`/api/seasons/${seasonId}/games`),
        ]);
        const usersData = await usersRes.json();
        const gamesData = await gamesRes.json();
        setPlayers(usersData || []);
        setGames(gamesData || []);
      } catch (e) {
        setPlayers([]);
        setGames([]);
      } finally {
        setLoading(false);
      }
    };
    fetchPlayersAndGames();
  }, [seasonId]);

  const togglePlayer = (id: string) => {
    setSelected(sel => {
      const newSelection = sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id];
      // Reset shuffle count when selection changes
      setShuffles(0);
      setIsInitialLoad(true);
      return newSelection;
    });
  };

  const selectAll = () => {
    setSelected(players.map(p => p.id));
    setShuffles(0);
    setIsInitialLoad(true);
  };
  
  const clearAll = () => {
    setSelected([]);
    setShuffles(0);
    setIsInitialLoad(true);
  };

  // Alphabetize players by displayName
  const sortedPlayers = [...players].sort((a, b) => a.displayName.localeCompare(b.displayName));
  const canShuffle = selected.length >= 4;

  // Build matrices for 'played with' and 'played against'
  function buildHistoryMatrices(selectedIds: string[]) {
    const playedWith: Record<string, Record<string, number>> = {};
    const playedAgainst: Record<string, Record<string, number>> = {};
    for (const id of selectedIds) {
      playedWith[id] = {};
      playedAgainst[id] = {};
      for (const other of selectedIds) {
        if (id !== other) {
          playedWith[id][other] = 0;
          playedAgainst[id][other] = 0;
        }
      }
    }
    for (const game of games) {
      const team1 = game.team1.players.map((p: any) => (typeof p === 'string' ? p : p.id));
      const team2 = game.team2.players.map((p: any) => (typeof p === 'string' ? p : p.id));
      // Only count games where all players are in selectedIds
      const allPlayers = [...team1, ...team2];
      if (!allPlayers.every(id => selectedIds.includes(id))) continue;
      // Played with
      for (const team of [team1, team2]) {
        for (let i = 0; i < team.length; i++) {
          for (let j = 0; j < team.length; j++) {
            if (i !== j) playedWith[team[i]][team[j]]++;
          }
        }
      }
      // Played against
      for (const p1 of team1) for (const p2 of team2) {
        playedAgainst[p1][p2]++;
        playedAgainst[p2][p1]++;
      }
    }
    return { playedWith, playedAgainst };
  }

  // Calculate ELO difference between teams
  function calculateEloDifference(team1: string[], team2: string[]): number {
    const team1Elo = team1.reduce((sum, id) => {
      const player = players.find(p => p.id === id);
      return sum + (player?.elo || 1500);
    }, 0) / 2;
    const team2Elo = team2.reduce((sum, id) => {
      const player = players.find(p => p.id === id);
      return sum + (player?.elo || 1500);
    }, 0) / 2;
    return Math.abs(team1Elo - team2Elo);
  }

  // Fisher-Yates shuffle implementation
  function shuffleArray<T>(array: T[]): T[] {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  }

  function suggestMatchups(selectedIds: string[]) {
    if (selectedIds.length < 4) return { games: [], sitOut: [] };
    
    // Calculate algorithm weight based on whether it's initial load or shuffles
    let algorithmWeight: number;
    if (isInitialLoad) {
      algorithmWeight = 1; // 100% on initial load
    } else {
      // First shuffle reduces by 30%, then each subsequent shuffle reduces by 30% more
      algorithmWeight = Math.max(0, 1 - (shuffles * 0.3));
    }
    
    // Shuffle selectedIds for randomness
    const ids = [...selectedIds].sort(() => Math.random() - 0.5);
    
    // Sit out logic
    const numGames = Math.floor(ids.length / 4);
    const numSitOut = ids.length % 4;
    const sitOut = numSitOut > 0 ? ids.slice(-numSitOut) : [];
    const playing = ids.slice(0, numGames * 4);
    
    const { playedWith, playedAgainst } = buildHistoryMatrices(selectedIds);
    const gamesArr: string[][][] = [];
    
    for (let g = 0; g < numGames; g++) {
      const startIdx = g * 4;
      const group = playing.slice(startIdx, startIdx + 4);
      
      // If algorithm weight is low enough, just pick random teams
      if (algorithmWeight < 0.3) {
        const shuffledGroup = [...group].sort(() => Math.random() - 0.5);
        gamesArr.push([shuffledGroup.slice(0, 2), shuffledGroup.slice(2)]);
        continue;
      }
      
      // Otherwise, use the algorithm
      const combos = getCombinations(group, 2);
      let bestScore = Infinity;
      let bestTeams: string[][] = [];
      
      // Shuffle the combinations to add more randomness
      const shuffledCombos = [...combos].sort(() => Math.random() - 0.5);
      
      for (const team1 of shuffledCombos) {
        const team2 = group.filter(x => !team1.includes(x));
        
        let score: number;
        if (isVarietyMode) {
          // Variety mode: minimize games played together/against
          score = algorithmWeight * (
            playedWith[team1[0]][team1[1]] +
            playedWith[team2[0]][team2[1]] +
            playedAgainst[team1[0]][team2[0]] +
            playedAgainst[team1[0]][team2[1]] +
            playedAgainst[team1[1]][team2[0]] +
            playedAgainst[team1[1]][team2[1]]
          );
        } else {
          // Fair mode: minimize ELO difference between teams
          score = algorithmWeight * calculateEloDifference(team1, team2);
        }
        
        // Add randomization factor - make it more impactful
        score += (1 - algorithmWeight) * (Math.random() * 2000);
        
        if (score < bestScore) {
          bestScore = score;
          bestTeams = [team1, team2];
        }
      }
      gamesArr.push(bestTeams);
    }
    return { games: gamesArr, sitOut };
  }

  // Run matchmaking on shuffle or when selected changes
  useEffect(() => {
    if (canShuffle) {
      setSuggested(suggestMatchups(selected));
    } else {
      setSuggested({ games: [], sitOut: [] });
    }
  }, [shuffles, selected, games, isVarietyMode, isInitialLoad]);

  // Handle shuffle button click
  const handleShuffle = () => {
    setIsInitialLoad(false); // Mark that we're no longer in initial load
    setShuffles(s => s + 1);
    // Force a re-render by updating the suggested state
    setSuggested(prev => ({ ...prev }));
  };

  // Helper to get display name
  const getName = (id: string) => players.find(p => p.id === id)?.displayName || id;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-lg w-full p-6 relative">
        <button
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 text-xl"
          onClick={onClose}
          aria-label="Close"
        >
          &times;
        </button>
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          MatchMaker
          <span
            className="text-gray-400 cursor-pointer"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            tabIndex={0}
            onFocus={() => setShowTooltip(true)}
            onBlur={() => setShowTooltip(false)}
            aria-label="Info"
          >
            <svg className="inline w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0-4h.01" />
            </svg>
            {showTooltip && (
              <div className="absolute z-50 left-1/2 -translate-x-1/2 mt-2 w-72 p-2 bg-white border border-gray-200 rounded shadow text-xs text-gray-700">
                <b>Variety Mode:</b> Teams are suggested to maximize variety—players are paired with and against those they've played with the least.<br /><br />
                <b>Fair Mode:</b> Teams are suggested to create the most balanced matches based on ELO ratings.<br /><br />
                Each shuffle reduces the algorithm's influence, making teams more random.
              </div>
            )}
          </span>
        </h2>

        {/* Mode Segmented Control */}
        <div className="mb-4 flex items-center justify-center">
          <div className="inline-flex rounded-full bg-gray-100 dark:bg-gray-700 p-1 border border-gray-300 dark:border-gray-600">
            <button
              type="button"
              onClick={() => setIsVarietyMode(true)}
              className={`px-4 py-1 rounded-full text-sm font-semibold focus:outline-none transition-colors duration-150
                ${isVarietyMode ? 'bg-indigo-600 text-white shadow' : 'bg-transparent text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
              aria-pressed={isVarietyMode}
            >
              Variety
            </button>
            <button
              type="button"
              onClick={() => setIsVarietyMode(false)}
              className={`px-4 py-1 rounded-full text-sm font-semibold focus:outline-none transition-colors duration-150
                ${!isVarietyMode ? 'bg-indigo-600 text-white shadow' : 'bg-transparent text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
              aria-pressed={!isVarietyMode}
            >
              Fair
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-gray-500">Loading players...</div>
        ) : (
          <>
            <div className="mb-4">
              <div className="flex gap-2 mb-2">
                <button className="text-xs text-indigo-600 hover:underline" onClick={selectAll}>Select All</button>
                <button className="text-xs text-gray-500 hover:underline" onClick={clearAll}>Clear</button>
              </div>
              <div className="max-h-48 overflow-y-auto border rounded p-2 bg-gray-50 dark:bg-gray-800 dark:border-gray-600">
                {sortedPlayers.map(player => (
                  <label key={player.id} className="flex items-center gap-2 py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.includes(player.id)}
                      onChange={() => togglePlayer(player.id)}
                      className="accent-indigo-600"
                    />
                    <span>{player.displayName}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="mt-6">
              <button
                className="text-sm text-indigo-600 hover:underline mb-2 disabled:text-gray-300 disabled:cursor-not-allowed"
                disabled={!canShuffle}
                onClick={handleShuffle}
              >
                Shuffle
              </button>
              {!canShuffle && (
                <div className="text-xs text-red-500 mt-1">Select at least 4 players to generate matchups.</div>
              )}
              {suggested.games.length > 0 && (
                <div className="space-y-4 mt-2">
                  {suggested.games.map((teams, i) => (
                    <div key={i} className="border rounded p-3 bg-gray-50 dark:bg-gray-800 dark:border-gray-600 shadow-md">
                      <div className="font-semibold mb-1 dark:text-gray-100">Game {i + 1}</div>
                      <div className="flex gap-4">
                        <div>
                          <div className="text-xs text-gray-500 dark:text-gray-300">Team 1</div>
                          <div className="font-medium dark:text-gray-100">{getName(teams[0][0])} & {getName(teams[0][1])}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 dark:text-gray-300">Team 2</div>
                          <div className="font-medium dark:text-gray-100">{getName(teams[1][0])} & {getName(teams[1][1])}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {suggested.sitOut.length > 0 && (
                    <div className="text-xs text-gray-500 mt-2">Sit out: {suggested.sitOut.map(getName).join(', ')}</div>
                  )}
                </div>
              )}
              {suggested.games.length === 0 && canShuffle && (
                <div className="text-gray-400 dark:text-gray-500 text-sm">No valid matchups found.</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}