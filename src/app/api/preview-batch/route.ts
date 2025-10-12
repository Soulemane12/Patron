import { NextRequest, NextResponse } from 'next/server';
import { parseUniversalData, CustomerInfo as UniversalCustomerInfo } from '../../../lib/universalDataParser';
import { parseUniversalDataWithAI, AI_PARSER_PRESETS } from '../../../lib/aiDataParser';
import { createSecurityModule, SECURITY_PRESETS } from '../../../lib/aiParserSecurity';

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

    // Handle "Tuesday, July 29, 2025" format
    const dayMonthYearMatch = cleanDate.match(/(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+(\w+)\s+(\d{1,2}),?\s+(\d{4})/i);
    if (dayMonthYearMatch) {
      const [, monthName, day, year] = dayMonthYearMatch;
      const monthNum = monthMap[monthName];
      if (monthNum) {
        return `${year}-${monthNum}-${day.padStart(2, '0')}`;
      }
    }

    // Match pattern like "jul 26, 2025" or "July 25, 2025"
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

// Function to parse sales report format
function parseSalesReport(batchText: string): CustomerInfo[] {
  const customers: CustomerInfo[] = [];
  const lines = batchText.split('\n');

  let currentCustomer: Partial<CustomerInfo> = {};
  let collectingCustomerData = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Skip header lines like "Week 1:", "Total Sales:", etc.
    if (line.includes('Week ') || line.includes('Total Sales:') || line.includes('Completed:') || line.includes('Cancels:') || line.includes('MONTHLY TOTAL') || line.includes('orders')) {
      continue;
    }

    // Look for customer name patterns (starting with checkmarks or bullets)
    if (line.match(/^[✓◦•]\s+(.+)/)) {
      // If we have a previous customer, save it
      if (currentCustomer.name && (currentCustomer.email || currentCustomer.phone || currentCustomer.serviceAddress)) {
        customers.push(completeCustomer(currentCustomer));
      }

      // Start new customer
      currentCustomer = {};
      collectingCustomerData = true;

      // Extract name from line with checkmark
      const nameMatch = line.match(/^[✓◦•]\s+(.+)/);
      if (nameMatch) {
        currentCustomer.name = nameMatch[1].replace(/[✅💰]/g, '').trim();
      }

      continue;
    }

    if (collectingCustomerData && currentCustomer.name) {
      // Extract email
      if (!currentCustomer.email && line.includes('@')) {
        const emailMatch = line.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (emailMatch) {
          currentCustomer.email = emailMatch[1];
        }
      }

      // Extract phone number (more flexible patterns)
      if (!currentCustomer.phone) {
        const phoneMatch = line.match(/(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/);
        if (phoneMatch) {
          currentCustomer.phone = phoneMatch[1];
        }
      }

      // Extract service address - enhanced multi-line extraction
      if (!currentCustomer.serviceAddress) {
        if (line.includes('Service address:') || line.includes('Service Address:')) {
          const addressMatch = line.match(/Service [Aa]ddress:[-\s]*(.+)/);
          if (addressMatch) {
            currentCustomer.serviceAddress = addressMatch[1].trim();
            // Look ahead for additional address lines (city, state, zip)
            if (i + 1 < lines.length) {
              const nextLine = lines[i + 1].trim();
              if (nextLine && !nextLine.match(/^[✓◦•]/) && !nextLine.includes('@') && !nextLine.includes('Installation') && !nextLine.includes('Order number') && nextLine.match(/^[A-Za-z\s]+,\s+[A-Z]{2}\s+\d{5}/)) {
                currentCustomer.serviceAddress += `, ${nextLine}`;
              }
            }
          }
        } else if (line.match(/^\d+\s+[A-Za-z]/) && !line.includes('@') && !line.includes('Installation')) {
          // Standalone address line starting with number
          currentCustomer.serviceAddress = line.trim();
          // Look ahead for city, state, zip
          if (i + 1 < lines.length) {
            const nextLine = lines[i + 1].trim();
            if (nextLine.match(/^[A-Za-z\s]+,\s+[A-Z]{2}\s+\d{5}/)) {
              currentCustomer.serviceAddress += `, ${nextLine}`;
            }
          }
        }
      }

      // Extract installation date - enhanced pattern matching
      if (!currentCustomer.installationDate) {
        if (line.includes('Installation') || line.includes('Install')) {
          const dateMatch = line.match(/(?:Installation|Install)(?:\s*[Dd]ate)?:?[-\s]*(.+)/);
          if (dateMatch) {
            currentCustomer.installationDate = parseAndFormatDate(dateMatch[1].trim());
          }
        } else if (line.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(January|February|March|April|May|June|July|August|September|October|November|December|\w{3})\s+\d{1,2},?\s+\d{4}/i)) {
          // Standalone date line like "Tuesday, July 29, 2025"
          currentCustomer.installationDate = parseAndFormatDate(line.trim());
        } else if (line.match(/(January|February|March|April|May|June|July|August|September|October|November|December|\w{3})\s+\d{1,2},?\s+\d{4}/i)) {
          // Date without day of week like "July 25, 2025"
          currentCustomer.installationDate = parseAndFormatDate(line.trim());
        }
      }

      // Extract installation time - enhanced time range patterns
      if (!currentCustomer.installationTime) {
        const timeRangeMatch = line.match(/(\d{1,2}[-\s]*\d{1,2}\s*(?:p\.?m\.?|a\.?m\.?)|^\d{1,2}am\s*[-]\s*\d{1,2}pm|^\d{1,2}:\d{2}\s*(?:a\.?m\.?|p\.?m\.?))/i);
        if (timeRangeMatch) {
          currentCustomer.installationTime = timeRangeMatch[1].trim();
        } else if (line.match(/(\d{1,2}:\d{2})/)) {
          // Handle standard time format
          const timeMatch = line.match(/(\d{1,2}:\d{2}(?:\s*[ap]\.?m\.?)?)/i);
          if (timeMatch) {
            currentCustomer.installationTime = timeMatch[1].trim();
          }
        }
      }

      // Extract lead size - enhanced pattern matching for all variations
      if (!currentCustomer.leadSize) {
        const leadSizeMatch = line.toLowerCase().match(/(500\s*mb(?:sp?)?|1\s*gig?|2\s*gig?|2\s*gb)/i);
        if (leadSizeMatch) {
          const size = leadSizeMatch[1].replace(/\s/g, '').toLowerCase();
          if (size.includes('500mb')) {
            currentCustomer.leadSize = '500MB';
          } else if (size.includes('1gig') || size.includes('1g')) {
            currentCustomer.leadSize = '1GIG';
          } else if (size.includes('2gig') || size.includes('2gb') || size.includes('2g')) {
            currentCustomer.leadSize = '2GIG';
          }
        }
      }

      // Stop collecting if we hit another customer or section
      if (line.match(/^[✓◦•]\s+/)) {
        collectingCustomerData = false;
        i--; // Go back one line to process the new customer
      }
    }
  }

  // Don't forget the last customer
  if (currentCustomer.name && (currentCustomer.email || currentCustomer.phone || currentCustomer.serviceAddress)) {
    customers.push(completeCustomer(currentCustomer));
  }

  return customers;
}

