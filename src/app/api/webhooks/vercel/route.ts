import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const payload = await request.json();
  
  if (payload.ref === 'refs/heads/qa') {
    console.log('QA deployment completed');
  }
  
  return NextResponse.json({ status: 'ok' });
} 