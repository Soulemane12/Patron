import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

type CreateServiceRequestBody = {
  userId: string;
  serviceId?: string;
  serviceCode?: string;
  scheduledDate?: string; // ISO string
  notes?: string;
};

async function resolveServiceIdFromCode(serviceCode: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('services')
    .select('id')
    .eq('code', serviceCode)
    .maybeSingle();

  if (error) return null;
  return data?.id ?? null;
}

async function pickEligibleProviderForService(
  serviceId: string,
  scheduledDate?: string
): Promise<string | null> {
  // Find providers that are active and offer this service
  const { data: eligibleProviders, error: eligibleError } = await supabaseAdmin
    .from('provider_services')
    .select('provider_id, providers!inner(is_active)')
    .eq('service_id', serviceId)
    .eq('is_active', true)
    .eq('providers.is_active', true);

  if (eligibleError || !eligibleProviders || eligibleProviders.length === 0) {
    return null;
  }

  // Optional availability check: avoid providers already scheduled at the same time
  let availableProviderIds = eligibleProviders.map((row: any) => row.provider_id as string);

  if (scheduledDate && availableProviderIds.length > 0) {
    const { data: busy, error: busyError } = await supabaseAdmin
      .from('service_requests')
      .select('provider_id')
      .in('provider_id', availableProviderIds)
      .in('status', ['claimed', 'accepted'])
      .eq('scheduled_date', scheduledDate);

    if (!busyError && busy) {
      const busyIds = new Set(busy.map((b) => b.provider_id));
      availableProviderIds = availableProviderIds.filter((id) => !busyIds.has(id));
    }
  }

  if (availableProviderIds.length === 0) return null;

  // Simple selection strategy: random available provider
  const randomIndex = Math.floor(Math.random() * availableProviderIds.length);
  return availableProviderIds[randomIndex];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateServiceRequestBody;

    if (!body || !body.userId || (!body.serviceId && !body.serviceCode)) {
      return NextResponse.json(
        { error: 'Missing required fields: userId and serviceId/serviceCode' },
        { status: 400 }
      );
    }

    let serviceId = body.serviceId ?? null;
    if (!serviceId && body.serviceCode) {
      serviceId = await resolveServiceIdFromCode(body.serviceCode);
      if (!serviceId) {
        return NextResponse.json(
          { error: 'Service not found for provided code' },
          { status: 404 }
        );
      }
    }

    // Attempt to pick an eligible provider
    const chosenProviderId = await pickEligibleProviderForService(serviceId as string, body.scheduledDate);

    const insertPayload: any = {
      user_id: body.userId,
      service_id: serviceId,
      status: 'pending',
      scheduled_date: body.scheduledDate ?? null,
      notes: body.notes ?? null,
    };

    const { data: created, error: insertError } = await supabaseAdmin
      .from('service_requests')
      .insert(insertPayload)
      .select('*')
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // If we selected a provider, attempt to auto-claim using DB function
    if (chosenProviderId && created?.id) {
      const { data: claimOk, error: claimError } = await supabaseAdmin.rpc(
        'claim_service_request',
        {
          request_id: created.id,
          claiming_provider_id: chosenProviderId,
        }
      );

      if (claimError) {
        // Fall back to returning the pending request
        return NextResponse.json({ request: created, autoAssignedProviderId: null, claimError: claimError.message });
      }

      if (claimOk) {
        const { data: updated, error: fetchError } = await supabaseAdmin
          .from('service_requests')
          .select('*')
          .eq('id', created.id)
          .single();

        if (!fetchError && updated) {
          return NextResponse.json({ request: updated, autoAssignedProviderId: chosenProviderId });
        }
      }
    }

    return NextResponse.json({ request: created, autoAssignedProviderId: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

