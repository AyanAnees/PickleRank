'use client';

import React, { useState } from 'react';
import { Season } from '../types';
import { createNewSeason } from '../utils/season';

interface SeasonManagerProps {
  onSeasonCreate: (season: Season) => void;
}

export default function SeasonManager({ onSeasonCreate }: SeasonManagerProps) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const season = createNewSeason(
        name,
        new Date(startDate),
        new Date(endDate)
      );
      
      onSeasonCreate(season);
      
      // Reset form
      setName('');
      setStartDate('');
      setEndDate('');
    } catch (error) {
      console.error('Error creating season:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card space-y-4">
      <h3 className="text-xl font-semibold">Create New Season</h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Season Name
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field mt-1"
            placeholder="e.g., Summer 2024"
            required
          />
        </div>

        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
            Start Date
          </label>
          <input
            type="date"
            id="startDate"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="input-field mt-1"
            required
          />
        </div>

        <div>
          <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
            End Date
          </label>
          <input
            type="date"
            id="endDate"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="input-field mt-1"
            required
          />
        </div>

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creating...' : 'Create Season'}
        </button>
      </form>
    </div>
  );
} 