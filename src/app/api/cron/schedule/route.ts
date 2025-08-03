import { NextRequest, NextResponse } from 'next/server';

// Store the schedule in memory (will reset on function restart)
let currentSchedule = '0 14 * * *';

export async function GET() {
  try {
    return NextResponse.json({ schedule: currentSchedule });
  } catch (error) {
    console.error('Error reading cron schedule:', error);
    return NextResponse.json({ error: 'Failed to read schedule' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { schedule } = await request.json();

    if (!schedule || typeof schedule !== 'string') {
      return NextResponse.json({ error: 'Schedule is required' }, { status: 400 });
    }

    // Validate cron format (basic validation)
    const cronRegex = /^(\*|[0-9]{1,2}) (\*|[0-9]{1,2}) (\*|[0-9]{1,2}) (\*|[0-9]{1,2}) (\*|[0-9]{1,2})$/;
    if (!cronRegex.test(schedule)) {
      return NextResponse.json({ error: 'Invalid cron format. Use format: minute hour day month weekday' }, { status: 400 });
    }

    // Update the schedule in memory
    currentSchedule = schedule;

    return NextResponse.json({ 
      success: true, 
      schedule: schedule,
      message: 'Schedule updated in memory. Note: This is temporary and will reset on deployment.'
    });

  } catch (error) {
    console.error('Error updating cron schedule:', error);
    return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 });
  }
} 