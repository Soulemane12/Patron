import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function DELETE(request: NextRequest) {
  try {
    // Get the user from the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'No authorization token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    
    // Verify the token and get user
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Delete user's draft
    const { error } = await supabaseAdmin
      .from('customer_drafts')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      console.error('Error clearing draft:', error);
      return NextResponse.json(
        { error: 'Failed to clear draft' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Draft cleared successfully'
    });

  } catch (error) {
    console.error('Error in clear draft API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
