import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export const maxDuration = 60;

// ── Direct column parser for tab-separated exports (BASS, Excel, etc.) ────────
// Used when the data has a clear header row — instant, no API call needed.
// Falls back to AI for free-form text.

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === '1') return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return raw;
}

function tryParseTabular(text: string): { customers: any[]; formatDetected: string } | null {
  const lines = text.split('\n');

  // Find header row: tab-separated line that contains "name"
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('\t') && lines[i].toLowerCase().includes('name')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return null;

  const headers = lines[headerIdx].split('\t').map((h) => h.trim().toLowerCase());
  const col = (...candidates: string[]) =>
    candidates.reduce((found, c) => found !== -1 ? found : headers.findIndex((h) => h.includes(c)), -1);

  // Name detection: prefer subscriber/customer/contact, avoid company/account/dealer columns.
  // Also support separate First Name + Last Name columns.
  const firstIdx = headers.findIndex((h) => h.includes('first') && h.includes('name') || h === 'first');
  const lastIdx  = headers.findIndex((h) => h.includes('last')  && h.includes('name') || h === 'last');
  const isNotCompany = (h: string) => !h.includes('company') && !h.includes('account') && !h.includes('dealer') && !h.includes('organization');
  const nameIdx = firstIdx >= 0 && lastIdx >= 0
    ? -2 // signal: use first+last combo
    : (() => {
        // Most specific first: subscriber, customer, contact
        const specific = headers.findIndex((h) =>
          (h.includes('subscriber') || h.includes('customer') || h.includes('contact')) && h.includes('name')
        );
        if (specific !== -1) return specific;
        // Exact 'name' column
        const exact = headers.findIndex((h) => h === 'name');
        if (exact !== -1) return exact;
        // Any name column that isn't a company/account/dealer name
        return headers.findIndex((h) => h.includes('name') && isNotCompany(h));
      })();

  const phoneIdx  = col('billing number', 'billing', 'phone');
  const streetIdx = col('street');
  const cityIdx   = col('city');
  const stateIdx  = col('state');
  const zipIdx    = col('zip');
  const orderIdx  = col('order #', 'order#', 'order number');
  const statusIdx = col('order status', 'status');

  if (nameIdx === -1 && !(firstIdx >= 0 && lastIdx >= 0)) return null;

  const customers: any[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (!lines[i].includes('\t')) continue;
    const c = lines[i].split('\t').map((v) => v.trim());
    const name = nameIdx === -2
      ? `${c[firstIdx] || ''} ${c[lastIdx] || ''}`.trim()
      : nameIdx >= 0 ? c[nameIdx] || '' : '';
    if (name.length < 2) continue;

    const phone  = phoneIdx  >= 0 ? c[phoneIdx]  || '' : '';
    const street = streetIdx >= 0 ? c[streetIdx] || '' : '';
    const city   = cityIdx   >= 0 ? c[cityIdx]   || '' : '';
    const state  = stateIdx  >= 0 ? c[stateIdx]  || '' : '';
    const zip    = zipIdx    >= 0 ? c[zipIdx]    || '' : '';
    const addr   = [street, [city, state].filter(Boolean).join(', '), zip].filter(Boolean).join(' ');

    customers.push({
      name,
      email: '',
      phone: formatPhone(phone),
      serviceAddress: addr,
      installationDate: '',
      installationTime: '',
      isReferral: false,
      referralSource: '',
      leadSize: null,
      orderNumber: orderIdx  >= 0 ? c[orderIdx]  || '' : '',
      notes:       statusIdx >= 0 ? c[statusIdx] || '' : '',
      confidence:  name && phone && addr ? 95 : name && addr ? 75 : 60,
    });
  }

  return customers.length > 0 ? { customers, formatDetected: 'ORDER_MANAGEMENT_TSV' } : null;
}

// ── AI parser for free-form / unstructured text ───────────────────────────────

async function parseWithAI(text: string): Promise<{ customers: any[]; formatDetected: string }> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.01,
    max_tokens: 8000,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Extract customer records and return JSON.
- name, phone (XXX) XXX-XXXX, email (or ""), serviceAddress, installationDate YYYY-MM-DD (or ""), installationTime (or ""), orderNumber (or ""), notes, isReferral false, referralSource "", leadSize null
- confidence: 95 name+phone+address, 70 missing phone, 50 minimal
Return JSON: {"customers":[{...}],"formatDetected":"FREE_TEXT"}`,
      },
      { role: 'user', content: `Extract all customer records:\n\n${text.slice(0, 6000)}` },
    ],
  });

  const parsed = JSON.parse(completion.choices[0]?.message?.content || '{"customers":[]}');
  return {
    customers: (parsed.customers || []).map((c: any) => ({
      name: c.name || '', email: c.email || '', phone: c.phone || '',
      serviceAddress: c.serviceAddress || '', installationDate: c.installationDate || '',
      installationTime: c.installationTime || '', isReferral: false, referralSource: '',
      leadSize: c.leadSize || null, orderNumber: c.orderNumber || '', notes: c.notes || '',
      confidence: typeof c.confidence === 'number' ? c.confidence : 70,
    })),
    formatDetected: parsed.formatDetected || 'FREE_TEXT',
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();
    if (!text?.trim()) return NextResponse.json({ error: 'Text input is required' }, { status: 400 });

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer '))
      return NextResponse.json({ error: 'No authorization token provided' }, { status: 401 });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.substring(7));
    if (authError || !user) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });

    // Tab-separated exports → instant direct parse, no API call
    const direct = tryParseTabular(text);
    if (direct) {
      return NextResponse.json({ ...direct, warnings: [], errors: [], totalFound: direct.customers.length });
    }

    // Free-form text → AI
    const ai = await parseWithAI(text);
    return NextResponse.json({ ...ai, warnings: [], errors: [], totalFound: ai.customers.length });

  } catch (error: any) {
    console.error('Batch import error:', error);
    if (error.status === 429 || error.message?.includes('rate_limit'))
      return NextResponse.json({ error: 'Rate limit exceeded. Please try again shortly.', type: 'rate_limit' }, { status: 429 });
    return NextResponse.json({ error: 'Failed to process', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
