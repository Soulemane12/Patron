# GROQ API Setup Instructions

## Issue: "Add to Pipeline" stuck on "Processing"

If your "Add to Pipeline" button gets stuck on "Processing", it's because the AI formatting service is not configured properly.

## Solution: Set up GROQ API Key

### Step 1: Get a GROQ API Key
1. Go to [https://console.groq.com/keys](https://console.groq.com/keys)
2. Sign up for a free account
3. Create a new API key
4. Copy the API key

### Step 2: Add the API Key to Your Environment
1. Open your `.env` file in the project root
2. Add this line:
   ```
   GROQ_API_KEY=your_api_key_here
   ```
   Replace `your_api_key_here` with your actual API key

### Step 3: Restart Your Development Server
After adding the API key, restart your Next.js development server:
```bash
npm run dev
```

## Alternative: Manual Entry

If you don't want to set up the GROQ API, you can:
1. Click the **"Manual Entry"** button
2. Fill out the customer details manually
3. Click **"Add to Pipeline"**

This bypasses the AI formatting and allows you to add customers directly.

## Testing

Once you've set up the GROQ API key:
1. Paste customer information in the text area
2. Click **"Process Lead"**
3. The AI should format the information automatically
4. Click **"Add to Pipeline"** to save to your database

If you still get errors, check your browser console for detailed error messages.
