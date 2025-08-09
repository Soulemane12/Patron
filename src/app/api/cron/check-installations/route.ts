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
    // Import nodemailer directly here instead of calling the API
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'Thechosen1351@gmail.com',
        pass: process.env.EMAIL_PASSWORD
      }
    });

    let subject = '';
    let emailContent = '';

    switch (notificationType) {
      case 'day_before':
        subject = 'Installation Reminder - Day Before';
        emailContent = `
          <h2>Installation Reminder - Tomorrow</h2>
          <p>This is a reminder that you have an installation scheduled for tomorrow.</p>
          
          <h3>Installation Details:</h3>
          <ul>
            <li><strong>Date:</strong> ${new Date(customer.installation_date).toLocaleDateString()}</li>
            <li><strong>Time:</strong> ${customer.installation_time}</li>
            <li><strong>Service Address:</strong> ${customer.service_address}</li>
          </ul>
          
          <h3>Customer Information:</h3>
          <ul>
            <li><strong>Name:</strong> ${customer.name}</li>
            <li><strong>Phone:</strong> ${customer.phone}</li>
            <li><strong>Email:</strong> ${customer.email}</li>
          </ul>
        `;
        break;
      case 'day_of':
        subject = 'Installation Reminder - Today';
        emailContent = `
          <h2>Installation Reminder - Today</h2>
          <p>This is a reminder that you have an installation scheduled for today.</p>
          
          <h3>Installation Details:</h3>
          <ul>
            <li><strong>Time:</strong> ${customer.installation_time}</li>
            <li><strong>Service Address:</strong> ${customer.service_address}</li>
          </ul>
          
          <h3>Customer Information:</h3>
          <ul>
            <li><strong>Name:</strong> ${customer.name}</li>
            <li><strong>Phone:</strong> ${customer.phone}</li>
            <li><strong>Email:</strong> ${customer.email}</li>
          </ul>
        `;
        break;
      case 'follow_up':
        subject = 'Installation Follow-up';
        emailContent = `
          <h2>Installation Follow-up</h2>
          <p>This is a follow-up for the installation completed 10 days ago.</p>
          
          <h3>Installation Details:</h3>
          <ul>
            <li><strong>Date:</strong> ${new Date(customer.installation_date).toLocaleDateString()}</li>
            <li><strong>Service Address:</strong> ${customer.service_address}</li>
          </ul>
          
          <h3>Customer Information:</h3>
          <ul>
            <li><strong>Name:</strong> ${customer.name}</li>
            <li><strong>Phone:</strong> ${customer.phone}</li>
            <li><strong>Email:</strong> ${customer.email}</li>
          </ul>
        `;
        break;
    }

    const mailOptions = {
      from: 'Thechosen1351@gmail.com',
      to: 'Thechosen1351@gmail.com',
      subject: subject,
      html: emailContent
    };

    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully for', notificationType);
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