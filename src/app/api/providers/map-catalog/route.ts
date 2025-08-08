import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const { providerId, catalogId } = await request.json();
    if (!providerId || !catalogId) {
      return NextResponse.json({ error: 'providerId and catalogId are required' }, { status: 400 });
    }

    // Verify this is actually a provider user
    const { data: user, error: userError } = await supabaseAdmin.auth.admin.getUserById(providerId);
    if (userError || !user.user) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }

    // Check if user has provider profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('provider_profiles')
      .select('user_type')
      .eq('id', providerId)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    if (!profile || profile.user_type !== 'provider') {
      return NextResponse.json({ error: 'User is not a provider' }, { status: 403 });
    }

    // Ensure catalog item exists
    const { data: cat, error: catError } = await supabaseAdmin
      .from('service_catalog')
      .select('id')
      .eq('id', catalogId)
      .maybeSingle();
    if (catError || !cat) return NextResponse.json({ error: 'Catalog item not found' }, { status: 404 });

    // Insert mapping (idempotent)
    const { error: mapErr } = await supabaseAdmin
      .from('provider_services')
      .insert({ provider_id: providerId, catalog_id: catalogId, is_active: true });

    if (mapErr && mapErr.code !== '23505') {
      // 23505 = unique violation => already mapped
      return NextResponse.json({ error: mapErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

