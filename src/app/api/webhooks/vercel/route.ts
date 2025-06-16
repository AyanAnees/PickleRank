import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const payload = await request.json();
  
  if (payload.ref === 'refs/heads/qa') {
    // QA deployment completed
  }
  
  return NextResponse.json({ status: 'ok' });
} 