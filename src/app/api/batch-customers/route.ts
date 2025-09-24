import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

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

// Function to parse different spreadsheet formats
function parseBatchText(batchText: string): CustomerInfo[] {
  const lines = batchText.split('\n').filter(line => line.trim());
  const customers: CustomerInfo[] = [];

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

      // Format the installation date if needed
      if (installationDate) {
        // Try to convert to YYYY-MM-DD format
        const dateStr = installationDate.toLowerCase();

        // Handle common date formats
        if (dateStr.includes('/')) {
          const dateParts = dateStr.split('/');
          if (dateParts.length === 3) {
            let month = dateParts[0];
            let day = dateParts[1];
            let year = dateParts[2];

            // Assume MM/DD/YYYY or MM/DD/YY format
            if (year.length === 2) {
              year = '20' + year;
            }
            installationDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }
        } else {
          // Try to extract date from text like "June 15th" or "June 15"
          const today = new Date();
          const currentYear = today.getFullYear();

          // Simple month mapping
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

          // Extract month and day
          let month = '';
          let day = '';

          for (const [monthName, monthNum] of Object.entries(monthMap)) {
            if (dateStr.includes(monthName)) {
              month = monthNum;
              // Try to extract day number
              const dayMatch = dateStr.match(/\b(\d{1,2})\b/);
              if (dayMatch) {
                day = dayMatch[1].padStart(2, '0');
              }
              break;
            }
          }

          if (month && day) {
            installationDate = `${currentYear}-${month}-${day}`;
          } else {
            // Fallback: use today's date + 7 days
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 7);
            installationDate = futureDate.toISOString().split('T')[0];
          }
        }
      } else {
        // Default to 7 days from now
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);
        installationDate = futureDate.toISOString().split('T')[0];
      }

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

  return customers;
}

export async function POST(request: NextRequest) {
  try {
    const { batchText, userId } = await request.json();

    console.log('Batch import request:', {
      hasText: !!batchText,
      textLength: batchText?.length,
      hasUserId: !!userId,
      userId: userId
    });

    if (!batchText || !userId) {
      console.log('Missing required fields:', { batchText: !!batchText, userId: !!userId });
      return NextResponse.json({ error: 'Missing batch text or user ID' }, { status: 400 });
    }

    // Parse the batch text into customer objects
    const customers = parseBatchText(batchText);

    console.log('Parsed customers:', customers.length);

    if (customers.length === 0) {
      console.log('No valid customers found in text:', batchText.substring(0, 200));
      return NextResponse.json({ error: 'No valid customer data found in the provided text. Please check your data format.' }, { status: 400 });
    }

    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // Process each customer
    for (let i = 0; i < customers.length; i++) {
      const customer = customers[i];

      try {
        const customerData = {
          user_id: userId,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          service_address: customer.serviceAddress,
          installation_date: customer.installationDate,
          installation_time: customer.installationTime,
          status: 'active' as const,
          is_referral: customer.isReferral,
          referral_source: customer.isReferral ? customer.referralSource : null,
          lead_size: customer.leadSize,
        };

        const { error } = await supabase
          .from('customers')
          .insert([customerData]);

        if (error) {
          failedCount++;
          console.error('Database error for customer:', customer.name, error);
          errors.push(`Row ${i + 1} (${customer.name}): ${error.message}`);
        } else {
          successCount++;
        }
      } catch (error: any) {
        failedCount++;
        console.error('Processing error for customer:', customer.name, error);
        errors.push(`Row ${i + 1} (${customer.name}): ${error.message || 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: successCount,
      failed: failedCount,
      errors: errors,
      message: `Processed ${customers.length} customers: ${successCount} successful, ${failedCount} failed`
    });

  } catch (error: any) {
    console.error('Batch customer processing error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}