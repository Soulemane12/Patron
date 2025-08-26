import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function POST(request: NextRequest) {
  try {
    // Check admin authorization
    const authHeader = request.headers.get('authorization');
    if (authHeader !== 'Bearer soulemane') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const customerData = await request.json();

    // Validate required fields
    const requiredFields = ['user_id', 'name', 'email', 'phone', 'service_address', 'installation_date', 'installation_time'];
    for (const field of requiredFields) {
      if (!customerData[field]) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
      }
    }

    // Insert the customer using admin client (bypasses RLS)
    const { data, error } = await supabaseAdmin
      .from('customers')
      .insert([{
        user_id: customerData.user_id,
        name: customerData.name,
        email: customerData.email,
        phone: customerData.phone,
        service_address: customerData.service_address,
        installation_date: customerData.installation_date,
        installation_time: customerData.installation_time,
        status: customerData.status || 'active',
        is_referral: customerData.is_referral || false,
        referral_source: customerData.is_referral ? customerData.referral_source : null,
        lead_size: customerData.lead_size || '2GIG',
      }])
      .select();

    if (error) {
      console.error('Error adding customer:', error);
      return NextResponse.json({ error: 'Failed to add customer' }, { status: 500 });
    }

    return NextResponse.json({ success: true, customer: data[0] });

  } catch (error) {
    console.error('Error in admin customers POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
