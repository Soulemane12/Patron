import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ disabled: true, reason: 'DB reset: provider requests disabled' }, { status: 503 });
}

