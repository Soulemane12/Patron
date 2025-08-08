import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  try {
    console.log('Loading service catalog...');
    
    const { data, error } = await supabaseAdmin
      .from('service_catalog')
      .select('id, code, name, description, price, currency')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error loading catalog:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    console.log(`Returning ${data?.length || 0} catalog items`);
    return NextResponse.json({ items: data ?? [] });
  } catch (error) {
    console.error('Unexpected error in catalog API:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

