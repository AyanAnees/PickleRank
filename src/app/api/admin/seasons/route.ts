import { NextResponse } from 'next/server';
import { adminAuth, db } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { DEFAULT_SEASON_SETTINGS } from '@/utils/season';

async function isAdmin(request: Request): Promise<boolean> {
  try {
    const authToken = request.headers.get('cookie')?.split('auth-token=')[1]?.split(';')[0];
    if (!authToken) return false;
    
    const decodedToken = await adminAuth.verifyIdToken(authToken);
    const userId = decodedToken.uid;
    
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    return userData?.isAdmin === true;
  } catch (error) {
    return false;
  }
}

export async function POST(request: Request) {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { action, seasonData } = await request.json();

    switch (action) {
      case 'create':
        return await createNewSeason(seasonData);
      case 'deactivate':
        return await deactivateSeason(seasonData.seasonId);
      case 'activate':
        return await activateSeason(seasonData.seasonId);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in admin seasons API:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

async function createNewSeason(seasonData: any) {
  try {
    const { name, startDate, endDate, deactivateOthers = true } = seasonData;

    // Validate input
    if (!name || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Name, start date, and end date are required' },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      return NextResponse.json(
        { error: 'Start date must be before end date' },
        { status: 400 }
      );
    }

    // Deactivate all other seasons if requested
    if (deactivateOthers) {
      const activeSeasons = await db.collection('seasons').where('isActive', '==', true).get();
      const batch = db.batch();
      
      activeSeasons.docs.forEach(doc => {
        batch.update(doc.ref, {
          isActive: false,
          updatedAt: Timestamp.now()
        });
      });
      
      await batch.commit();
    }

    // Create new season
    const newSeasonData = {
      name,
      startDate: Timestamp.fromDate(start),
      endDate: Timestamp.fromDate(end),
      isActive: true,
      settings: DEFAULT_SEASON_SETTINGS,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    const docRef = await db.collection('seasons').add(newSeasonData);

    // Initialize rankings for all existing users
    const usersSnapshot = await db.collection('users').get();
    const batch = db.batch();

    usersSnapshot.docs.forEach(userDoc => {
      const userId = userDoc.id;
      const rankingRef = db.collection('rankings').doc(`${docRef.id}_${userId}`);
      
      batch.set(rankingRef, {
        seasonId: docRef.id,
        userId,
        currentElo: 1500,
        wins: 0,
        losses: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // Initialize season stats for each user
      const userRef = db.collection('users').doc(userId);
      batch.update(userRef, {
        [`seasonStats.${docRef.id}`]: {
          eloRating: 1500,
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
          highestElo: 1500,
          lowestElo: 1500,
          winStreak: 0,
          currentStreak: 0,
        }
      });
    });

    await batch.commit();

    // Get the created season
    const createdDoc = await docRef.get();
    const createdData = createdDoc.data();

    return NextResponse.json({
      success: true,
      season: {
        id: docRef.id,
        name: createdData?.name,
        startDate: createdData?.startDate.toDate().toISOString(),
        endDate: createdData?.endDate.toDate().toISOString(),
        isActive: createdData?.isActive,
        settings: createdData?.settings || DEFAULT_SEASON_SETTINGS,
        createdAt: createdData?.createdAt.toDate().toISOString(),
        updatedAt: createdData?.updatedAt.toDate().toISOString()
      }
    });

  } catch (error) {
    console.error('Error creating season:', error);
    return NextResponse.json(
      { error: 'Failed to create season' },
      { status: 500 }
    );
  }
}

async function deactivateSeason(seasonId: string) {
  try {
    const seasonRef = db.collection('seasons').doc(seasonId);
    const seasonDoc = await seasonRef.get();

    if (!seasonDoc.exists) {
      return NextResponse.json(
        { error: 'Season not found' },
        { status: 404 }
      );
    }

    await seasonRef.update({
      isActive: false,
      updatedAt: Timestamp.now()
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deactivating season:', error);
    return NextResponse.json(
      { error: 'Failed to deactivate season' },
      { status: 500 }
    );
  }
}

async function activateSeason(seasonId: string) {
  try {
    const seasonRef = db.collection('seasons').doc(seasonId);
    const seasonDoc = await seasonRef.get();

    if (!seasonDoc.exists) {
      return NextResponse.json(
        { error: 'Season not found' },
        { status: 404 }
      );
    }

    // Deactivate all other seasons first
    const activeSeasons = await db.collection('seasons').where('isActive', '==', true).get();
    const batch = db.batch();
    
    activeSeasons.docs.forEach(doc => {
      if (doc.id !== seasonId) {
        batch.update(doc.ref, {
          isActive: false,
          updatedAt: Timestamp.now()
        });
      }
    });

    // Activate the target season
    batch.update(seasonRef, {
      isActive: true,
      updatedAt: Timestamp.now()
    });

    await batch.commit();

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error activating season:', error);
    return NextResponse.json(
      { error: 'Failed to activate season' },
      { status: 500 }
    );
  }
} 