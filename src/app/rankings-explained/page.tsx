'use client';

import Link from 'next/link';

export default function RankingsExplained() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">How Rankings Work</h1>
      
      <div className="prose prose-indigo">
        <p className="text-gray-600 mb-6">
          The system uses the ELO rating system, but with a twist: not only does winning or losing affect your rating, but the margin of victory (the score difference) also plays a role. This means a close win (like 11-9) will result in a smaller ELO gain than a dominant win (like 11-2).
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4">Starting Points</h2>
        <p className="mb-4">
          • Everyone starts with a rating of 1500 points<br />
          • You need to play at least 5 games to appear in the rankings
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4">How Points Change</h2>
        <p className="mb-4">
          After each game, your rating changes based on:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>Whether you won or lost</li>
          <li>The difference between your team's rating and your opponents' rating</li>
          <li>The margin of victory (score difference) &mdash; bigger wins mean bigger ELO swings</li>
          <li>If you win against a higher-rated team, you gain more points</li>
          <li>If you lose to a lower-rated team, you lose more points</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-4">Example Scenarios</h2>
        <div className="space-y-4 mb-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Close Game (11-9)</h3>
            <p>• Winner gains a small amount of ELO<br />
               • Loser loses a small amount of ELO</p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Blowout (11-2)</h3>
            <p>• Winner gains a larger amount of ELO<br />
               • Loser loses a larger amount of ELO</p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Underdog Wins (1400 vs 1600, 11-7)</h3>
            <p>• Winner gains even more ELO for beating a higher-rated team<br />
               • Loser loses more ELO</p>
          </div>
        </div>

        <h2 className="text-xl font-semibold mt-8 mb-4">Team Ratings</h2>
        <p className="mb-4">
          In doubles games, your team's rating is the average of both players' ratings. This helps balance teams and make the games more competitive.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4">Season Rankings</h2>
        <p className="mb-4">
          • Each season starts fresh with new ratings<br />
          • Your rating resets to 1500 at the start of each season<br />
          • This gives everyone a fair chance to climb the rankings
        </p>

        <div className="mt-8">
          <Link href="/" className="text-indigo-600 hover:text-indigo-500">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
} 