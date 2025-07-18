'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Season } from '@/types';

interface User {
  isAdmin: boolean;
  firstName?: string;
  lastName?: string;
}

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonsLoading, setSeasonsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    deactivateOthers: true
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchUserData();
    fetchSeasons();
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
      }
    } catch (error) {
      console.error('Error fetching seasons:', error);
      setError('Failed to fetch seasons');
    } finally {
      setSeasonsLoading(false);
    }
  };

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (!user?.isAdmin) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-600 mt-1">Season Management</p>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 text-green-600 hover:text-green-700 font-medium transition-colors"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-800">{success}</p>
              </div>
            </div>
          </div>
        )}

        {/* Create Season Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Create New Season</h2>
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
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              {showCreateForm ? 'Cancel' : 'Create Season'}
            </button>
          </div>

          {showCreateForm && (
            <form onSubmit={handleCreateSeason} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="seasonName" className="block text-sm font-medium text-gray-700 mb-1">
                    Season Name
                  </label>
                  <input
                    type="text"
                    id="seasonName"
                    value={createFormData.name}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />
                  <label htmlFor="deactivateOthers" className="ml-2 text-sm text-gray-700">
                    Deactivate all other seasons
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    id="startDate"
                    value={createFormData.startDate}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    id="endDate"
                    value={createFormData.endDate}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={actionLoading === 'create'}
                  className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">All Seasons</h2>
          
          {seasonsLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading seasons...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Season
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Start Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      End Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {seasons.map((season) => (
                    <tr key={season.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{season.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          season.isActive 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {season.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(season.startDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(season.endDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        {season.isActive ? (
                          <button
                            onClick={() => handleSeasonAction('deactivate', season.id, season.name)}
                            disabled={actionLoading === `deactivate-${season.id}`}
                            className="text-red-600 hover:text-red-900 disabled:opacity-50 transition-colors"
                          >
                            {actionLoading === `deactivate-${season.id}` ? 'Deactivating...' : 'Deactivate'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSeasonAction('activate', season.id, season.name)}
                            disabled={actionLoading === `activate-${season.id}`}
                            className="text-green-600 hover:text-green-900 disabled:opacity-50 transition-colors"
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
                  <p className="text-gray-500">No seasons found</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 