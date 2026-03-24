import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // auto-confirm, no email needed
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Auto-approve new user so they can access the app immediately
    await supabaseAdmin.from('user_status').insert({
      user_id: data.user.id,
      is_approved: true,
      is_paused: false,
    });

    return NextResponse.json({ user: data.user });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
