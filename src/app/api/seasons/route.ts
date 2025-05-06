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
    const seasonData = await request.json();
    const newSeason = await createSeason(seasonData);
    
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