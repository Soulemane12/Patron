# Customer Information Formatter Setup

This application automatically formats customer information and installation details using Groq's AI API.

## Setup Instructions

1. **Get a Groq API Key**
   - Visit [Groq Console](https://console.groq.com/keys)
   - Create an account and generate an API key

2. **Set up Environment Variables**
   - Create a `.env.local` file in the root directory
   - Add your Groq API key:
   ```
   GROQ_API_KEY=your_groq_api_key_here
   ```

3. **Install Dependencies**
   ```bash
   npm install
   ```

4. **Run the Development Server**
   ```bash
   npm run dev
   ```

5. **Open the Application**
   - Navigate to [http://localhost:3000](http://localhost:3000)

## How to Use

1. Paste customer information in any format into the input field
2. Click "Format Information" 
3. The AI will automatically extract and structure the information
4. Copy the formatted information to your clipboard

## Example Input

```
Mauricio Elizondo
mauricio.elizondo333@yahoo.com
980-253-6315
Service address
1307 Montreux Ct
Mebane, NC 27302
Installation
Saturday, August 02, 2025 2-4 p.m.
```

## Features

- ✅ Automatic customer information extraction
- ✅ Installation date and time parsing
- ✅ Email and phone number detection
- ✅ Address formatting
- ✅ Copy to clipboard functionality
- ✅ Responsive design
- ✅ Error handling

## Technologies Used

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Groq AI API 