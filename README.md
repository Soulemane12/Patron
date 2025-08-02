# Customer Management System

A Next.js application for sales professionals to manage customer information and installation schedules with automatic email reminders.

## 🚀 Features

- **Smart Text Parsing** - Paste customer info in any format, AI automatically extracts and structures it
- **Database Storage** - Save customers to Supabase with all installation details
- **Email Notifications** - Automatic reminders 1 day before, on the day, and 10 days after installation
- **Customer Management** - View, edit, and delete saved customers
- **Responsive Design** - Works perfectly on desktop and mobile devices

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **AI**: Groq API (Llama 3.3 70B)
- **Email**: Nodemailer with Gmail
- **Deployment**: Vercel with cron jobs

## 📧 Email Notifications

The system automatically sends emails to `Thechosen1351@gmail.com`:
- **1 day before** installation (reminder)
- **On the day** of installation (today's schedule)
- **10 days after** installation (follow-up)

## 🗄️ Database Schema

### customers table
- Customer information and installation details
- Automatic timestamps for creation and updates

### email_notifications table
- Tracks sent email notifications
- Prevents duplicate emails

## 🔧 API Endpoints

- `POST /api/format-customer` - AI-powered customer info formatting
- `POST /api/send-email` - Send email notifications
- `GET /api/cron/check-installations` - Daily cron job for reminders

## 🚀 Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/Soulemane12/Patron.git
   cd Patron
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create `.env.local` with:
   ```bash
   GROQ_API_KEY=your-groq-api-key
   EMAIL_PASSWORD=your-gmail-app-password
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   NEXT_PUBLIC_BASE_URL=http://localhost:3000
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open the application**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📋 Usage

1. **Add Customer**: Paste customer information in any format
2. **Format**: Click "Format Information" to structure the data
3. **Edit**: Review and modify the formatted information
4. **Save**: Click "Save Customer" to store in database
5. **Manage**: View all customers in the list below

## 🚀 Deployment

This project is configured for deployment on Vercel with automatic cron jobs. See `DEPLOYMENT.md` for detailed setup instructions.

## 📊 Database Setup

Run the SQL from `database-schema.sql` in your Supabase SQL Editor to create the required tables.

## 🔒 Security

- Environment variables for sensitive data
- Supabase Row Level Security (RLS)
- Gmail app passwords for email authentication
- Encrypted API keys in production

## 📱 Mobile Friendly

The application is fully responsive and works great on mobile devices for on-the-go customer management.

---

Built for sales professionals who need to manage customer information and installation schedules efficiently.
