import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { parseUniversalDataWithAI } from '../../../lib/aiDataParser';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json(
        { error: 'Text input is required' },
        { status: 400 }
      );
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'No authorization token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const result = await parseUniversalDataWithAI(text);

    return NextResponse.json({
      customers: result.customers,
      formatDetected: result.formatDetected,
      warnings: result.warnings,
      errors: result.errors,
      totalFound: result.customers.length,
    });

  } catch (error: any) {
    console.error('Batch import error:', error);

    if (error.status === 429 || error.message?.includes('rate_limit_exceeded')) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: error.message,
          type: 'rate_limit',
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to process batch import',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
