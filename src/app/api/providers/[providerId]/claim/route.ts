import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request, context: any) {
  try {
    const providerId = context?.params?.providerId as string;
    const { requestId } = await request.json();
    if (!requestId) {
      return NextResponse.json({ error: 'requestId is required' }, { status: 400 });
    }

    // Verify this is actually a provider user
    const { data: user, error: userError } = await supabaseAdmin.auth.admin.getUserById(providerId);
    if (userError || !user.user) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }

    // Check if user has provider profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('user_type')
      .eq('id', providerId)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    if (!profile || profile.user_type !== 'provider') {
      return NextResponse.json({ error: 'User is not a provider' }, { status: 403 });
    }

    // Claim the request by updating it
    const { error: updateError } = await supabaseAdmin
      .from('service_requests')
      .update({
        status: 'accepted',
        provider_id: providerId,
        claimed_by: providerId,
        claimed_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .is('provider_id', null)
      .eq('status', 'pending');

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const { data: updated, error: fetchError } = await supabaseAdmin
      .from('service_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    return NextResponse.json({ request: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

