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

    // First try to extract information using regex patterns
    const regexResult = extractCustomerInfo(text);
    
    // Check if we got enough information from regex
    const hasEnoughInfo = 
      regexResult.name !== 'Not provided' && 
      regexResult.phone !== 'Not provided' && 
      regexResult.installationDate !== 'Not provided';
    
    let formattedData: any;
    
    // If regex extraction was successful, use it
    if (hasEnoughInfo) {
      formattedData = regexResult;
    } 
    // Otherwise, fall back to the AI model
    else if (process.env.GROQ_API_KEY) {
      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are a customer information formatter. Extract and format customer information from the provided text into a structured format. Always return a valid JSON object with the following fields:
- name: The customer's full name
- email: The customer's email address
- phone: The customer's phone number
- serviceAddress: The complete service address
- installationDate: The installation date in a readable format
- installationTime: The installation time in a readable format

If any information is missing, use "Not provided" as the value. Ensure the JSON is properly formatted and valid. Only return the JSON object, no additional text.`
          },
          {
            role: 'user',
            content: `Please format the following customer information into structured data:\n\n${text}`
          }
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        max_tokens: 500,
      });

      const responseContent = completion.choices[0]?.message?.content;
      
      if (!responseContent) {
        throw new Error('No response from Groq API');
      }

      // Try to parse the JSON response
      try {
        // Extract JSON from the response (in case there's extra text)
        const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          formattedData = JSON.parse(jsonMatch[0]);
        } else {
          formattedData = JSON.parse(responseContent);
        }
      } catch (parseError) {
        console.error('Failed to parse JSON response:', responseContent);
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
      // If GROQ API key is not available and regex didn't work well
      formattedData = regexResult;
    }

    // Store the result in cache
    customerCache.set(cacheKey, formattedData);

    return NextResponse.json(formattedData);

  } catch (error) {
    console.error('Error formatting customer information:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to format customer information',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}