import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';

export async function POST(request: NextRequest) {
  try {
    // Check for admin password in headers
    const authHeader = request.headers.get('authorization');
    if (!authHeader || authHeader !== 'Bearer soulemane') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId, action } = await request.json();

    if (!userId || !action) {
      return NextResponse.json({ error: 'Missing userId or action' }, { status: 400 });
    }

    if (action !== 'pause' && action !== 'unpause') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const isPaused = action === 'pause';

    // Check if user_status record exists
    const { data: existingStatus } = await supabaseAdmin
      .from('user_status')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (existingStatus) {
      // Update existing record
      const { error } = await supabaseAdmin
        .from('user_status')
        .update({
          is_paused: isPaused,
          paused_at: isPaused ? new Date().toISOString() : null,
          paused_by: isPaused ? 'admin' : null
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating user status:', error);
        return NextResponse.json({ error: 'Failed to update user status' }, { status: 500 });
      }
    } else {
      // Create new record
      const { error } = await supabaseAdmin
        .from('user_status')
        .insert([{
          user_id: userId,
          is_paused: isPaused,
          paused_at: isPaused ? new Date().toISOString() : null,
          paused_by: isPaused ? 'admin' : null
        }]);

      if (error) {
        console.error('Error creating user status:', error);
        return NextResponse.json({ error: 'Failed to create user status' }, { status: 500 });
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `User ${isPaused ? 'paused' : 'unpaused'} successfully` 
    });

  } catch (error) {
    console.error('Pause user API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
