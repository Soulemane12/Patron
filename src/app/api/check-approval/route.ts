import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Returns the approval/pause status of the user who owns the bearer access token.
// Users with no user_status row are treated as pending.
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: status, error: statusError } = await supabaseAdmin
      .from('user_status')
      .select('is_approved, is_paused')
      .eq('user_id', user.id)
      .maybeSingle();

    if (statusError) {
      console.error('Error checking user status:', statusError);
      return NextResponse.json({ error: 'Failed to check user status' }, { status: 500 });
    }

    return NextResponse.json({
      isApproved: status?.is_approved === true,
      isPaused: status?.is_paused === true,
    });
  } catch (error) {
    console.error('Check approval API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
