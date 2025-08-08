import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: Request, context: any) {
  try {
    const providerId = context?.params?.providerId as string;
    
    if (!providerId) {
      return NextResponse.json({ error: 'Provider ID is required' }, { status: 400 });
    }

    const url = new URL(request.url);
    const includePending = url.searchParams.get('includePending') === 'true';

    console.log(`Loading requests for provider: ${providerId}, includePending: ${includePending}`);

    // First verify this is actually a provider
    const { data: user, error: userError } = await supabaseAdmin.auth.admin.getUserById(providerId);
    if (userError || !user.user) {
      console.error('Error loading user:', userError);
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }

    // Check if user has provider profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('provider_profiles')
      .select('user_type')
      .eq('id', providerId)
      .maybeSingle();

    if (profileError) {
      console.error('Error loading provider profile:', profileError);
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    if (!profile || profile.user_type !== 'provider') {
      return NextResponse.json({ error: 'User is not a provider' }, { status: 403 });
    }

    // Requests assigned to this provider
    const { data: assigned, error: assignedError } = await supabaseAdmin
      .from('service_requests')
      .select('*')
      .eq('provider_id', providerId)
      .order('created_at', { ascending: false });

    if (assignedError) {
      console.error('Error loading assigned requests:', assignedError);
      return NextResponse.json({ error: assignedError.message }, { status: 500 });
    }

    let claimable: any[] = [];
    if (includePending) {
      // Find services this provider can perform
      const { data: svcMap, error: mapError } = await supabaseAdmin
        .from('provider_services')
        .select('catalog_id')
        .eq('provider_id', providerId)
        .eq('is_active', true);

      if (mapError) {
        console.error('Error loading provider services:', mapError);
        return NextResponse.json({ error: mapError.message }, { status: 500 });
      }

      if (svcMap && svcMap.length > 0) {
        const catalogIds = svcMap.map((m) => m.catalog_id);
        const { data: pending, error: pendingError } = await supabaseAdmin
          .from('service_requests')
          .select('*')
          .is('provider_id', null)
          .eq('status', 'pending')
          .in('service_id', catalogIds)
          .order('created_at', { ascending: false });

        if (pendingError) {
          console.error('Error loading pending requests:', pendingError);
          return NextResponse.json({ error: pendingError.message }, { status: 500 });
        }

        claimable = pending || [];
      }
    }

    console.log(`Returning ${assigned?.length || 0} assigned, ${claimable.length} claimable requests`);
    return NextResponse.json({ assigned: assigned ?? [], claimable });
  } catch (error) {
    console.error('Unexpected error in requests API:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

