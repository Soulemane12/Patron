import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Check for admin password in headers
    const authHeader = request.headers.get('authorization');
    if (!authHeader || authHeader !== 'Bearer soulemane') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await params;
    const userData = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // Check if user status record exists
    const { data: existingStatus, error: checkError } = await supabaseAdmin
      .from('user_status')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking user status:', checkError);
      return NextResponse.json({ error: 'Failed to check user status' }, { status: 500 });
    }

    if (existingStatus) {
      // Update existing record
      const { error } = await supabaseAdmin
        .from('user_status')
        .update({
          is_paused: userData.is_paused !== undefined ? userData.is_paused : existingStatus.is_paused,
          paused_at: userData.is_paused !== undefined ? (userData.is_paused ? new Date().toISOString() : null) : existingStatus.paused_at,
          is_approved: userData.is_approved !== undefined ? userData.is_approved : existingStatus.is_approved,
          approved_at: userData.is_approved !== undefined ? (userData.is_approved ? new Date().toISOString() : null) : existingStatus.approved_at,
          approved_by: userData.is_approved !== undefined ? (userData.is_approved ? 'admin' : null) : existingStatus.approved_by,
          visible_on_leaderboard: userData.visible_on_leaderboard !== undefined ? userData.visible_on_leaderboard : existingStatus.visible_on_leaderboard
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
        .insert({
          user_id: userId,
          is_paused: userData.is_paused || false,
          paused_at: userData.is_paused ? new Date().toISOString() : null,
          is_approved: userData.is_approved || false,
          approved_at: userData.is_approved ? new Date().toISOString() : null,
          approved_by: userData.is_approved ? 'admin' : null,
          visible_on_leaderboard: userData.visible_on_leaderboard !== false
        });

      if (error) {
        console.error('Error creating user status:', error);
        return NextResponse.json({ error: 'Failed to create user status' }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'User updated successfully'
    });

  } catch (error) {
    console.error('User update API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}