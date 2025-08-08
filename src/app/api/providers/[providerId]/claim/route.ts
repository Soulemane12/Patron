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
      .from('users')
      .select('user_type')
      .eq('id', providerId)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    if (!profile || profile.user_type !== 'provider') {
      return NextResponse.json({ error: 'User is not a provider' }, { status: 403 });
    }

    // Attempt to claim the request using DB function if present; otherwise set accepted directly
    let claimedOk = false;

    const { data: claimOk, error: claimError } = await supabaseAdmin.rpc('claim_service_request', {
      request_id: requestId,
      claiming_provider_id: providerId,
    });

    if (!claimError && claimOk === true) {
      claimedOk = true;
    } else {
      // Fallback: accept directly if enum does not have 'claimed'
      const { error: updateError } = await supabaseAdmin
        .from('service_requests')
        .update({
          status: 'accepted',
          provider_id: providerId,
          claimed_by: providerId,
          claimed_at: new Date().toISOString(),
          expires_at: null,
        })
        .eq('id', requestId)
        .is('provider_id', null)
        .eq('status', 'pending');

      if (!updateError) {
        claimedOk = true;
      }
    }

    if (!claimedOk) {
      return NextResponse.json({ error: 'Unable to claim request' }, { status: 409 });
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

