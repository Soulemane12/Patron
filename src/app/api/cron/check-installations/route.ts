import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({ disabled: true, reason: 'DB reset: cron disabled' });
} 