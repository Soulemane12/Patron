import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Text input is required' }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No authorization token provided' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.01,
      max_tokens: 16000,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a customer data extraction expert. Extract ALL customer records from the provided data and return strict JSON.

EXTRACTION RULES:
- Process EVERY data row as a separate customer record
- For tabular data, use column headers to map fields:
  * "Name" column → name (use exactly as written, ALL CAPS is fine)
  * "Billing Number" or "Phone" column → phone
  * Combine "Street" + "City" + "State" + "Zip" → serviceAddress (e.g. "123 MAIN ST, JONESVILLE, NC 28642")
  * "Order #" or "Order Number" → orderNumber
  * "Order Status" or "Status" → notes
  * "Create Date" or "Order Date" → leave installationDate empty (it is not an install date)
- If no email exists in the source data, use empty string ""
- Do NOT invent fake emails, phones, or placeholder data
- Confidence: 95 if name+phone+address all found, 70 if missing phone, 50 if missing address

RETURN FORMAT — strict JSON, no extra text:
{
  "customers": [
    {
      "name": "JOHN SMITH",
      "email": "",
      "phone": "(336) 555-1234",
      "serviceAddress": "123 MAIN ST, JONESVILLE, NC 28642",
      "installationDate": "",
      "installationTime": "",
      "isReferral": false,
      "referralSource": "",
      "leadSize": null,
      "orderNumber": "NC1100181332",
      "notes": "CANCELLED",
      "confidence": 95
    }
  ],
  "formatDetected": "ORDER_MANAGEMENT_TSV"
}`,
        },
        {
          role: 'user',
          content: `Extract all customer records from this data:\n\n${text}`,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('No response from AI');

    const parsed = JSON.parse(content);
    const customers = (parsed.customers || []).map((c: any) => ({
      name: c.name || '',
      email: c.email || '',
      phone: c.phone || '',
      serviceAddress: c.serviceAddress || '',
      installationDate: c.installationDate || '',
      installationTime: c.installationTime || '',
      isReferral: c.isReferral || false,
      referralSource: c.referralSource || '',
      leadSize: c.leadSize || null,
      orderNumber: c.orderNumber || '',
      notes: c.notes || '',
      confidence: typeof c.confidence === 'number' ? c.confidence : 70,
    }));

    return NextResponse.json({
      customers,
      formatDetected: parsed.formatDetected || 'UNKNOWN',
      warnings: [],
      errors: [],
      totalFound: customers.length,
    });

  } catch (error: any) {
    console.error('Batch import error:', error);

    if (error.status === 429 || error.message?.includes('rate_limit')) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait a moment and try again.', type: 'rate_limit' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process batch import', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
