import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const vercelConfigPath = path.join(process.cwd(), 'vercel.json');

export async function GET() {
  try {
    if (!fs.existsSync(vercelConfigPath)) {
      return NextResponse.json({ error: 'vercel.json not found' }, { status: 404 });
    }

    const config = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));
    const cronSchedule = config.crons?.[0]?.schedule || '0 14 * * *';

    return NextResponse.json({ schedule: cronSchedule });
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

    // Read current config
    let config: any = {};
    if (fs.existsSync(vercelConfigPath)) {
      config = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));
    }

    // Update cron schedule
    config.crons = [
      {
        path: '/api/cron/check-installations',
        schedule: schedule
      }
    ];

    // Write back to file
    fs.writeFileSync(vercelConfigPath, JSON.stringify(config, null, 2));

    return NextResponse.json({ 
      success: true, 
      schedule: schedule,
      message: 'Schedule updated successfully. Deploy to apply changes.'
    });

  } catch (error) {
    console.error('Error updating cron schedule:', error);
    return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 });
  }
} 