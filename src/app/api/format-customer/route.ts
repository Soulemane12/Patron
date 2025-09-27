import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { LRUCache } from 'lru-cache';

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Create a cache for formatted customer data
// This will store up to 100 entries and expire them after 30 minutes
const customerCache = new LRUCache<string, any>({
  max: 100,
  ttl: 1000 * 60 * 30, // 30 minutes
  allowStale: false,
});

// Helper function to extract customer information using regex patterns
function extractCustomerInfo(text: string): any {
  // Initialize the result object with default values
  const result: any = {
    name: 'Not provided',
    email: 'Not provided',
    phone: 'Not provided',
    serviceAddress: 'Not provided',
    installationDate: 'Not provided',
    installationTime: 'Not provided',
  };

  // Extract name - look for patterns like "name: John Smith" or "John Smith"
  const nameRegex = /(?:name[:\s]+|^)([A-Za-z\s.'-]+)(?:,|\s|$)/i;
  const nameMatch = text.match(nameRegex);
  if (nameMatch && nameMatch[1].trim()) {
    result.name = nameMatch[1].trim();
  }

  // Extract email - standard email pattern
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/i;
  const emailMatch = text.match(emailRegex);
  if (emailMatch) {
    result.email = emailMatch[0];
  }

  // Extract phone - various formats
  const phoneRegex = /(?:phone[:\s]+|^|\s)(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/i;
  const phoneMatch = text.match(phoneRegex);
  if (phoneMatch && phoneMatch[1]) {
    result.phone = phoneMatch[1].replace(/[^\d]/g, '').replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  }

  // Extract address - look for address patterns
  const addressRegex = /(?:address[:\s]+|at\s+)([A-Za-z0-9\s.,#-]+)(?:,|\s|$)/i;
  const addressMatch = text.match(addressRegex);
  if (addressMatch && addressMatch[1].trim()) {
    result.serviceAddress = addressMatch[1].trim();
  }

  // Extract date - various formats
  const dateRegex = /(?:(?:date|scheduled for|on)[:\s]+)?\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[.\s]+\d{1,2}(?:st|nd|rd|th)?(?:[,.\s]+\d{4})?|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/i;
  const dateMatch = text.match(dateRegex);
  if (dateMatch) {
    const dateStr = dateMatch[0];
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        result.installationDate = `${yyyy}-${mm}-${dd}`;
      }
    } catch (error) {
      console.error('Error parsing date:', error);
    }
  }

  // Extract time - various formats
  const timeRegex = /(?:(?:time|at)[:\s]+)?\b(?:1[0-2]|0?[1-9])(?::[0-5][0-9])?\s*(?:am|pm|a\.m\.|p\.m\.)/i;
  const timeMatch = text.match(timeRegex);
  if (timeMatch) {
    result.installationTime = timeMatch[0].trim();
  }

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text input is required' },
        { status: 400 }
      );
    }

    // Generate a cache key based on the input text
    const cacheKey = text.trim().toLowerCase().replace(/\s+/g, ' ');

    // Check if we have a cached result
    if (customerCache.has(cacheKey)) {
      return NextResponse.json(customerCache.get(cacheKey));
    }

    console.log('🤖 Using AI-Only for single customer formatting (maximum accuracy)');

    let formattedData: any;

    // AI-ONLY processing for maximum accuracy
    if (process.env.GROQ_API_KEY) {
      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `YOU ARE A PRECISION CUSTOMER DATA EXTRACTION EXPERT. Extract customer information with 100% accuracy.

EXTRACTION RULES - FOLLOW EXACTLY:

1. CUSTOMER NAMES:
   - Look for patterns: "✓ Name", "• Name", "◦ Name", or standalone names
   - Real examples: "✓ Renee Gaudet", "✓ Rodney Tate", "◦ Janna Davis"
   - NEVER use placeholder names

2. EMAIL ADDRESSES:
   - Copy EXACTLY as written from source
   - Examples: "reneegaudet1@gmail.com", "tatejrr@gmail.com", "jannadavis1067@gmail.com"
   - NEVER modify or add asterisks

3. PHONE NUMBERS:
   - Extract exact numbers: "919-236-3685", "743-214-5494", "336-693-9008"
   - Format as (XXX) XXX-XXXX

4. ADDRESSES:
   - Combine all address parts: "440 E McPherson Dr, Mebane, NC 27302"
   - Look for "Service address:", "Service Address", or address on separate lines

5. INSTALLATION DATES:
   - Convert to YYYY-MM-DD format
   - Examples: "Tuesday, July 29, 2025" → "2025-07-29"

6. INSTALLATION TIMES:
   - Keep original format: "4-6 p.m", "12-2 p.m.", "10am-12pm"

RETURN ONLY JSON - NO OTHER TEXT:
{
  "name": "Exact Name From Source",
  "email": "exact.email@domain.com",
  "phone": "(919) 236-3685",
  "serviceAddress": "440 E McPherson Dr, Mebane, NC 27302",
  "installationDate": "2025-07-29",
  "installationTime": "4-6 p.m"
}`
          },
          {
            role: 'user',
            content: `Extract customer information with maximum accuracy:\n\n${text}`
          }
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.01, // Maximum precision
        max_tokens: 1000,
      });

      const responseContent = completion.choices[0]?.message?.content;
      
      if (!responseContent) {
        throw new Error('No response from Groq API');
      }

      // Enhanced JSON parsing with multiple strategies
      try {
        let cleanResponse = responseContent.trim();

        // Strategy 1: Look for JSON code blocks
        const jsonBlockMatch = cleanResponse.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (jsonBlockMatch) {
          cleanResponse = jsonBlockMatch[1].trim();
        } else {
          // Strategy 2: Extract content between { and }
          const jsonStart = cleanResponse.indexOf('{');
          const jsonEnd = cleanResponse.lastIndexOf('}');
          if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            cleanResponse = cleanResponse.substring(jsonStart, jsonEnd + 1);
          }
        }

        formattedData = JSON.parse(cleanResponse);
        console.log('✅ AI extraction successful for single customer');
      } catch (parseError) {
        console.error('Failed to parse AI JSON response:', responseContent);
        throw new Error('Invalid response format from AI');
      }

      // Validate the required fields
      const requiredFields = ['name', 'email', 'phone', 'serviceAddress', 'installationDate', 'installationTime'];
      const missingFields = requiredFields.filter(field => !formattedData[field]);
      
      if (missingFields.length > 0) {
        // If fields are missing, provide defaults
        formattedData = {
          name: formattedData.name || 'Not provided',
          email: formattedData.email || 'Not provided',
          phone: formattedData.phone || 'Not provided',
          serviceAddress: formattedData.serviceAddress || 'Not provided',
          installationDate: formattedData.installationDate || 'Not provided',
          installationTime: formattedData.installationTime || 'Not provided',
        };
      }

      // Convert installation date to proper format for database
      if (formattedData.installationDate && formattedData.installationDate !== 'Not provided') {
        try {
          const date = new Date(formattedData.installationDate);
          if (!isNaN(date.getTime())) {
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            formattedData.installationDate = `${yyyy}-${mm}-${dd}`;
          }
        } catch (error) {
          console.error('Error parsing date:', error);
        }
      }
    } else {
      throw new Error('GROQ_API_KEY not configured - AI-only operation required');
    }

    // Store the result in cache
    customerCache.set(cacheKey, formattedData);

    return NextResponse.json(formattedData);

  } catch (error: any) {
    console.error('Error formatting customer information:', error);

    // Handle rate limit errors specifically
    if (error.status === 429 || error.message?.includes('rate_limit_exceeded')) {
      return NextResponse.json({
        error: 'Rate limit exceeded',
        message: error.message,
        type: 'rate_limit',
        suggestion: 'Please wait before trying again or upgrade your API plan for higher limits.'
      }, { status: 429 });
    }

    return NextResponse.json(
      {
        error: 'AI formatting failed. System configured for AI-only operation.',
        details: error instanceof Error ? error.message : 'Unknown error',
        type: 'ai_formatting_error'
      },
      { status: 500 }
    );
  }
}