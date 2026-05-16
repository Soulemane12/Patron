import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export const maxDuration = 60;

// ── Direct column parser for tab-separated exports (BASS, Excel, etc.) ────────
// Used when the data has a clear header row — instant, no API call needed.
// Falls back to AI for free-form text.
//
// Field policy: missing values are returned as `null`, never as "" or placeholder
// strings. Downstream code (review UI, DB insert) treats null as "not provided".

function nullish(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  if (t.length === 0) return null;
  // Common spreadsheet "empty" sentinels
  const low = t.toLowerCase();
  if (low === 'n/a' || low === 'na' || low === 'null' || low === 'not provided' || low === '-') return null;
  return t;
}

function formatPhone(raw: string | null | undefined): string | null {
  const t = nullish(raw);
  if (!t) return null;
  const d = t.replace(/\D/g, '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === '1') return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return d.length > 0 ? t : null;
}

function normDate(v: string | null | undefined): string | null {
  const t = nullish(v);
  if (!t) return null;
  // Strip trailing time portion ("2026-04-28 14:32:00" → "2026-04-28")
  const head = t.split(/[\sT]/)[0];
  // Already YYYY-MM-DD
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(head);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  // MM/DD/YYYY or M/D/YY
  m = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2}|\d{4})$/.exec(head);
  if (m) {
    const yr = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${yr}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }
  // Fallback: let Date parse it (handles "Apr 28, 2026" etc.)
  const d = new Date(t);
  if (!isNaN(d.getTime())) {
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
  }
  return null;
}

const VALID_LEAD = ['500MB', '1GIG', '2GIG'] as const;
function normLeadSize(v: string | null | undefined): '500MB' | '1GIG' | '2GIG' | null {
  const t = nullish(v);
  if (!t) return null;
  const up = t.toUpperCase().replace(/\s/g, '');
  return (VALID_LEAD as readonly string[]).includes(up) ? (up as any) : null;
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

  const phoneIdx   = col('billing number', 'billing', 'phone');
  const emailIdx   = col('email');
  const streetIdx  = col('street', 'service address');
  const cityIdx    = col('city');
  const stateIdx   = col('state');
  const zipIdx     = col('zip', 'postal');
  const orderIdx   = col('order #', 'order#', 'order number');
  const statusIdx  = col('order status', 'status');
  // Installation date: prefer explicit "install/installation/scheduled/service/appointment date".
  // If none of those exist, fall back to creation-style columns ("date created", "order date",
  // "created", "submitted") — for order-export TSVs the creation date is what the user treats
  // as the install date.
  const installDIdx = (() => {
    const explicit = headers.findIndex((h) =>
      (h.includes('install') || h.includes('scheduled') || h.includes('appointment') ||
       (h.includes('service') && h.includes('date'))) && h.includes('date')
    );
    if (explicit !== -1) return explicit;
    return headers.findIndex((h) =>
      (h.includes('date created') || h.includes('created date') || h === 'created' ||
       h.includes('created at') || h.includes('order date') || h.includes('submitted date') ||
       h === 'date')
    );
  })();
  const installTIdx = headers.findIndex((h) =>
    (h.includes('install') || h.includes('scheduled') || h.includes('appointment') ||
     (h.includes('service') && h.includes('time'))) && h.includes('time')
  );
  const leadIdx    = col('lead size', 'package', 'speed', 'plan');

  if (nameIdx === -1 && !(firstIdx >= 0 && lastIdx >= 0)) return null;

  const cell = (row: string[], idx: number): string | null =>
    idx >= 0 ? nullish(row[idx]) : null;

  const customers: any[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (!lines[i].includes('\t')) continue;
    const c = lines[i].split('\t');
    const name = nameIdx === -2
      ? nullish(`${c[firstIdx] || ''} ${c[lastIdx] || ''}`)
      : cell(c, nameIdx);
    if (!name || name.length < 2) continue;

    const phone  = formatPhone(cell(c, phoneIdx));
    const email  = cell(c, emailIdx);
    const street = cell(c, streetIdx);
    const city   = cell(c, cityIdx);
    const state  = cell(c, stateIdx);
    const zip    = cell(c, zipIdx);
    const addrParts = [street, [city, state].filter(Boolean).join(', ') || null, zip].filter(Boolean);
    const addr = addrParts.length > 0 ? addrParts.join(' ') : null;

    customers.push({
      name,
      email,
      phone,
      serviceAddress: addr,
      installationDate: normDate(cell(c, installDIdx)),
      installationTime: cell(c, installTIdx),
      isReferral: false,
      referralSource: null,
      leadSize: normLeadSize(cell(c, leadIdx)),
      orderNumber: cell(c, orderIdx),
      notes: cell(c, statusIdx),
      confidence: phone && addr ? 95 : addr ? 75 : phone ? 65 : 50,
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
CRITICAL: if a field is not present in the source data, return null. Never invent, guess, or substitute placeholders ("Not provided", "N/A", "", today's date, etc.).
Fields per customer (use null when missing):
- name: string (required; skip records with no name)
- phone: formatted (XXX) XXX-XXXX, else null
- email: string or null
- serviceAddress: full address string or null
- installationDate: YYYY-MM-DD or null (do NOT default to today). If no explicit install/scheduled/service/appointment date exists, accept a creation/order date ("Date Created", "Order Date", "Submitted") and convert to YYYY-MM-DD
- installationTime: string or null
- orderNumber: string or null
- notes: string or null
- isReferral: true only if the source explicitly indicates a referral; otherwise false
- referralSource: string or null (null unless isReferral is true)
- leadSize: exactly "500MB", "1GIG", "2GIG", or null
- confidence: 95 (name+phone+address), 70 (missing phone), 50 (minimal)
Return JSON: {"customers":[{...}],"formatDetected":"FREE_TEXT"}`,
      },
      { role: 'user', content: `Extract all customer records:\n\n${text.slice(0, 6000)}` },
    ],
  });

  const parsed = JSON.parse(completion.choices[0]?.message?.content || '{"customers":[]}');
  return {
    customers: (parsed.customers || [])
      .map((c: any) => {
        const name = nullish(c.name);
        if (!name) return null;
        return {
          name,
          email: nullish(c.email),
          phone: formatPhone(c.phone),
          serviceAddress: nullish(c.serviceAddress),
          installationDate: normDate(c.installationDate),
          installationTime: nullish(c.installationTime),
          isReferral: c.isReferral === true,
          referralSource: c.isReferral === true ? nullish(c.referralSource) : null,
          leadSize: normLeadSize(c.leadSize),
          orderNumber: nullish(c.orderNumber),
          notes: nullish(c.notes),
          confidence: typeof c.confidence === 'number' ? c.confidence : 70,
        };
      })
      .filter(Boolean),
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
