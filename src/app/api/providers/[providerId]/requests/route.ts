import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: Request, context: any) {
  try {
    const providerId = context?.params?.providerId as string;
    const url = new URL(request.url);
    const includePending = url.searchParams.get('includePending') === 'true';

    // Requests assigned to this provider
    const { data: assigned, error: assignedError } = await supabaseAdmin
      .from('service_requests')
      .select('*')
      .eq('provider_id', providerId)
      .order('created_at', { ascending: false });

    if (assignedError) {
      return NextResponse.json({ error: assignedError.message }, { status: 500 });
    }

    let claimable: any[] = [];
    if (includePending) {
      // Find services this provider can perform
      const { data: svcMap, error: mapError } = await supabaseAdmin
        .from('provider_services')
        .select('service_id')
        .eq('provider_id', providerId)
        .eq('is_active', true);

      if (!mapError && svcMap && svcMap.length > 0) {
        const serviceIds = svcMap.map((m) => m.service_id);
        const { data: pending, error: pendingError } = await supabaseAdmin
          .from('service_requests')
          .select('*')
          .is('provider_id', null)
          .eq('status', 'pending')
          .in('service_id', serviceIds)
          .order('created_at', { ascending: false });

        if (!pendingError && pending) {
          claimable = pending;
        }
      }
    }

    return NextResponse.json({ assigned: assigned ?? [], claimable });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

