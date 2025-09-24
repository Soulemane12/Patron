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

    if (action !== 'approve' && action !== 'disapprove') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const isApproved = action === 'approve';

    try {
      // Check if this specific user status exists
      const { data: existingStatus, error: checkError } = await supabaseAdmin
        .from('user_status')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        // Not a "no rows returned" error, but some other error
        console.error('Error checking user status:', checkError);
      }

      if (existingStatus) {
        // Update existing record
        const { error } = await supabaseAdmin
          .from('user_status')
          .update({
            is_approved: isApproved,
            approved_at: isApproved ? new Date().toISOString() : null,
            approved_by: isApproved ? 'admin' : null
          })
          .eq('user_id', userId);

        if (error) {
          console.error('Error updating user approval status:', error);
          return NextResponse.json({
            error: `Failed to update user approval status: ${error.message}`,
            details: error
          }, { status: 500 });
        }
      } else {
        // Create new record
        const { error } = await supabaseAdmin
          .from('user_status')
          .insert({
            user_id: userId,
            is_approved: isApproved,
            approved_at: isApproved ? new Date().toISOString() : null,
            approved_by: isApproved ? 'admin' : null,
            is_paused: false
          });

        if (error) {
          console.error('Error creating user approval status:', error);
          return NextResponse.json({
            error: `Failed to create user approval status: ${error.message}`,
            details: error
          }, { status: 500 });
        }
      }
    } catch (error: any) {
      console.error('Error managing user approval status:', error);
      return NextResponse.json({
        error: `User approval operation failed: ${error.message || 'Unknown error'}`
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `User ${isApproved ? 'approved' : 'disapproved'} successfully`
    });

  } catch (error) {
    console.error('Approve user API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}