import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const { customer, notificationType } = await request.json();

    // Safety check for required fields
    if (!customer || !notificationType) {
      return NextResponse.json(
        { success: false, message: 'Missing required data' },
        { status: 400 }
      );
    }

    // Create a transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'Thechosen1351@gmail.com',
        pass: process.env.EMAIL_PASSWORD
      }
    });

    let subject = '';
    let htmlContent = '';

    switch (notificationType) {
      case 'day_before':
        subject = `Installation Reminder - Tomorrow at ${customer.installation_time}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
            <h1 style="color: #3b82f6; text-align: center;">Installation Reminder</h1>
            <p style="text-align: center;">You have an installation scheduled for tomorrow.</p>
            
            <div style="margin: 30px 0; padding: 20px; background-color: #f8fafc; border-radius: 5px;">
              <h2 style="color: #1e3a8a; font-size: 18px; margin-bottom: 15px;">Installation Details</h2>
              
              <p><strong>Customer Name:</strong> ${customer.name}</p>
              <p><strong>Date:</strong> ${new Date(customer.installation_date).toLocaleDateString()}</p>
              <p><strong>Time:</strong> ${customer.installation_time}</p>
              <p><strong>Service Address:</strong> ${customer.service_address}</p>
              <p><strong>Phone:</strong> ${customer.phone}</p>
              <p><strong>Email:</strong> ${customer.email}</p>
            </div>
            
            <div style="margin: 20px 0; padding: 15px; background-color: #eff6ff; border-radius: 5px; border-left: 4px solid #3b82f6;">
              <h3 style="color: #1e3a8a; font-size: 16px; margin-bottom: 10px;">Reminder</h3>
              <p>Please prepare all necessary equipment and materials for this installation.</p>
            </div>
            
            <p style="text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px;">
              This is an automated reminder from your installation management system.
            </p>
          </div>
        `;
        break;

      case 'day_of':
        subject = `Installation Today - ${customer.installation_time}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
            <h1 style="color: #3b82f6; text-align: center;">Installation Today</h1>
            <p style="text-align: center;">You have an installation scheduled for today.</p>
            
            <div style="margin: 30px 0; padding: 20px; background-color: #f8fafc; border-radius: 5px;">
              <h2 style="color: #1e3a8a; font-size: 18px; margin-bottom: 15px;">Installation Details</h2>
              
              <p><strong>Customer Name:</strong> ${customer.name}</p>
              <p><strong>Date:</strong> ${new Date(customer.installation_date).toLocaleDateString()}</p>
              <p><strong>Time:</strong> ${customer.installation_time}</p>
              <p><strong>Service Address:</strong> ${customer.service_address}</p>
              <p><strong>Phone:</strong> ${customer.phone}</p>
              <p><strong>Email:</strong> ${customer.email}</p>
            </div>
            
            <div style="margin: 20px 0; padding: 15px; background-color: #eff6ff; border-radius: 5px; border-left: 4px solid #3b82f6;">
              <h3 style="color: #1e3a8a; font-size: 16px; margin-bottom: 10px;">Good Luck!</h3>
              <p>Have a successful installation today!</p>
            </div>
            
            <p style="text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px;">
              This is an automated reminder from your installation management system.
            </p>
          </div>
        `;
        break;

      case 'follow_up':
        subject = `Follow-up: Installation on ${new Date(customer.installation_date).toLocaleDateString()}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
            <h1 style="color: #3b82f6; text-align: center;">Installation Follow-up</h1>
            <p style="text-align: center;">This is a follow-up for a completed installation.</p>
            
            <div style="margin: 30px 0; padding: 20px; background-color: #f8fafc; border-radius: 5px;">
              <h2 style="color: #1e3a8a; font-size: 18px; margin-bottom: 15px;">Installation Details</h2>
              
              <p><strong>Customer Name:</strong> ${customer.name}</p>
              <p><strong>Date:</strong> ${new Date(customer.installation_date).toLocaleDateString()}</p>
              <p><strong>Time:</strong> ${customer.installation_time}</p>
              <p><strong>Service Address:</strong> ${customer.service_address}</p>
              <p><strong>Phone:</strong> ${customer.phone}</p>
              <p><strong>Email:</strong> ${customer.email}</p>
            </div>
            
            <div style="margin: 20px 0; padding: 15px; background-color: #eff6ff; border-radius: 5px; border-left: 4px solid #3b82f6;">
              <h3 style="color: #1e3a8a; font-size: 16px; margin-bottom: 10px;">Follow-up Action</h3>
              <p>Consider reaching out to the customer for feedback or additional services.</p>
            </div>
            
            <p style="text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px;">
              This is an automated follow-up from your installation management system.
            </p>
          </div>
        `;
        break;
    }

    // Send email
    const mailOptions = {
      from: 'Thechosen1351@gmail.com',
      to: 'Thechosen1351@gmail.com',
      subject: subject,
      html: htmlContent,
    };

    try {
      // Send the email
      await transporter.sendMail(mailOptions);
      
      return NextResponse.json({ 
        success: true, 
        message: 'Email sent successfully' 
      });
    } catch (emailError) {
      console.error('Error sending email through transporter:', emailError);
      return NextResponse.json(
        { success: false, message: 'Error sending through email service' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
} 