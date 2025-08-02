import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text input is required' },
        { status: 400 }
      );
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY environment variable is not set' },
        { status: 500 }
      );
    }

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
    let formattedData;
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
          formattedData.installationDate = date.toISOString().split('T')[0];
        }
      } catch (error) {
        console.error('Error parsing date:', error);
      }
    }

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