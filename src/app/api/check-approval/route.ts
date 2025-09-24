import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // Get user approval status
    const { data: userStatus, error: statusError } = await supabaseAdmin
      .from('user_status')
      .select('is_approved, is_paused')
      .eq('user_id', userId)
      .single();

    if (statusError && statusError.code !== 'PGRST116') {
      console.error('Error checking user status:', statusError);
      return NextResponse.json({ error: 'Failed to check user status' }, { status: 500 });
    }

    // If no record exists, user is not approved by default
    const isApproved = userStatus?.is_approved || false;
    const isPaused = userStatus?.is_paused || false;

    return NextResponse.json({
      isApproved,
      isPaused,
      needsApproval: !isApproved
    });

  } catch (error) {
    console.error('Check approval API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}