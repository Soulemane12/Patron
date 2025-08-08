import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const { providerId, catalogId } = await request.json();
    if (!providerId || !catalogId) {
      return NextResponse.json({ error: 'providerId and catalogId are required' }, { status: 400 });
    }

    // Ensure provider exists
    const { data: prov, error: provErr } = await supabaseAdmin
      .from('providers')
      .select('id')
      .eq('id', providerId)
      .maybeSingle();
    if (provErr || !prov) return NextResponse.json({ error: 'Provider not found' }, { status: 404 });

    // Ensure catalog item exists
    const { data: cat, error: catErr } = await supabaseAdmin
      .from('service_catalog')
      .select('id')
      .eq('id', catalogId)
      .maybeSingle();
    if (catErr || !cat) return NextResponse.json({ error: 'Catalog item not found' }, { status: 404 });

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

