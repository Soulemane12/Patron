import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ disabled: true, reason: 'DB reset: mapping disabled' }, { status: 503 });
}

