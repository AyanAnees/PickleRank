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
    setSelected(sel => sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]);
  };

  const selectAll = () => setSelected(players.map(p => p.id));
  const clearAll = () => setSelected([]);

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

  // Main matchmaking logic
  function suggestMatchups(selectedIds: string[]) {
    if (selectedIds.length < 4) return { games: [], sitOut: [] };
    // Shuffle selectedIds for randomness
    const ids = [...selectedIds].sort(() => Math.random() - 0.5);
    // Sit out logic
    const numGames = Math.floor(ids.length / 4);
    const numSitOut = ids.length % 4;
    const sitOut = ids.slice(-numSitOut);
    const playing = ids.slice(0, numGames * 4);
    const { playedWith, playedAgainst } = buildHistoryMatrices(selectedIds);
    const gamesArr: string[][][] = [];
    for (let g = 0; g < numGames; g++) {
      const group = playing.slice(g * 4, g * 4 + 4);
      // Generate all possible team splits
      const combos = getCombinations(group, 2);
      let bestScore = Infinity;
      let bestTeams: string[][] = [];
      for (const team1 of combos) {
        const team2 = group.filter(x => !team1.includes(x));
        // Score: sum of playedWith for teammates + playedAgainst for opponents
        const score =
          playedWith[team1[0]][team1[1]] +
          playedWith[team2[0]][team2[1]] +
          playedAgainst[team1[0]][team2[0]] +
          playedAgainst[team1[0]][team2[1]] +
          playedAgainst[team1[1]][team2[0]] +
          playedAgainst[team1[1]][team2[1]] +
          playedAgainst[team2[0]][team1[0]] +
          playedAgainst[team2[0]][team1[1]] +
          playedAgainst[team2[1]][team1[0]] +
          playedAgainst[team2[1]][team1[1]];
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
    // eslint-disable-next-line
  }, [shuffles, selected, games]);

  // Helper to get display name
  const getName = (id: string) => players.find(p => p.id === id)?.displayName || id;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-lg w-full p-6 relative">
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
              <div className="absolute z-50 left-1/2 -translate-x-1/2 mt-2 w-64 p-2 bg-white border border-gray-200 rounded shadow text-xs text-gray-700">
                Teams are suggested to maximize variety—players are paired with and against those they've played with the least. If there are extra players, sit-outs are rotated so everyone gets a turn. Don't cry. You can always hit the Shuffle button for a new suggestion.
              </div>
            )}
          </span>
        </h2>
        {loading ? (
          <div className="text-gray-500">Loading players...</div>
        ) : (
          <>
            <div className="mb-4">
              <div className="flex gap-2 mb-2">
                <button className="text-xs text-indigo-600 hover:underline" onClick={selectAll}>Select All</button>
                <button className="text-xs text-gray-500 hover:underline" onClick={clearAll}>Clear</button>
              </div>
              <div className="max-h-48 overflow-y-auto border rounded p-2 bg-gray-50">
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
                onClick={() => setShuffles(s => s + 1)}
              >
                Shuffle
              </button>
              {!canShuffle && (
                <div className="text-xs text-red-500 mt-1">Select at least 4 players to generate matchups.</div>
              )}
              {suggested.games.length > 0 && (
                <div className="space-y-4 mt-2">
                  {suggested.games.map((teams, i) => (
                    <div key={i} className="border rounded p-3 bg-gray-50">
                      <div className="font-semibold mb-1">Game {i + 1}</div>
                      <div className="flex gap-4">
                        <div>
                          <div className="text-xs text-gray-500">Team 1</div>
                          <div className="font-medium">{getName(teams[0][0])} & {getName(teams[0][1])}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Team 2</div>
                          <div className="font-medium">{getName(teams[1][0])} & {getName(teams[1][1])}</div>
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
                <div className="text-gray-400 text-sm">No valid matchups found.</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
} 