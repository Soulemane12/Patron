import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

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

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.01,
      max_tokens: 8000,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Extract ALL customer records from the provided data and return strict JSON.

Rules:
- Process every row as a separate customer
- For tabular data use column headers to map fields:
  * "Name" → name (use exactly as written)
  * "Billing Number" or "Phone" → phone, formatted (XXX) XXX-XXXX
  * Combine "Street" + "City" + "State" + "Zip" → serviceAddress
  * "Order #" or "Order Number" → orderNumber
  * "Order Status" or "Status" → notes
  * "Create Date" or "Order Date" is NOT an install date — leave installationDate empty
- If no email in the data use ""
- Do NOT invent fake emails or placeholder data
- confidence: 95 if name+phone+address found, 70 if missing phone, 50 if minimal

Return JSON: {"customers":[{"name":"","email":"","phone":"","serviceAddress":"","installationDate":"","installationTime":"","isReferral":false,"referralSource":"","leadSize":null,"orderNumber":"","notes":"","confidence":95}],"formatDetected":""}`,
        },
        {
          role: 'user',
          content: `Extract all customer records:\n\n${text}`,
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
