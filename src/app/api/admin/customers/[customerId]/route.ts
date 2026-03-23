import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    // Check admin authorization
    const authHeader = request.headers.get('authorization');
    if (authHeader !== 'Bearer soulemane') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const customerData = await request.json();
    const { customerId } = await params;

    // Validate required fields
    const requiredFields = ['name', 'email', 'phone', 'service_address', 'installation_date', 'installation_time'];
    for (const field of requiredFields) {
      if (!customerData[field]) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
      }
    }

    // Use the stored procedure to update the customer (more efficient)
    const { data, error } = await supabaseAdmin.rpc('update_customer', {
      p_customer_id: customerId,
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
      console.error('Error updating customer:', error);
      return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // The stored procedure returns the updated customer
    return NextResponse.json({ success: true, customer: data[0] });

  } catch (error) {
    console.error('Error in admin customers PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    // Check admin authorization
    const authHeader = request.headers.get('authorization');
    if (authHeader !== 'Bearer soulemane') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customerId } = await params;

    // Use the stored procedure to delete the customer (more efficient)
    const { data: success, error } = await supabaseAdmin.rpc('delete_customer', {
      p_customer_id: customerId
    });

    if (error) {
      console.error('Error deleting customer:', error);
      return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 });
    }

    if (!success) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error in admin customers DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
