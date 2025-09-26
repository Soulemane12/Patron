import { NextRequest, NextResponse } from 'next/server';

interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
  serviceAddress: string;
  installationDate: string;
  installationTime: string;
  isReferral: boolean;
  referralSource: string;
  leadSize: '500MB' | '1GIG' | '2GIG';
}

// Function to parse and format dates from various formats
function parseAndFormatDate(dateStr: string): string {
  if (!dateStr || dateStr === 'null') {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    return futureDate.toISOString().split('T')[0];
  }

  try {
    // Handle formats like "Jul 26, 2025" or "Aug 2, 2025"
    const monthMap: { [key: string]: string } = {
      'jan': '01', 'january': '01',
      'feb': '02', 'february': '02',
      'mar': '03', 'march': '03',
      'apr': '04', 'april': '04',
      'may': '05',
      'jun': '06', 'june': '06',
      'jul': '07', 'july': '07',
      'aug': '08', 'august': '08',
      'sep': '09', 'september': '09',
      'oct': '10', 'october': '10',
      'nov': '11', 'november': '11',
      'dec': '12', 'december': '12'
    };

    const cleanDate = dateStr.toLowerCase().trim();

    // Match pattern like "jul 26, 2025"
    const monthDayYearMatch = cleanDate.match(/(\w{3,})\s+(\d{1,2}),?\s+(\d{4})/);
    if (monthDayYearMatch) {
      const [, monthName, day, year] = monthDayYearMatch;
      const monthNum = monthMap[monthName];
      if (monthNum) {
        return `${year}-${monthNum}-${day.padStart(2, '0')}`;
      }
    }

    // Try to parse as a standard date
    const parsedDate = new Date(dateStr);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString().split('T')[0];
    }

    // Fallback to current date + 7 days
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    return futureDate.toISOString().split('T')[0];

  } catch (error) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    return futureDate.toISOString().split('T')[0];
  }
}

// Function to parse different spreadsheet formats
function parseBatchText(batchText: string): CustomerInfo[] {
  const lines = batchText.split('\n').filter((line: string) => line.trim());
  const customers: CustomerInfo[] = [];

  // Check if this looks like a structured spreadsheet with headers
  const firstLine = lines[0];
  const isStructuredData = firstLine && (
    firstLine.includes('Rep ID') ||
    firstLine.includes('Street Address') ||
    firstLine.includes('Installation Date') ||
    firstLine.includes('Fiber Plan') ||
    firstLine.includes('Order Date')
  );

  if (isStructuredData && lines.length > 1) {
    // Handle structured spreadsheet data
    const headers = lines[0].split('\t').map(h => h.trim());

    // Find column indices - looking for the rep name which comes after Rep ID
    const repIdIndex = headers.findIndex(h => h.includes('Rep ID'));
    const repNameIndex = repIdIndex >= 0 ? repIdIndex + 1 : -1; // Rep name is typically in the column after Rep ID
    const streetAddressIndex = headers.findIndex(h => h.includes('Street Address'));
    const cityIndex = headers.findIndex(h => h.includes('City'));
    const stateIndex = headers.findIndex(h => h.includes('State'));
    const zipIndex = headers.findIndex(h => h.includes('Zip'));
    const installDateIndex = headers.findIndex(h => h.includes('Installation Date'));
    const fiberPlanIndex = headers.findIndex(h => h.includes('Fiber Plan'));
    const unitIndex = headers.findIndex(h => h.includes('Unit'));

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const parts = line.split('\t').map(part => part.trim());

        // Extract data from specific columns
        const repName = repNameIndex >= 0 ? parts[repNameIndex] || '' : '';
        const streetAddress = streetAddressIndex >= 0 ? parts[streetAddressIndex] || '' : '';
        const unit = unitIndex >= 0 ? parts[unitIndex] || '' : '';
        const city = cityIndex >= 0 ? parts[cityIndex] || '' : '';
        const state = stateIndex >= 0 ? parts[stateIndex] || '' : '';
        const zipCode = zipIndex >= 0 ? parts[zipIndex] || '' : '';
        const installDate = installDateIndex >= 0 ? parts[installDateIndex] || '' : '';
        const fiberPlan = fiberPlanIndex >= 0 ? parts[fiberPlanIndex] || '' : '';

        // Build full address
        let serviceAddress = streetAddress;
        if (unit && unit !== 'null' && unit !== '') {
          serviceAddress += ` Unit ${unit}`;
        }
        if (city) serviceAddress += `, ${city}`;
        if (state) serviceAddress += `, ${state}`;
        if (zipCode) serviceAddress += ` ${zipCode}`;

        // Determine lead size from fiber plan
        let leadSize: '500MB' | '1GIG' | '2GIG' = '2GIG';
        if (fiberPlan.toLowerCase().includes('500')) {
          leadSize = '500MB';
        } else if (fiberPlan.toLowerCase().includes('1 gig') || fiberPlan.toLowerCase().includes('1gig')) {
          leadSize = '1GIG';
        } else if (fiberPlan.toLowerCase().includes('2 gig') || fiberPlan.toLowerCase().includes('2gig')) {
          leadSize = '2GIG';
        }

        // Format installation date
        let formattedDate = '';
        if (installDate) {
          formattedDate = parseAndFormatDate(installDate);
        } else {
          // Default to 7 days from now
          const futureDate = new Date();
          futureDate.setDate(futureDate.getDate() + 7);
          formattedDate = futureDate.toISOString().split('T')[0];
        }

        // Only add if we have essential data
        if (streetAddress && repName) {
          customers.push({
            name: repName || `Customer ${i}`,
            email: `${repName.toLowerCase().replace(/\s+/g, '.')}${i}@example.com`,
            phone: '555-000-0000', // Placeholder since not in spreadsheet
            serviceAddress: serviceAddress || 'Address not provided',
            installationDate: formattedDate,
            installationTime: '10:00 AM', // Default time
            isReferral: false,
            referralSource: '',
            leadSize
          });
        }
      } catch (error) {
        console.error(`Error parsing structured line ${i}: ${line}`, error);
        continue;
      }
    }
  }

  return customers;
}

export async function POST(request: NextRequest) {
  try {
    console.log('Test batch endpoint called');

    const body = await request.json();
    const { batchText, userId } = body;

    // Test the parsing logic
    const customers = parseBatchText(batchText);

    return NextResponse.json({
      success: true,
      receivedText: !!batchText,
      receivedUserId: !!userId,
      textLength: batchText?.length || 0,
      linesCount: batchText ? batchText.split('\n').filter((line: string) => line.trim()).length : 0,
      parsedCustomers: customers.length,
      sampleCustomers: customers.slice(0, 3), // Show first 3 parsed customers
      isStructuredData: batchText ? (
        batchText.includes('Rep ID') ||
        batchText.includes('Street Address') ||
        batchText.includes('Installation Date') ||
        batchText.includes('Fiber Plan')
      ) : false
    });

  } catch (error: any) {
    console.error('Test batch error:', error);
    return NextResponse.json({
      error: 'Test failed',
      details: error.message
    }, { status: 500 });
  }
}