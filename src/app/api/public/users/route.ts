import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function GET(request: NextRequest) {
  try {
    // This endpoint is public - no admin auth required
    // It only returns users that are marked as visible on leaderboard

    // Get all users
    const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers();

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    // Get user status information
    const { data: userStatus, error: statusError } = await supabaseAdmin
      .from('user_status')
      .select('*');

    if (statusError) {
      console.error('Error fetching user status:', statusError);
      return NextResponse.json({ error: 'Failed to fetch user status' }, { status: 500 });
    }

    // Filter and format only visible users
    const visibleUsers = users.users
      .map(user => {
        const status = userStatus?.find(s => s.user_id === user.id);
        return {
          id: user.id,
          email: user.email,
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at,
          is_paused: status?.is_paused || false,
          paused_at: status?.paused_at || null,
          is_approved: status?.is_approved || false,
          approved_at: status?.approved_at || null,
          approved_by: status?.approved_by || null,
          visible_on_leaderboard: status?.visible_on_leaderboard !== false,
          status: status
        };
      })
      .filter(user => user.visible_on_leaderboard !== false); // Only return visible users

    // Get visible user IDs
    const visibleUserIds = visibleUsers.map(user => user.id);

    // Get customers only for visible users
    const { data: customers, error: customersError } = await supabaseAdmin
      .from('customers')
      .select('*')
      .in('user_id', visibleUserIds)
      .order('created_at', { ascending: false });

    if (customersError) {
      console.error('Error fetching customers:', customersError);
      return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
    }

    // Only return customers that are also marked as visible
    const visibleCustomers = customers?.filter(customer =>
      customer.visible_on_leaderboard !== false
    ) || [];

    return NextResponse.json({
      users: visibleUsers,
      customers: visibleCustomers
    });

  } catch (error) {
    console.error('Public API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}