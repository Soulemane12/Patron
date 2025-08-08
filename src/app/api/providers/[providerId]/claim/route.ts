import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ disabled: true, reason: 'DB reset: provider claim disabled' }, { status: 503 });
}

