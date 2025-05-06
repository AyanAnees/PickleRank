import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, deleteDoc } from 'firebase/firestore';

export async function DELETE(
  request: Request,
  { params }: { params: { seasonId: string } }
) {
  try {
    const { seasonId } = params;
    await deleteDoc(doc(db, 'seasons', seasonId));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting season:', error);
    return NextResponse.json(
      { error: 'Failed to delete season' },
      { status: 500 }
    );
  }
} 