# Email Setup for Patron

This document explains how to set up email functionality for the patron project, based on the working implementation from the chamber project.

## Environment Variables

Create a `.env.local` file in the root of your patron project with the following variables:

```env
# Email configuration for patron
EMAIL_USER=Thechosen1351@gmail.com
EMAIL_PASS=your_app_password_here
EMAIL_FROM=Thechosen1351@gmail.com
EMAIL_TO=Thechosen1351@gmail.com

# Supabase configuration (if needed)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

## Gmail App Password Setup

To get the `EMAIL_PASS` (app password) for Gmail:

1. Go to your Google Account settings
2. Navigate to Security
3. Enable 2-Step Verification if not already enabled
4. Go to App passwords
5. Generate a new app password for "Mail"
6. Use this generated password as your `EMAIL_PASS`

## Email Functionality

The email system sends installation reminders to `Thechosen1351@gmail.com` for:

- **Day Before**: Reminder for installations scheduled tomorrow
- **Day Of**: Reminder for installations scheduled today  
- **Follow Up**: Follow-up for completed installations

## API Endpoint

The email functionality is available at:
```
POST /api/send-email
```

Request body:
```json
{
  "customer": {
    "name": "Customer Name",
    "installation_date": "2024-01-15",
    "installation_time": "10:00 AM",
    "service_address": "123 Main St, City, State",
    "phone": "555-123-4567",
    "email": "customer@example.com"
  },
  "notificationType": "day_before" // or "day_of", "follow_up"
}
```

## Implementation Details

The email implementation follows the same pattern as the chamber project:
- Uses nodemailer with Gmail service
- Sends from and to `Thechosen1351@gmail.com`
- Professional HTML email templates
- Error handling and validation
- Environment variable configuration

## Testing

To test the email functionality, you can make a POST request to `/api/send-email` with the required customer data and notification type. 