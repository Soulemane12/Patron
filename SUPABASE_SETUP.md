# Customer Management System Setup Guide

## 🗄️ Supabase Setup

### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Sign up/login and create a new project
3. Wait for the project to be ready

### 2. Get Your API Keys
1. Go to your project dashboard
2. Navigate to **Settings** → **API**
3. Copy these values:
   - **Project URL** (looks like: `https://your-project.supabase.co`)
   - **anon public** key (starts with `eyJ...`)

### 3. Set Up Database
1. Go to **SQL Editor** in your Supabase dashboard
2. Copy and paste the entire content from `database-schema.sql`
3. Click **Run** to create the tables

### 4. Environment Variables
Create a `.env.local` file in your project root:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Groq AI API
GROQ_API_KEY=your-groq-api-key-here

# Email Configuration (for Gmail)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password-here

# Your app URL (for cron jobs)
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## 📧 Email Setup (Gmail)

### 1. Enable 2-Factor Authentication
1. Go to your Google Account settings
2. Enable 2-Factor Authentication

### 2. Generate App Password
1. Go to **Security** → **App passwords**
2. Select "Mail" and "Other (Custom name)"
3. Name it "Customer Management System"
4. Copy the generated password (16 characters)

### 3. Update Environment Variables
Replace `EMAIL_USER` and `EMAIL_PASS` in your `.env.local`:
```bash
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-16-character-app-password
```

## ⏰ Cron Job Setup

### Option 1: Vercel Cron (Recommended)
If deploying to Vercel, add this to your `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/check-installations",
      "schedule": "0 8 * * *"
    }
  ]
}
```

### Option 2: External Cron Service
Use a service like [cron-job.org](https://cron-job.org):
- URL: `https://your-domain.com/api/cron/check-installations`
- Schedule: Daily at 8:00 AM

## 🚀 How to Use

### 1. Start the Application
```bash
npm run dev
```

### 2. Add Customers
1. Paste customer information in any format
2. Click "Format Information"
3. Review and edit the formatted data
4. Click "Save Customer"

### 3. Email Notifications
The system will automatically send emails:
- **1 day before** installation
- **On the day** of installation  
- **10 days after** installation (follow-up)

## 📊 Database Tables

### customers
- `id` - Unique identifier
- `name` - Customer name
- `email` - Customer email
- `phone` - Customer phone
- `service_address` - Installation address
- `installation_date` - Installation date
- `installation_time` - Installation time
- `created_at` - Record creation time
- `updated_at` - Last update time

### email_notifications
- `id` - Unique identifier
- `customer_id` - Reference to customer
- `notification_type` - Type of notification
- `sent_at` - When email was sent
- `email_content` - Email content
- `status` - Email status

## 🔧 API Endpoints

### Format Customer Information
- **POST** `/api/format-customer`
- Input: `{ text: string }`
- Output: Formatted customer data

### Send Email
- **POST** `/api/send-email`
- Input: `{ customer: object, notificationType: string }`

### Check Installations (Cron)
- **GET** `/api/cron/check-installations`
- Automatically checks for upcoming installations

## 🛠️ Troubleshooting

### Database Connection Issues
1. Verify your Supabase URL and key
2. Check if tables were created properly
3. Ensure RLS policies are set correctly

### Email Not Sending
1. Verify Gmail app password
2. Check if 2FA is enabled
3. Test with a simple email first

### Cron Job Not Working
1. Check the cron job URL is accessible
2. Verify the schedule is correct
3. Check server logs for errors

## 📱 Features

✅ **Smart Text Parsing** - Extract customer info from any format
✅ **Database Storage** - Save customers to Supabase
✅ **Email Notifications** - Automatic reminders
✅ **Customer Management** - View, edit, delete customers
✅ **Responsive Design** - Works on all devices
✅ **Real-time Updates** - Instant data synchronization

## 🔒 Security Notes

- Keep your API keys secure
- Use environment variables
- Enable RLS policies in production
- Use app passwords for email
- Regularly backup your database 