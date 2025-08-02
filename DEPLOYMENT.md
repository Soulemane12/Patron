# Vercel Deployment Guide

## 🚀 Deploy to Vercel

### 1. Connect GitHub Repository

1. Go to [vercel.com](https://vercel.com)
2. Sign up/login with your GitHub account
3. Click "New Project"
4. Import your GitHub repository: `https://github.com/Soulemane12/Patron.git`
5. Vercel will automatically detect it's a Next.js project

### 2. Configure Environment Variables

In your Vercel project settings, add these environment variables:

#### Required Variables:
```
GROQ_API_KEY=your-groq-api-key-here
EMAIL_PASSWORD=your-gmail-app-password-here
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key-here
NEXT_PUBLIC_BASE_URL=https://your-vercel-domain.vercel.app
```

#### How to Add Environment Variables:
1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable with the correct name and value
4. Make sure to select **Production**, **Preview**, and **Development** environments

### 3. Deploy

1. Click "Deploy" in Vercel
2. Wait for the build to complete
3. Your app will be live at `https://your-project-name.vercel.app`

### 4. Set Up Cron Job

The cron job is already configured in `vercel.json` to run daily at 8:00 AM and check for:
- Installations tomorrow (day before reminder)
- Installations today (day of reminder)
- Installations 10 days ago (follow-up)

## 📧 Email Setup for Production

### 1. Gmail App Password
1. Go to your Google Account settings
2. Enable 2-Factor Authentication
3. Generate an App Password for "Mail"
4. Use this password as your `EMAIL_PASSWORD` in Vercel

### 2. Test Email Functionality
After deployment, test the email system by:
1. Adding a customer with today's date
2. The cron job will send an email at 8:00 AM

## 🗄️ Supabase Setup

### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Get your API keys from Settings → API

### 2. Set Up Database
1. Go to SQL Editor in Supabase
2. Run the SQL from `database-schema.sql`
3. This creates the customers and email_notifications tables

### 3. Update Environment Variables
Add your Supabase credentials to Vercel:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## 🔄 GitHub Integration

### Push Changes to GitHub
```bash
# Add all files
git add .

# Commit changes
git commit -m "Add customer management system with email notifications"

# Push to GitHub
git push origin main
```

### Automatic Deployments
- Every push to the `main` branch will trigger a new deployment
- Vercel will automatically build and deploy your changes
- Environment variables are preserved between deployments

## 🧪 Testing the Deployment

### 1. Test Customer Addition
1. Go to your deployed app
2. Paste customer information
3. Click "Format Information"
4. Click "Save Customer"
5. Verify it appears in the customer list

### 2. Test Email Notifications
1. Add a customer with tomorrow's date
2. Wait for the cron job to run at 8:00 AM
3. Check your email for the reminder

### 3. Test Cron Job
You can manually trigger the cron job by visiting:
```
https://your-domain.vercel.app/api/cron/check-installations
```

## 🔧 Troubleshooting

### Build Errors
- Check that all dependencies are in `package.json`
- Verify environment variables are set correctly
- Check the build logs in Vercel dashboard

### Database Connection Issues
- Verify Supabase URL and keys are correct
- Check that tables were created properly
- Ensure RLS policies are set correctly

### Email Not Working
- Verify Gmail app password is correct
- Check that 2FA is enabled on your Google account
- Test email functionality manually

### Cron Job Issues
- Check Vercel logs for cron job execution
- Verify the cron job URL is accessible
- Ensure environment variables are available to the cron job

## 📱 Features After Deployment

✅ **Live Application** - Accessible from anywhere
✅ **Automatic Deployments** - Updates on every GitHub push
✅ **Email Notifications** - Daily reminders at 8:00 AM
✅ **Database Storage** - Supabase integration
✅ **Responsive Design** - Works on all devices
✅ **Real-time Updates** - Instant data synchronization

## 🔒 Security Notes

- Environment variables are encrypted in Vercel
- API keys are not exposed in the client-side code
- Supabase RLS policies protect your data
- Use app passwords for email authentication
- Regularly backup your database

## 📊 Monitoring

- **Vercel Analytics** - Track app performance
- **Supabase Dashboard** - Monitor database usage
- **Email Logs** - Check notification delivery
- **Cron Job Logs** - Monitor automated tasks

Your customer management system will be fully functional with automatic email reminders and database storage! 