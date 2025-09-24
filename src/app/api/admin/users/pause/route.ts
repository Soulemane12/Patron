import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';

export async function POST(request: NextRequest) {
  try {
    // Check for admin password in headers
    const authHeader = request.headers.get('authorization');
    if (!authHeader || authHeader !== 'Bearer soulemane') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId, action, forceUnpause } = await request.json();

    if (!userId || !action) {
      return NextResponse.json({ error: 'Missing userId or action' }, { status: 400 });
    }

    if (action !== 'pause' && action !== 'unpause' && action !== 'force_unpause') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const isPaused = action === 'pause';
    const isForceUnpause = action === 'force_unpause' || forceUnpause;

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
  
      // Handle force unpause - delete the record entirely to ensure clean state
      if (isForceUnpause) {
        console.log('Force unpausing user - deleting user_status record');
        const { error: deleteError } = await supabaseAdmin
          .from('user_status')
          .delete()
          .eq('user_id', userId);
        
        if (deleteError) {
          console.error('Error force unpausing user:', deleteError);
          return NextResponse.json({ 
            error: `Failed to force unpause user: ${deleteError.message}`, 
            details: deleteError 
          }, { status: 500 });
        }
      } else if (existingStatus) {
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
          return NextResponse.json({ 
            error: `Failed to update user status: ${error.message}`, 
            details: error 
          }, { status: 500 });
        }
      } else {
        // Create new record only if we're pausing (not unpausing non-existent record)
        if (isPaused) {
          const { error } = await supabaseAdmin
            .from('user_status')
            .insert({
              user_id: userId,
              is_paused: true,
              paused_at: new Date().toISOString(),
              paused_by: 'admin'
            });
    
          if (error) {
            console.error('Error creating user status:', error);
            return NextResponse.json({ 
              error: `Failed to create user status: ${error.message}`, 
              details: error 
            }, { status: 500 });
          }
        }
        // If unpausing and no record exists, that means user is already unpaused - success
      }
    } catch (error: any) {
      console.error('Error managing user status:', error);
      return NextResponse.json({ 
        error: `User status operation failed: ${error.message || 'Unknown error'}` 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: isForceUnpause ? 'User force unpaused successfully' : `User ${isPaused ? 'paused' : 'unpaused'} successfully` 
    });

  } catch (error) {
    console.error('Pause user API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
