import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  return NextResponse.json({ error: 'Service requests disabled during DB reset' }, { status: 503 });
}