// Helper function to complete customer data with defaults
function completeCustomer(partial: Partial<CustomerInfo>): CustomerInfo {
  return {
    name: partial.name || 'Unknown Customer',
    email: partial.email || `${(partial.name || 'customer').toLowerCase().replace(/\s+/g, '.')}@example.com`,
    phone: partial.phone || '555-000-0000',
    serviceAddress: partial.serviceAddress || 'Address not provided',
    installationDate: partial.installationDate || (() => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      return futureDate.toISOString().split('T')[0];
    })(),
    installationTime: partial.installationTime || '10:00 AM',
    isReferral: false,
    referralSource: '',
    leadSize: (partial.leadSize as '500MB' | '1GIG' | '2GIG') || '2GIG'
  };
}

// Function to parse different spreadsheet formats
function parseBatchText(batchText: string): CustomerInfo[] {
  const lines = batchText.split('\n').filter((line: string) => line.trim());
  const customers: CustomerInfo[] = [];

  // Check if this looks like a sales report format
  const isSalesReport = batchText.includes('Week ') || batchText.includes('Total Sales:') || batchText.includes('Order number:') || batchText.includes('Service address:');

  if (isSalesReport) {
    return parseSalesReport(batchText);
  }

  // Check if this looks like a structured spreadsheet with headers OR structured data without headers
  const firstLine = lines[0];
  const hasHeaders = firstLine && (
    firstLine.includes('Rep ID') ||
    firstLine.includes('Street Address') ||
    firstLine.includes('Installation Date') ||
    firstLine.includes('Fiber Plan') ||
    firstLine.includes('Order Date')
  );

  // Check if it looks like structured data based on pattern (many tab-separated columns)
  const firstLineColumns = firstLine ? firstLine.split('\t').length : 0;
  const hasStructuredPattern = firstLineColumns >= 20; // Your data has ~26 columns

  // Check for order management format specifically
  const isOrderFormat = firstLineColumns >= 25 && firstLine &&
    (firstLine.includes('Order Date') || firstLine.includes('Rep ID') ||
     (hasStructuredPattern && batchText.includes('Regular Order') && batchText.includes('Fiber')))

  const isStructuredData = hasHeaders || hasStructuredPattern || isOrderFormat;

  if (isStructuredData && lines.length > 1) {
    // Handle structured spreadsheet data
    const headers = lines[0].split('\t').map(h => h.trim());

    // Find column indices - with fallback to fixed positions for known spreadsheet format
    const repIdIndex = headers.findIndex(h => h.includes('Rep ID'));
    const streetAddressIndex = headers.findIndex(h => h.includes('Street Address'));
    const cityIndex = headers.findIndex(h => h.includes('City'));
    const stateIndex = headers.findIndex(h => h.includes('State'));
    const zipIndex = headers.findIndex(h => h.includes('Zip'));
    const installDateIndex = headers.findIndex(h => h.includes('Installation Date'));
    const fiberPlanIndex = headers.findIndex(h => h.includes('Fiber Plan'));
    const unitIndex = headers.findIndex(h => h.includes('Unit'));

    // For structured data without headers, use fixed positions based on the spreadsheet format
    let repNameIndex = repIdIndex >= 0 ? repIdIndex + 1 : -1;

    // If we have structured data but no header matches, use fixed column positions
    if (hasStructuredPattern && !hasHeaders) {
      repNameIndex = 6; // Rep name is in column 7 (0-indexed as 6)
    } else if (repIdIndex >= 0) {
      repNameIndex = repIdIndex + 1; // Rep name comes after Rep ID
    }

    // Handle order management format with specific column mappings
    if (isOrderFormat && firstLineColumns >= 25) {
      console.log('Detected order management format with', firstLineColumns, 'columns');
    }


    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const parts = line.split('\t').map(part => part.trim());

        // Extract data from specific columns
        let repName, streetAddress, unit, city, state, zipCode, installDate, fiberPlan;

        if (isOrderFormat && firstLineColumns >= 25) {
          // Handle order management format with specific column positions
          repName = parts[6] || ''; // Rep Name
          streetAddress = parts[11] || ''; // Street Address
          unit = parts[12] || ''; // Unit
          city = parts[13] || ''; // City
          state = parts[14] || ''; // State
          zipCode = parts[15] || ''; // Zip
          installDate = parts[17] || ''; // Installation Date
          fiberPlan = parts[8] || ''; // Fiber Plan

          // Extract status for order format (column 16)
          const orderStatus = parts[16] || '';
          console.log(`Processing order: ${repName}, Status: ${orderStatus}, Plan: ${fiberPlan}`);
        } else if (hasStructuredPattern && !hasHeaders) {
          // Use fixed positions for data without headers
          repName = parts[6] || '';
          streetAddress = parts[11] || '';
          unit = parts[12] || '';
          city = parts[13] || '';
          state = parts[14] || '';
          zipCode = parts[15] || '';
          installDate = parts[17] || '';
          fiberPlan = parts[8] || '';
        } else {
          // Use header-based indices
          repName = repNameIndex >= 0 ? parts[repNameIndex] || '' : '';
          streetAddress = streetAddressIndex >= 0 ? parts[streetAddressIndex] || '' : '';
          unit = unitIndex >= 0 ? parts[unitIndex] || '' : '';
          city = cityIndex >= 0 ? parts[cityIndex] || '' : '';
          state = stateIndex >= 0 ? parts[stateIndex] || '' : '';
          zipCode = zipIndex >= 0 ? parts[zipIndex] || '' : '';
          installDate = installDateIndex >= 0 ? parts[installDateIndex] || '' : '';
          fiberPlan = fiberPlanIndex >= 0 ? parts[fiberPlanIndex] || '' : '';
        }

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
        const fiberPlanLower = fiberPlan.toLowerCase();
        if (fiberPlanLower.includes('500')) {
          leadSize = '500MB';
        } else if (fiberPlanLower.includes('1 gig') || fiberPlanLower.includes('1gig')) {
          leadSize = '1GIG';
        } else if (fiberPlanLower.includes('2 gig') || fiberPlanLower.includes('2gig') ||
                   fiberPlanLower.includes('founders club 2 gig') || fiberPlanLower.includes('fiber founders club 2 gig')) {
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
          // Generate more realistic email from name and address
          const emailName = repName.toLowerCase()
            .replace(/[^a-z\s]/g, '') // Remove non-letters except spaces
            .replace(/\s+/g, '.') // Replace spaces with dots
            .substring(0, 20); // Limit length

          customers.push({
            name: repName || `Customer ${i}`,
            email: `${emailName}@customer.com`,
            phone: '555-000-0000', // Placeholder since not in order data
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
    console.log('📨📨📨 PREVIEW BATCH ENDPOINT CALLED 📨📨📨');
    console.log('Request method:', request.method);
    console.log('Request URL:', request.url);
    console.log('Content-Type:', request.headers.get('content-type'));
    console.log('User-Agent:', request.headers.get('user-agent'));

    let requestData;

    // Handle JSON parsing errors gracefully
    try {
      console.log('🔍 Attempting to parse JSON request...');
      requestData = await request.json();
      console.log('✅ JSON parsing successful');
      console.log('Request data keys:', Object.keys(requestData));
      console.log('BatchText length:', requestData.batchText?.length || 0);
    } catch (jsonError) {
      console.error('JSON parsing error:', jsonError);

      // Try to read the raw text and clean it
      try {
        const rawText = await request.text();
        console.log('Raw request text (first 200 chars):', rawText.substring(0, 200));

        // Try to extract batchText from malformed JSON
        const batchTextMatch = rawText.match(/"batchText"\s*:\s*"([\s\S]*?)"/m);
        if (batchTextMatch) {
          const extractedText = batchTextMatch[1]
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\');

          console.log('Extracted text from malformed JSON, length:', extractedText.length);
          requestData = { batchText: extractedText };
        } else {
          throw new Error('Could not extract batch text from request');
        }
      } catch (extractError) {
        console.error('Failed to extract data from malformed request:', extractError);
        return NextResponse.json({
          error: 'Invalid JSON format in request',
          details: 'Please ensure your data is properly formatted. Control characters and special characters may cause issues when copying from spreadsheets.',
          type: 'json_parsing_error',
          suggestion: 'Try copying smaller chunks of data or removing any special formatting from your spreadsheet.'
        }, { status: 400 });
      }
    }

    const { batchText, useAI = true, aiConfig = 'MAXIMUM_ACCURACY' } = requestData;

    if (!batchText) {
      return NextResponse.json({ error: 'Missing batch text' }, { status: 400 });
    }

    // Sanitize input data by removing null bytes and other control characters that might cause AI issues
    const sanitizedBatchText = batchText
      .replace(/\x00/g, '') // Remove null bytes
      .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove other control characters except \n, \r, \t
      .trim();

    if (sanitizedBatchText !== batchText) {
      console.log('⚠️ Input data contained control characters that were removed');
      console.log('Original length:', batchText.length, 'Sanitized length:', sanitizedBatchText.length);
    }

    let parseResult;

    // Always use AI for maximum accuracy
    if (process.env.GROQ_API_KEY) {
      console.log('🤖 Using AI-Only Data Parser for maximum accuracy preview');

      try {
        // Initialize security module with PERMISSIVE preset to allow email extraction
        const security = createSecurityModule('PERMISSIVE');

        // Security validation
        const securityCheck = await security.validateSecurityRequirements(sanitizedBatchText, {
          userAgent: request.headers.get('user-agent') || undefined,
          ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] ||
                     request.headers.get('x-real-ip') || undefined
        });

        if (!securityCheck.isValid) {
          console.log('❌ Security validation failed:', securityCheck.errors);
          return NextResponse.json({
            error: 'Security validation failed',
            details: securityCheck.errors,
            warnings: securityCheck.warnings
          }, { status: 400 });
        }

        // Use AI parser with maximum accuracy settings - no cost considerations
        const aiParserConfig = AI_PARSER_PRESETS.MAXIMUM_ACCURACY; // Absolute maximum accuracy
        parseResult = await parseUniversalDataWithAI(securityCheck.sanitizedData, aiParserConfig);

        console.log('🤖 AI Preview Result:', {
          formatDetected: parseResult.formatDetected,
          confidence: parseResult.confidence,
          customersFound: parseResult.customers.length,
          warnings: parseResult.warnings.length,
          errors: parseResult.errors.length,
          aiProcessingTime: parseResult.metadata.aiProcessingTime,
          tokensUsed: parseResult.metadata.tokensUsed,
          costEstimate: `$${parseResult.metadata.costEstimate.toFixed(4)}`
        });

        // Add security info to warnings
        if (securityCheck.piiAnalysis.hasPII) {
          parseResult.warnings.push(`PII detected (${securityCheck.piiAnalysis.riskLevel} risk): ${securityCheck.piiAnalysis.piiTypes.join(', ')}`);
        }

      } catch (aiError: any) {
        console.error('❌❌❌ AI PARSING FAILED COMPLETELY ❌❌❌');
        console.error('AI Error object:', aiError);
        console.error('AI Error name:', aiError.name);
        console.error('AI Error message:', aiError.message);
        console.error('AI Error stack:', aiError.stack);
        console.error('AI Error type:', typeof aiError);
        console.error('❌❌❌ END AI ERROR ❌❌❌');

        // Check if this is the specific non-JSON response error
        if (aiError.message?.includes('AI returned non-JSON response')) {
          return NextResponse.json({
            error: 'Data parsing failed due to corrupted input',
            details: 'The data you copied appears to contain special characters or formatting that cannot be processed. This commonly happens when copying from certain spreadsheet applications.',
            suggestion: 'Try copying smaller sections of data, or save your spreadsheet as a CSV file and copy from there.',
            type: 'data_corruption_error',
            debugInfo: {
              errorType: 'non_json_ai_response',
              sanitizationApplied: sanitizedBatchText !== batchText,
              originalLength: batchText?.length || 0,
              sanitizedLength: sanitizedBatchText?.length || 0
            }
          }, { status: 400 });
        }

        return NextResponse.json({
          error: 'AI parsing failed. System configured for AI-only operation.',
          details: `AI Error: ${aiError}`,
          suggestion: 'Please check GROQ_API_KEY configuration and try again.',
          aiErrorDetails: {
            name: aiError.name,
            message: aiError.message,
            stack: aiError.stack?.split('\n').slice(0, 10),
            type: typeof aiError
          }
        }, { status: 500 });
      }
    } else {
      // No AI key configured - return error since we want AI-only
      console.error('❌ GROQ_API_KEY not configured but system set to AI-only mode');
      return NextResponse.json({
        error: 'AI parsing not available. System configured for AI-only operation.',
        details: 'GROQ_API_KEY environment variable not configured.',
        suggestion: 'Please configure GROQ_API_KEY to use AI parsing.'
      }, { status: 500 });
    }

    console.log('📊 Parse Preview Result:', {
      formatDetected: parseResult.formatDetected,
      confidence: parseResult.confidence,
      customersFound: parseResult.customers.length,
      warnings: parseResult.warnings.length,
      errors: parseResult.errors.length
    });

    // Convert universal parser result to expected format
    const customers: CustomerInfo[] = parseResult.customers.map(customer => ({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      serviceAddress: customer.serviceAddress,
      installationDate: customer.installationDate,
      installationTime: customer.installationTime,
      isReferral: customer.isReferral,
      referralSource: customer.referralSource,
      leadSize: customer.leadSize
    }));

    if (customers.length === 0) {
      // Provide detailed feedback from universal parser
      let errorMessage = 'No valid customer data found in the provided text.';
      if (parseResult.errors.length > 0) {
        errorMessage += ' Errors: ' + parseResult.errors.join('; ');
      }
      if (parseResult.warnings.length > 0) {
        errorMessage += ' Warnings: ' + parseResult.warnings.join('; ');
      }
      errorMessage += ` Format detected: ${parseResult.formatDetected} (${parseResult.confidence}% confidence).`;

      return NextResponse.json({
        error: errorMessage,
        parseDetails: {
          formatDetected: parseResult.formatDetected,
          confidence: parseResult.confidence,
          warnings: parseResult.warnings,
          errors: parseResult.errors,
          metadata: parseResult.metadata
        }
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      customers,
      count: customers.length,
      parseDetails: {
        formatDetected: parseResult.formatDetected,
        confidence: parseResult.confidence,
        warnings: parseResult.warnings,
        errors: parseResult.errors,
        metadata: parseResult.metadata
      }
    });

  } catch (error: any) {
    console.error('❌❌❌ DETAILED ERROR INFORMATION ❌❌❌');
    console.error('Error object:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error type:', typeof error);
    console.error('Error constructor:', error.constructor?.name);

    if (error.cause) {
      console.error('Error cause:', error.cause);
    }

    // Log environment info
    console.error('Environment info:');
    console.error('- GROQ_API_KEY exists:', !!process.env.GROQ_API_KEY);
    console.error('- Node version:', process.version);
    console.error('- Platform:', process.platform);

    // Log request info if available
    try {
      console.error('Request info:');
      console.error('- Headers:', Object.fromEntries(request.headers.entries()));
      console.error('- Method:', request.method);
      console.error('- URL:', request.url);
    } catch (reqError) {
      console.error('Could not log request info:', reqError);
    }

    console.error('❌❌❌ END DETAILED ERROR ❌❌❌');

    // Handle rate limit errors specifically
    if (error.message?.includes('Rate limit exceeded')) {
      return NextResponse.json({
        error: 'Rate limit exceeded',
        message: error.message,
        type: 'rate_limit',
        suggestion: 'Please wait before trying again or upgrade your API plan for higher limits.',
        debugInfo: {
          errorName: error.name,
          errorStack: error.stack?.split('\n').slice(0, 5),
          timestamp: new Date().toISOString()
        }
      }, { status: 429 });
    }

    return NextResponse.json({
      error: 'AI parsing failed. System configured for AI-only operation.',
      details: error.message,
      type: 'ai_parsing_error',
      debugInfo: {
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack?.split('\n').slice(0, 10),
        errorType: typeof error,
        hasGroqKey: !!process.env.GROQ_API_KEY,
        timestamp: new Date().toISOString(),
        nodeVersion: process.version
      }
    }, { status: 500 });
  }
}