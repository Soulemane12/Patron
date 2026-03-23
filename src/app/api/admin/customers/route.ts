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

    // Use the stored procedure to add the customer (more efficient)
    const { data, error } = await supabaseAdmin.rpc('add_customer', {
      p_user_id: customerData.user_id,
      p_name: customerData.name,
      p_email: customerData.email,
      p_phone: customerData.phone,
      p_service_address: customerData.service_address,
      p_installation_date: customerData.installation_date,
      p_installation_time: customerData.installation_time,
      p_status: customerData.status || 'active',
      p_is_referral: customerData.is_referral || false,
      p_referral_source: customerData.is_referral ? customerData.referral_source : null,
      p_lead_size: customerData.lead_size || '2GIG',
    });

    if (error) {
      console.error('Error adding customer:', error);
      return NextResponse.json({ error: 'Failed to add customer' }, { status: 500 });
    }

    // The stored procedure returns the newly created customer
    return NextResponse.json({ success: true, customer: data[0] });

  } catch (error) {
    console.error('Error in admin customers POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
