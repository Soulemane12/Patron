import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function GET(request: NextRequest) {
  try {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tenDaysAgo = new Date(today);
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    // Format dates for database query
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const tenDaysAgoStr = tenDaysAgo.toISOString().split('T')[0];

    // Get customers with installations today
    const { data: todayCustomers, error: todayError } = await supabase
      .from('customers')
      .select('*')
      .eq('installation_date', todayStr);

    if (todayError) throw todayError;

    // Get customers with installations tomorrow
    const { data: tomorrowCustomers, error: tomorrowError } = await supabase
      .from('customers')
      .select('*')
      .eq('installation_date', tomorrowStr);

    if (tomorrowError) throw tomorrowError;

    // Get customers with installations 10 days ago
    const { data: followUpCustomers, error: followUpError } = await supabase
      .from('customers')
      .select('*')
      .eq('installation_date', tenDaysAgoStr);

    if (followUpError) throw followUpError;

    // Check if notifications were already sent
    const checkNotificationSent = async (customerId: string, notificationType: string) => {
      const { data } = await supabase
        .from('email_notifications')
        .select('*')
        .eq('customer_id', customerId)
        .eq('notification_type', notificationType)
        .gte('sent_at', today.toISOString().split('T')[0]);

      return data && data.length > 0;
    };

    // Send notifications for tomorrow's installations
    for (const customer of tomorrowCustomers || []) {
      const alreadySent = await checkNotificationSent(customer.id, 'day_before');
      if (!alreadySent) {
        await sendEmailNotification(customer, 'day_before');
        await recordNotification(customer.id, 'day_before');
      }
    }

    // Send notifications for today's installations
    for (const customer of todayCustomers || []) {
      const alreadySent = await checkNotificationSent(customer.id, 'day_of');
      if (!alreadySent) {
        await sendEmailNotification(customer, 'day_of');
        await recordNotification(customer.id, 'day_of');
      }
    }

    // Send follow-up notifications
    for (const customer of followUpCustomers || []) {
      const alreadySent = await checkNotificationSent(customer.id, 'follow_up');
      if (!alreadySent) {
        await sendEmailNotification(customer, 'follow_up');
        await recordNotification(customer.id, 'follow_up');
      }
    }

    return NextResponse.json({
      success: true,
      today: todayCustomers?.length || 0,
      tomorrow: tomorrowCustomers?.length || 0,
      followUp: followUpCustomers?.length || 0
    });

  } catch (error) {
    console.error('Error checking installations:', error);
    return NextResponse.json(
      { error: 'Failed to check installations' },
      { status: 500 }
    );
  }
}

async function sendEmailNotification(customer: any, notificationType: string) {
  try {
    // Determine the correct base URL (works locally and on Vercel)
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

    if (!baseUrl) {
      throw new Error('Base URL is not configured');
    }

    const response = await fetch(`${baseUrl}/api/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer,
        notificationType
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('send-email failed', response.status, errorText);
      throw new Error('Failed to send email');
    }
  } catch (error) {
    console.error('Error sending email notification:', error);
  }
}

async function recordNotification(customerId: string, notificationType: string) {
  try {
    await supabaseAdmin
      .from('email_notifications')
      .insert([{
        customer_id: customerId,
        notification_type: notificationType,
        email_content: `Notification sent for ${notificationType}`
      }]);
  } catch (error) {
    console.error('Error recording notification:', error);
  }
} 