import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const maxDuration = 60;

// ── Direct TSV parser (no AI, no rate limits) ─────────────────────────────────

function formatPhone(raw: string): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === '1') return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return raw;
}

function tryParseTabular(text: string): { customers: any[]; formatDetected: string } | null {
  const rawLines = text.split('\n');

  // Find the header row — must be tab-separated and contain "name"
  let headerIdx = -1;
  for (let i = 0; i < rawLines.length; i++) {
    const lower = rawLines[i].toLowerCase();
    if (rawLines[i].includes('\t') && lower.includes('name')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return null;

  const headers = rawLines[headerIdx].split('\t').map((h) => h.trim().toLowerCase());

  const col = (candidates: string[]) => {
    for (const c of candidates) {
      const idx = headers.findIndex((h) => h.includes(c));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const nameIdx    = col(['name']);
  const phoneIdx   = col(['billing number', 'billing', 'phone']);
  const streetIdx  = col(['street']);
  const cityIdx    = col(['city']);
  const stateIdx   = col(['state']);
  const zipIdx     = col(['zip']);
  const orderIdx   = col(['order #', 'order#', 'order number']);
  const statusIdx  = col(['order status', 'status']);

  if (nameIdx === -1) return null;

  const customers: any[] = [];

  for (let i = headerIdx + 1; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (!line.includes('\t')) continue;

    const cols = line.split('\t').map((c) => c.trim());
    const name = cols[nameIdx] || '';
    if (!name || name.length < 2) continue;

    const phone  = phoneIdx  >= 0 ? cols[phoneIdx]  || '' : '';
    const street = streetIdx >= 0 ? cols[streetIdx] || '' : '';
    const city   = cityIdx   >= 0 ? cols[cityIdx]   || '' : '';
    const state  = stateIdx  >= 0 ? cols[stateIdx]  || '' : '';
    const zip    = zipIdx    >= 0 ? cols[zipIdx]    || '' : '';
    const orderNum = orderIdx >= 0 ? cols[orderIdx] || '' : '';
    const status   = statusIdx >= 0 ? cols[statusIdx] || '' : '';

    const addr = [street, [city, state].filter(Boolean).join(', '), zip]
      .filter(Boolean)
      .join(' ');

    const hasPhone = !!phone && phone.replace(/\D/g, '').length >= 10;
    const hasAddr  = addr.length > 5;

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
      orderNumber: orderNum,
      notes: status,
      confidence: name && hasPhone && hasAddr ? 95 : name && hasAddr ? 75 : 60,
    });
  }

  return customers.length > 0 ? { customers, formatDetected: 'ORDER_MANAGEMENT_TSV' } : null;
}

// ── AI fallback (for free-form / non-tabular text) ────────────────────────────

async function parseWithAI(text: string): Promise<{ customers: any[]; formatDetected: string }> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.01,
    max_tokens: 8000,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Extract customer records and return strict JSON.
Rules:
- name: full customer name
- phone: formatted (XXX) XXX-XXXX
- email: exact if present, else ""
- serviceAddress: full address
- installationDate: YYYY-MM-DD if present, else ""
- installationTime: as written, else ""
- orderNumber: order/reference number if present, else ""
- notes: status or extra info
- confidence: 95 if name+phone+address, 70 if missing phone, 50 if minimal data

Return JSON: {"customers":[{...}],"formatDetected":"FREE_TEXT"}`,
      },
      {
        role: 'user',
        content: `Extract all customer records:\n\n${text.slice(0, 6000)}`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content || '{"customers":[]}';
  const parsed = JSON.parse(content);
  return {
    customers: (parsed.customers || []).map((c: any) => ({
      name: c.name || '',
      email: c.email || '',
      phone: c.phone || '',
      serviceAddress: c.serviceAddress || '',
      installationDate: c.installationDate || '',
      installationTime: c.installationTime || '',
      isReferral: false,
      referralSource: '',
      leadSize: c.leadSize || null,
      orderNumber: c.orderNumber || '',
      notes: c.notes || '',
      confidence: typeof c.confidence === 'number' ? c.confidence : 70,
    })),
    formatDetected: parsed.formatDetected || 'FREE_TEXT',
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

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

    // Try direct parse first — no AI, instant, no rate limits
    const direct = tryParseTabular(text);
    if (direct) {
      return NextResponse.json({
        ...direct,
        warnings: [],
        errors: [],
        totalFound: direct.customers.length,
      });
    }

    // Fall back to AI for free-form text
    const ai = await parseWithAI(text);
    return NextResponse.json({
      ...ai,
      warnings: [],
      errors: [],
      totalFound: ai.customers.length,
    });

  } catch (error: any) {
    console.error('Batch import error:', error);

    if (error.status === 429 || error.message?.includes('rate_limit')) {
      return NextResponse.json(
        { error: 'AI rate limit exceeded. Please wait a moment and try again.', type: 'rate_limit' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process batch import', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
