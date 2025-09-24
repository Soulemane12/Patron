import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('Test batch endpoint called');

    const body = await request.json();
    console.log('Request body:', body);

    const { batchText, userId } = body;

    console.log('Extracted values:', {
      batchText: batchText ? batchText.substring(0, 100) : 'MISSING',
      userId: userId || 'MISSING'
    });

    // Simple parsing test
    if (batchText) {
      const lines = batchText.split('\n').filter((line: string) => line.trim());
      console.log('Lines found:', lines.length);
      console.log('First few lines:', lines.slice(0, 3));
    }

    return NextResponse.json({
      success: true,
      receivedText: !!batchText,
      receivedUserId: !!userId,
      textLength: batchText?.length || 0,
      linesCount: batchText ? batchText.split('\n').filter(line => line.trim()).length : 0
    });

  } catch (error: any) {
    console.error('Test batch error:', error);
    return NextResponse.json({
      error: 'Test failed',
      details: error.message
    }, { status: 500 });
  }
}