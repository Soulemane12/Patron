import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function GET(request: NextRequest) {
  try {
    // Check for admin password in headers
    const authHeader = request.headers.get('authorization');
    if (!authHeader || authHeader !== 'Bearer soulemane') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all users
    const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (usersError) {
      console.error('Error fetching users:', usersError);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    // Get all customers
    const { data: customers, error: customersError } = await supabaseAdmin
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });

    if (customersError) {
      console.error('Error fetching customers:', customersError);
      return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
    }

    // Get user status information
    const { data: userStatus, error: statusError } = await supabaseAdmin
      .from('user_status')
      .select('*');

    if (statusError) {
      console.error('Error fetching user status:', statusError);
    }

    // Format user data with status
    const formattedUsers = users.users.map(user => {
      const status = userStatus?.find(s => s.user_id === user.id);
      return {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        email_confirmed_at: user.email_confirmed_at,
        phone: user.phone,
        confirmed_at: user.confirmed_at,
        is_paused: status?.is_paused || false,
        paused_at: status?.paused_at || null,
        is_approved: status?.is_approved || false,
        approved_at: status?.approved_at || null,
        approved_by: status?.approved_by || null
      };
    });

    return NextResponse.json({
      users: formattedUsers,
      customers: customers || []
    });

  } catch (error) {
    console.error('Admin API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
