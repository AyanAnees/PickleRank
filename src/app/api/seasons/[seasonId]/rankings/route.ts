import { NextResponse } from 'next/server';
import { getSeasonRankings } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: { seasonId: string } }
) {
  try {
    const { seasonId } = params;
    const { rankings, users } = await getSeasonRankings(seasonId);
    
    // Return empty arrays if no rankings found
    return NextResponse.json({
      rankings: rankings || [],
      users: users || []
    });
  } catch (error) {
    console.error('Error fetching rankings:', error);
    return NextResponse.json(
      { rankings: [], users: [], error: 'Failed to fetch rankings' },
      { status: 500 }
    );
  }
} 