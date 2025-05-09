import { NextResponse } from 'next/server';
import { createSeason, getSeasons, deleteAllSeasons } from '@/lib/db';
import { Season } from '@/types';

export async function GET() {
  try {
    const seasons = await getSeasons();
    return NextResponse.json(seasons);
  } catch (error) {
    console.error('Error fetching seasons:', error);
    return NextResponse.json(
      { error: 'Failed to fetch seasons' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // End the current active season
    const now = new Date();
    const seasonsRef = (await import('@/lib/firebase-admin')).db.collection('seasons');
    const activeSeasonsQuery = seasonsRef.where('isActive', '==', true).where('startDate', '<=', now).where('endDate', '>=', now);
    const activeSeasons = await activeSeasonsQuery.get();
    let lastSeasonNumber = 0;
    if (!activeSeasons.empty) {
      for (const doc of activeSeasons.docs) {
        await doc.ref.update({ isActive: false });
        const match = doc.data().name.match(/Season (\d+)/);
        if (match) lastSeasonNumber = Math.max(lastSeasonNumber, parseInt(match[1]));
      }
    } else {
      // Get the latest season number if no active season
      const allSeasons = await seasonsRef.orderBy('startDate', 'desc').limit(1).get();
      if (!allSeasons.empty) {
        const match = allSeasons.docs[0].data().name.match(/Season (\d+)/);
        if (match) lastSeasonNumber = parseInt(match[1]);
      }
    }
    // Create new season for 2 months
    const startDate = now;
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 2);
    const newSeasonData = {
      name: `Season ${lastSeasonNumber + 1}`,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      isActive: true,
      settings: (await import('@/utils/season')).DEFAULT_SEASON_SETTINGS,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    const { createSeason } = await import('@/lib/db');
    const newSeason = await createSeason(newSeasonData);
    if (!newSeason) {
      return NextResponse.json({ error: 'Failed to create season' }, { status: 500 });
    }
    return NextResponse.json(newSeason, { status: 201 });
  } catch (error) {
    console.error('Error creating season:', error);
    return NextResponse.json(
      { error: 'Failed to create season' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    await deleteAllSeasons();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting seasons:', error);
    return NextResponse.json(
      { error: 'Failed to delete seasons' },
      { status: 500 }
    );
  }
} 