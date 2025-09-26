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
  } else {
    // Handle legacy unstructured format - same logic as batch-customers route
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        // Split by common delimiters (comma, tab, pipe)
        let parts = line.split(/[,\t|]/);

        // If we don't have enough parts, try other delimiters or assume it's one long string
        if (parts.length < 4) {
          parts = line.split(/\s{2,}/); // Split by multiple spaces
        }

        // Clean up parts
        parts = parts.map(part => part.trim()).filter(part => part);

        // Basic extraction - this is a simple heuristic approach
        let name = '';
        let email = '';
        let phone = '';
        let serviceAddress = '';
        let installationDate = '';
        let installationTime = '';
        let leadSize: '500MB' | '1GIG' | '2GIG' = '2GIG';

        // Extract information using patterns
        for (const part of parts) {
          // Email detection
          if (part.includes('@') && !email) {
            email = part;
          }
          // Phone detection (numbers with dashes, dots, or parentheses)
          else if (/[\d\-\(\)\.\s]{10,}/.test(part) && /\d{3}/.test(part) && !phone) {
            phone = part;
          }
          // Date detection (contains month names or date patterns)
          else if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2})/i.test(part) && !installationDate) {
            installationDate = part;
          }
          // Time detection (contains time patterns)
          else if (/\b(\d{1,2}:\d{2}|\d{1,2}\s*(am|pm))/i.test(part) && !installationTime) {
            installationTime = part;
          }
          // Lead size detection
          else if (/\b(500mb|1gig|2gig)\b/i.test(part)) {
            const match = part.toLowerCase().match(/(500mb|1gig|2gig)/);
            if (match) {
              leadSize = match[1].toUpperCase() as '500MB' | '1GIG' | '2GIG';
            }
          }
          // Address detection (longer strings that aren't other fields)
          else if (part.length > 10 && !serviceAddress && !part.includes('@') && !/^\d+$/.test(part)) {
            serviceAddress = part;
          }
          // Name detection (first non-identified string, typically)
          else if (!name && part.length > 1 && !part.includes('@') && !/[\d\-\(\)\.]{5,}/.test(part)) {
            name = part;
          }
        }

        // Fallback: if we have at least 3 parts, assume name, phone, email order
        if (!name && parts.length >= 3) {
          name = parts[0];
          if (!phone && parts[1]) phone = parts[1];
          if (!email && parts[2]) email = parts[2];
          if (!serviceAddress && parts[3]) serviceAddress = parts[3];
          if (!installationDate && parts[4]) installationDate = parts[4];
          if (!installationTime && parts[5]) installationTime = parts[5];
        }

        // Format the installation date using the helper function
        installationDate = parseAndFormatDate(installationDate);

        // Clean up installation time
        if (!installationTime) {
          installationTime = '10:00 AM'; // Default time
        }

        // Ensure we have at least some data - be more lenient
        if (!name && parts.length > 0) name = parts[0];
        if (!email && parts.length > 1) {
          // Look for email-like pattern in any part
          for (const part of parts) {
            if (part.includes('@')) {
              email = part;
              break;
            }
          }
          // If still no email, create a placeholder
          if (!email) email = `customer${i + 1}@example.com`;
        }
        if (!phone && parts.length > 2) {
          // Look for phone-like pattern in any part
          for (const part of parts) {
            if (/[\d\-\(\)\.\s]{10,}/.test(part) && /\d{3}/.test(part)) {
              phone = part;
              break;
            }
          }
          // If still no phone, create a placeholder
          if (!phone) phone = '555-000-0000';
        }

        // Always add customer if we have at least a name or some parts
        if (name || parts.length > 0) {
          customers.push({
            name: name || `Customer ${i + 1}`,
            email: email || `customer${i + 1}@example.com`,
            phone: phone || '555-000-0000',
            serviceAddress: serviceAddress || 'Address not provided',
            installationDate,
            installationTime,
            isReferral: false,
            referralSource: '',
            leadSize
          });
        }
      } catch (error) {
        console.error(`Error parsing line ${i + 1}: ${line}`, error);
        // Continue to next line
      }
    }
  }

  return customers;
}

export async function POST(request: NextRequest) {
  try {
    const { batchText } = await request.json();

    if (!batchText) {
      return NextResponse.json({ error: 'Missing batch text' }, { status: 400 });
    }

    // Parse the batch text into customer objects
    const customers = parseBatchText(batchText);

    if (customers.length === 0) {
      return NextResponse.json({ error: 'No valid customer data found in the provided text. Please check your data format.' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      customers,
      count: customers.length
    });

  } catch (error: any) {
    console.error('Preview batch processing error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}