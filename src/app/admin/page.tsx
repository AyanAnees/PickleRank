'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Season, Game, User } from '@/types';

interface AdminUser {
  isAdmin: boolean;
  firstName?: string;
  lastName?: string;
}

interface EditGameData {
  id: string;
  seasonId: string;
  team1: {
    players: string[];
    score: number;
  };
  team2: {
    players: string[];
    score: number;
  };
  gameTime: string;
}

export default function AdminPage() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonsLoading, setSeasonsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'seasons' | 'games'>('seasons');
  const [createFormData, setCreateFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    deactivateOthers: true
  });
  
  // Game management state
  const [games, setGames] = useState<Game[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [editingGame, setEditingGame] = useState<EditGameData | null>(null);
  const [gamesLoading, setGamesLoading] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchUserData();
    fetchSeasons();
    fetchAllUsers();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/users/me');
      if (!response.ok) {
        router.push('/auth/signin');
        return;
      }
      const userData = await response.json();
      
      if (!userData.isAdmin) {
        router.push('/dashboard');
        return;
      }
      
      setUser(userData);
    } catch (error) {
      console.error('Error fetching user data:', error);
      router.push('/auth/signin');
    } finally {
      setLoading(false);
    }
  };

  const fetchSeasons = async () => {
    setSeasonsLoading(true);
    try {
      const response = await fetch('/api/seasons');
      if (response.ok) {
        const seasonsData = await response.json();
        setSeasons(seasonsData);
        
        // Set default selected season to active season
        const activeSeason = seasonsData.find((s: Season) => s.isActive);
        if (activeSeason && !selectedSeason) {
          setSelectedSeason(activeSeason.id);
        }
      }
    } catch (error) {
      console.error('Error fetching seasons:', error);
      setError('Failed to fetch seasons');
    } finally {
      setSeasonsLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const response = await fetch('/api/users');
      if (response.ok) {
        const usersData = await response.json();
        setAllUsers(usersData);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchGames = async (seasonId: string) => {
    if (!seasonId) return;
    
    setGamesLoading(true);
    try {
      const response = await fetch(`/api/seasons/${seasonId}/games`);
      if (response.ok) {
        const gamesData = await response.json();
        setGames(gamesData);
      }
    } catch (error) {
      console.error('Error fetching games:', error);
      setError('Failed to fetch games');
    } finally {
      setGamesLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSeason) {
      fetchGames(selectedSeason);
    }
  }, [selectedSeason]);

  const handleCreateSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading('create');
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/admin/seasons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'create',
          seasonData: createFormData
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create season');
      }

      setSuccess(`Successfully created ${result.season.name}!`);
      setShowCreateForm(false);
      setCreateFormData({
        name: '',
        startDate: '',
        endDate: '',
        deactivateOthers: true
      });
      await fetchSeasons();
    } catch (error: any) {
      setError(error.message || 'Failed to create season');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSeasonAction = async (action: 'activate' | 'deactivate', seasonId: string, seasonName: string) => {
    setActionLoading(`${action}-${seasonId}`);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/admin/seasons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action,
          seasonData: { seasonId }
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Failed to ${action} season`);
      }

      setSuccess(`Successfully ${action}d ${seasonName}!`);
      await fetchSeasons();
    } catch (error: any) {
      setError(error.message || `Failed to ${action} season`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleEditGame = (game: Game) => {
    setEditingGame({
      id: game.id,
      seasonId: game.seasonId,
      team1: {
        players: game.team1.players.map(p => typeof p === 'string' ? p : p.id),
        score: game.team1.score
      },
      team2: {
        players: game.team2.players.map(p => typeof p === 'string' ? p : p.id),
        score: game.team2.score
      },
      gameTime: new Date(game.gameTime).toISOString().slice(0, 16)
    });
  };

  const handleSaveGameEdit = async () => {
    if (!editingGame) return;

    setActionLoading(`edit-${editingGame.id}`);
    setError(null);
    setSuccess(null);

    try {
      // Validate scores
      if (editingGame.team1.score < 0 || editingGame.team2.score < 0) {
        throw new Error('Scores must be non-negative');
      }

      if (editingGame.team1.score < 11 && editingGame.team2.score < 11) {
        throw new Error('At least one team must score 11 points');
      }

      if (Math.abs(editingGame.team1.score - editingGame.team2.score) < 2) {
        throw new Error('Winner must win by at least 2 points');
      }

      const response = await fetch(`/api/games/${editingGame.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          team1: editingGame.team1,
          team2: editingGame.team2,
          gameTime: new Date(editingGame.gameTime).toISOString()
        })
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to update game');
      }

      setSuccess('Game updated successfully! ELO ratings have been recalculated for the entire season.');
      setEditingGame(null);
      await fetchGames(selectedSeason);
    } catch (error: any) {
      setError(error.message || 'Failed to update game');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteGame = async (gameId: string) => {
    if (!window.confirm('Are you sure you want to delete this game? This will recalculate ELO ratings for the entire season.')) {
      return;
    }

    setActionLoading(`delete-${gameId}`);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/games/${gameId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to delete game');
      }

      setSuccess('Game deleted successfully! ELO ratings have been recalculated for the entire season.');
      await fetchGames(selectedSeason);
    } catch (error: any) {
      setError(error.message || 'Failed to delete game');
    } finally {
      setActionLoading(null);
    }
  };

  const generateDefaultDates = () => {
    const now = new Date();
    const twoMonthsLater = new Date();
    twoMonthsLater.setMonth(twoMonthsLater.getMonth() + 2);

    setCreateFormData(prev => ({
      ...prev,
      startDate: now.toISOString().split('T')[0],
      endDate: twoMonthsLater.toISOString().split('T')[0]
    }));
  };

  const getSeasonNumber = () => {
    const seasonNumbers = seasons
      .map(season => {
        const match = season.name.match(/Season (\d+)/);
        return match ? parseInt(match[1]) : 0;
      })
      .filter(num => num > 0);
    
    const maxNumber = Math.max(0, ...seasonNumbers);
    return maxNumber + 1;
  };

  const getUserName = (userId: string) => {
    const user = allUsers.find(u => u.id === userId);
    return user ? `${user.firstName} ${user.lastName}` : 'Unknown Player';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (!user?.isAdmin) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
              <p className="text-gray-600 dark:text-gray-300">
                Season & Game Management
              </p>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium transition-colors"
            >
              ← Back to Dashboard
            </button>
          </div>

          {/* Alerts */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                </div>
              </div>
            </div>
          )}

          {success && (
            <div className="bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
                </div>
              </div>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="flex -mb-px">
                <button
                  onClick={() => setActiveTab('seasons')}
                  className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                    activeTab === 'seasons'
                      ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  Season Management
                </button>
                <button
                  onClick={() => setActiveTab('games')}
                  className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                    activeTab === 'games'
                      ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  Game Management
                </button>
              </nav>
            </div>
            
            <div className="p-6">
              {/* Season Management Tab */}
              {activeTab === 'seasons' && (
                <div className="space-y-6">
                  {/* Create Season Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create New Season</h2>
                      <button
                        onClick={() => {
                          setShowCreateForm(!showCreateForm);
                          if (!showCreateForm) {
                            generateDefaultDates();
                            setCreateFormData(prev => ({
                              ...prev,
                              name: `Season ${getSeasonNumber()}`
                            }));
                          }
                        }}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                      >
                        {showCreateForm ? 'Cancel' : 'Create Season'}
                      </button>
                    </div>

                    {showCreateForm && (
                      <form onSubmit={handleCreateSeason} className="space-y-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="seasonName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Season Name
                            </label>
                            <input
                              type="text"
                              id="seasonName"
                              value={createFormData.name}
                              onChange={(e) => setCreateFormData(prev => ({ ...prev, name: e.target.value }))}
                              className="input-field w-full"
                              placeholder="e.g., Season 2"
                              required
                            />
                          </div>
                          
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              id="deactivateOthers"
                              checked={createFormData.deactivateOthers}
                              onChange={(e) => setCreateFormData(prev => ({ ...prev, deactivateOthers: e.target.checked }))}
                              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                            />
                            <label htmlFor="deactivateOthers" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                              Deactivate all other seasons
                            </label>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Start Date
                            </label>
                            <input
                              type="date"
                              id="startDate"
                              value={createFormData.startDate}
                              onChange={(e) => setCreateFormData(prev => ({ ...prev, startDate: e.target.value }))}
                              className="input-field w-full"
                              required
                            />
                          </div>
                          
                          <div>
                            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              End Date
                            </label>
                            <input
                              type="date"
                              id="endDate"
                              value={createFormData.endDate}
                              onChange={(e) => setCreateFormData(prev => ({ ...prev, endDate: e.target.value }))}
                              className="input-field w-full"
                              required
                            />
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="submit"
                            disabled={actionLoading === 'create'}
                            className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {actionLoading === 'create' ? (
                              <div className="flex items-center">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Creating...
                              </div>
                            ) : (
                              'Create Season'
                            )}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>

                  {/* Seasons List */}
                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">All Seasons</h2>
                    
                    {seasonsLoading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                        <p className="mt-2 text-gray-600 dark:text-gray-300">Loading seasons...</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                          <thead className="bg-gray-50 dark:bg-gray-900">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Season
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Status
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Start Date
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                End Date
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {seasons.map((season) => (
                              <tr key={season.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900 dark:text-white">{season.name}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    season.isActive 
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                  }`}>
                                    {season.isActive ? 'Active' : 'Inactive'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                                  {new Date(season.startDate).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                                  {new Date(season.endDate).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                  {season.isActive ? (
                                    <button
                                      onClick={() => handleSeasonAction('deactivate', season.id, season.name)}
                                      disabled={actionLoading === `deactivate-${season.id}`}
                                      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 transition-colors"
                                    >
                                      {actionLoading === `deactivate-${season.id}` ? 'Deactivating...' : 'Deactivate'}
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleSeasonAction('activate', season.id, season.name)}
                                      disabled={actionLoading === `activate-${season.id}`}
                                      className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 disabled:opacity-50 transition-colors"
                                    >
                                      {actionLoading === `activate-${season.id}` ? 'Activating...' : 'Activate'}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        
                        {seasons.length === 0 && (
                          <div className="text-center py-8">
                            <p className="text-gray-500 dark:text-gray-400">No seasons found</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Game Management Tab */}
              {activeTab === 'games' && (
                <div className="space-y-6">
                  {/* Season Selector */}
                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Game Management</h2>
                    <div>
                      <label htmlFor="seasonSelect" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Select Season
                      </label>
                      <select
                        id="seasonSelect"
                        value={selectedSeason}
                        onChange={(e) => setSelectedSeason(e.target.value)}
                        className="input-field w-full max-w-md"
                      >
                        <option value="">Choose a season...</option>
                        {seasons.map((season) => (
                          <option key={season.id} value={season.id}>
                            {season.name} ({season.isActive ? 'Active' : 'Inactive'})
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    {selectedSeason && (
                      <div className="bg-blue-50 dark:bg-blue-900 border-l-4 border-blue-400 dark:border-blue-600 p-4 rounded">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <p className="text-sm text-blue-700 dark:text-blue-200">
                              <strong>Important:</strong> When you edit or delete a game, the entire season's ELO ratings will be recalculated chronologically to maintain accuracy. This ensures all ratings are based on the correct game sequence.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Games List */}
                  {selectedSeason && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Games for {seasons.find(s => s.id === selectedSeason)?.name}
                      </h3>
                      
                      {gamesLoading ? (
                        <div className="text-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                          <p className="mt-2 text-gray-600 dark:text-gray-300">Loading games...</p>
                        </div>
                      ) : games.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-gray-500 dark:text-gray-400">No games found for this season</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {games.map((game) => (
                            <div key={game.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                                    {/* Team 1 */}
                                    <div className="text-center">
                                      <div className="font-medium text-gray-900 dark:text-white">Team 1</div>
                                      <div className="text-sm text-gray-600 dark:text-gray-400">
                                        {game.team1.players.map(p => getUserName(typeof p === 'string' ? p : p.id)).join(' & ')}
                                      </div>
                                      <div className="text-lg font-bold text-gray-900 dark:text-white mt-1">{game.team1.score}</div>
                                    </div>

                                    {/* VS and Winner */}
                                    <div className="text-center">
                                      <div className="text-gray-500 dark:text-gray-400 text-sm">VS</div>
                                      <div className="mt-2">
                                        {game.team1.score > game.team2.score ? (
                                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                            🏆 Team 1 Wins
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                            🏆 Team 2 Wins
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        ±{game.eloChange} ELO
                                      </div>
                                    </div>

                                    {/* Team 2 */}
                                    <div className="text-center">
                                      <div className="font-medium text-gray-900 dark:text-white">Team 2</div>
                                      <div className="text-sm text-gray-600 dark:text-gray-400">
                                        {game.team2.players.map(p => getUserName(typeof p === 'string' ? p : p.id)).join(' & ')}
                                      </div>
                                      <div className="text-lg font-bold text-gray-900 dark:text-white mt-1">{game.team2.score}</div>
                                    </div>
                                  </div>

                                  <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 text-center">
                                    Played: {new Date(game.gameTime).toLocaleDateString()} at {new Date(game.gameTime).toLocaleTimeString()}
                                    {game.recordedBy?.name && ` • Recorded by ${game.recordedBy.name}`}
                                  </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex flex-col gap-2 ml-4">
                                  <button
                                    onClick={() => handleEditGame(game)}
                                    disabled={actionLoading?.startsWith('edit-') || actionLoading?.startsWith('delete-')}
                                    className="text-xs px-3 py-1 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900 rounded transition-colors disabled:opacity-50"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteGame(game.id)}
                                    disabled={actionLoading === `delete-${game.id}` || actionLoading?.startsWith('edit-')}
                                    className="text-xs px-3 py-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900 rounded transition-colors disabled:opacity-50"
                                  >
                                    {actionLoading === `delete-${game.id}` ? 'Deleting...' : 'Delete'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Edit Game Modal */}
          {editingGame && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Edit Game</h3>
                
                <div className="space-y-4">
                  {/* Team 1 Score */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Team 1 Score ({editingGame.team1.players.map(p => getUserName(p)).join(' & ')})
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={editingGame.team1.score}
                      onChange={(e) => setEditingGame(prev => prev ? {
                        ...prev,
                        team1: { ...prev.team1, score: parseInt(e.target.value) || 0 }
                      } : null)}
                      className="input-field w-full"
                    />
                  </div>

                  {/* Team 2 Score */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Team 2 Score ({editingGame.team2.players.map(p => getUserName(p)).join(' & ')})
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={editingGame.team2.score}
                      onChange={(e) => setEditingGame(prev => prev ? {
                        ...prev,
                        team2: { ...prev.team2, score: parseInt(e.target.value) || 0 }
                      } : null)}
                      className="input-field w-full"
                    />
                  </div>

                  {/* Game Time */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Game Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={editingGame.gameTime}
                      onChange={(e) => setEditingGame(prev => prev ? {
                        ...prev,
                        gameTime: e.target.value
                      } : null)}
                      className="input-field w-full"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setEditingGame(null)}
                    disabled={actionLoading?.startsWith('edit-')}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveGameEdit}
                    disabled={actionLoading?.startsWith('edit-')}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {actionLoading?.startsWith('edit-') ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Saving...
                      </div>
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 