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

    // Update the customer using admin client (bypasses RLS)
    const { data, error } = await supabaseAdmin
      .from('customers')
      .update({
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
        updated_at: new Date().toISOString(),
      })
      .eq('id', customerId)
      .select();

    if (error) {
      console.error('Error updating customer:', error);
      return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
    }

    if (data.length === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

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

    // Delete the customer using admin client (bypasses RLS)
    const { error } = await supabaseAdmin
      .from('customers')
      .delete()
      .eq('id', customerId);

    if (error) {
      console.error('Error deleting customer:', error);
      return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error in admin customers DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
