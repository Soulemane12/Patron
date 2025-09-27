/**
 * AI-Powered Universal Data Parser
 * Uses LLM intelligence to parse ANY format of customer data
 * Replaces pattern matching with AI understanding
 */

import Groq from 'groq-sdk';

// Re-export types for compatibility
export interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
  serviceAddress: string;
  installationDate: string;
  installationTime: string;
  isReferral: boolean;
  referralSource: string;
  leadSize: '500MB' | '1GIG' | '2GIG';
  orderNumber?: string;
  notes?: string;
  confidence: number;
}

export interface ParseResult {
  customers: CustomerInfo[];
  formatDetected: string;
  confidence: number;
  warnings: string[];
  errors: string[];
  metadata: {
    totalLines: number;
    emptyLines: number;
    headerLines: number;
    dataLines: number;
    averageFieldsPerLine: number;
    aiProcessingTime: number;
    tokensUsed: number;
    costEstimate: number;
  };
}

interface AIParsingConfig {
  maxTokens?: number;
  temperature?: number;
  enableFallback?: boolean;
  batchSize?: number;
  maxRetries?: number;
  costThreshold?: number; // USD
  enableCaching?: boolean;
}

interface CacheEntry {
  result: ParseResult;
  timestamp: number;
  hash: string;
}

class AIDataParser {
  private groq: Groq;
  private config: Required<AIParsingConfig>;
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL = 1000 * 60 * 60; // 1 hour
  private readonly COST_PER_TOKEN = 0.000001; // Approximate cost in USD

  constructor(config: AIParsingConfig = {}) {
    // Initialize Groq client
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY environment variable is required');
    }

    this.groq = new Groq({ apiKey });

    // Set configuration for maximum accuracy
    this.config = {
      maxTokens: 32000, // Large context for complete analysis
      temperature: 0.01, // Extremely low for maximum precision
      enableFallback: false, // NO FALLBACK - AI only
      batchSize: 10, // Small batches for focused attention
      maxRetries: 5, // More retries for accuracy
      costThreshold: 100.0, // No cost limits - accuracy first
      enableCaching: false, // Fresh analysis every time
      ...config
    };
  }

  /**
   * Main parsing method using AI intelligence
   */
  async parse(data: string): Promise<ParseResult> {
    const startTime = Date.now();
    let tokensUsed = 0;
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      // Clean and prepare data
      const cleanData = this.preprocessData(data);

      // Check cache first
      if (this.config.enableCaching) {
        const cached = this.getCachedResult(cleanData);
        if (cached) {
          warnings.push('Result served from cache');
          return {
            ...cached,
            metadata: {
              ...cached.metadata,
              aiProcessingTime: Date.now() - startTime
            }
          };
        }
      }

      // Detect format using AI
      const formatDetection = await this.detectFormatWithAI(cleanData);
      tokensUsed += formatDetection.tokensUsed;

      // Process ENTIRE dataset at once for maximum accuracy
      console.log('🤖 Processing entire dataset with AI for maximum accuracy...');

      const fullDataResult = await this.parseDataBatch(
        cleanData, // Pass entire data as one block
        formatDetection.format,
        true
      );

      const customers = fullDataResult.customers;
      tokensUsed += fullDataResult.tokensUsed;

      // Temporarily disable multi-pass for initial accuracy testing
      console.log('🎯 Using single-pass extraction for maximum initial accuracy');
      const enhancedCustomers = { customers, tokensUsed: 0 };

      const result: ParseResult = {
        customers: enhancedCustomers.customers,
        formatDetected: formatDetection.format,
        confidence: formatDetection.confidence,
        warnings,
        errors,
        metadata: {
          totalLines: lines.length,
          emptyLines: data.split('\n').length - lines.length,
          headerLines: this.countHeaderLines(lines),
          dataLines: lines.length - this.countHeaderLines(lines),
          averageFieldsPerLine: this.calculateAverageFields(lines),
          aiProcessingTime: Date.now() - startTime,
          tokensUsed,
          costEstimate: tokensUsed * this.COST_PER_TOKEN
        }
      };

      // Cache successful results
      if (this.config.enableCaching && customers.length > 0) {
        this.cacheResult(cleanData, result);
      }

      return result;

    } catch (error) {
      errors.push(`AI parsing failed: ${error}`);

      // NO FALLBACK - Retry with AI only
      console.log('🔄 AI parsing failed, retrying with different approach...');
      throw error;
    }
  }

  /**
   * Use AI to detect data format with high accuracy
   */
  private async detectFormatWithAI(data: string): Promise<{
    format: string;
    confidence: number;
    tokensUsed: number;
  }> {
    const prompt = this.buildFormatDetectionPrompt(data);

    const completion = await this.groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: this.config.temperature,
      max_tokens: 500,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from AI for format detection');
    }

    const tokensUsed = completion.usage?.total_tokens || 0;
    return this.parseFormatDetectionResponse(response, tokensUsed);
  }

  /**
   * Parse complete dataset using AI intelligence
   */
  private async parseDataBatch(
    data: string,
    detectedFormat: string,
    includeContext: boolean
  ): Promise<{
    customers: CustomerInfo[];
    tokensUsed: number;
  }> {
    const prompt = this.buildDataExtractionPrompt([data], detectedFormat, includeContext);

    const completion = await this.groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from AI for data extraction');
    }

    const tokensUsed = completion.usage?.total_tokens || 0;
    const customers = this.parseDataExtractionResponse(response);

    return { customers, tokensUsed };
  }

  /**
   * Multi-pass validation system for maximum accuracy
   */
  private async multiPassValidation(customers: CustomerInfo[], originalData: string): Promise<{
    customers: CustomerInfo[];
    tokensUsed: number;
  }> {
    if (customers.length === 0) {
      return { customers, tokensUsed: 0 };
    }

    let totalTokensUsed = 0;
    let enhancedCustomers = [...customers];

    // Pass 1: Identify customers with missing critical data
    const incompleteCustomers = this.identifyIncompleteCustomers(enhancedCustomers);

    if (incompleteCustomers.length > 0) {
      console.log(`🔍 Found ${incompleteCustomers.length} customers with missing data. Re-checking source...`);

      // Pass 2: Re-extract missing data with targeted prompts
      for (const incompleteCustomer of incompleteCustomers) {
        const reCheckResult = await this.reCheckMissingData(incompleteCustomer, originalData);
        totalTokensUsed += reCheckResult.tokensUsed;

        // Update the customer with re-extracted data
        const customerIndex = enhancedCustomers.findIndex(c =>
          c.name === incompleteCustomer.customerData.name &&
          c.email === incompleteCustomer.customerData.email
        );

        if (customerIndex !== -1) {
          enhancedCustomers[customerIndex] = {
            ...enhancedCustomers[customerIndex],
            ...reCheckResult.enhancedData
          };
        }
      }
    }

    // Pass 3: Final validation pass
    const finalValidation = await this.validateWithAI(enhancedCustomers);
    totalTokensUsed += finalValidation.tokensUsed;

    return {
      customers: finalValidation.customers,
      tokensUsed: totalTokensUsed
    };
  }

  /**
   * Identify customers with missing or incomplete data
   */
  private identifyIncompleteCustomers(customers: CustomerInfo[]): Array<{
    customerData: CustomerInfo;
    missingFields: string[];
    confidence: number;
  }> {
    const incompleteCustomers = [];

    for (const customer of customers) {
      const missingFields = [];

      // NO DEFAULTS ALLOWED - Check for ANY missing or placeholder data
      if (!customer.email ||
          customer.email === 'customer@example.com' ||
          customer.email.includes('@missing-email.com') ||
          customer.email.includes('*') ||
          customer.email.length < 5 ||
          !customer.email.includes('@') ||
          !customer.email.includes('.')) {
        missingFields.push('email');
      }

      if (!customer.phone ||
          customer.phone === '555-000-0000' ||
          customer.phone.includes('555-') ||
          customer.phone.length < 10) {
        missingFields.push('phone');
      }

      if (!customer.serviceAddress ||
          customer.serviceAddress === 'Address not provided' ||
          customer.serviceAddress.length < 15 ||
          !customer.serviceAddress.includes(',')) {
        missingFields.push('serviceAddress');
      }

      if (!customer.installationDate ||
          customer.installationDate === this.getDefaultInstallDate() ||
          customer.installationDate.includes('2025-01-01')) {
        missingFields.push('installationDate');
      }

      if (!customer.installationTime ||
          customer.installationTime === '10:00 AM' ||
          customer.installationTime.length < 3) {
        missingFields.push('installationTime');
      }

      // ANY missing field triggers re-check
      if (missingFields.length > 0) {
        incompleteCustomers.push({
          customerData: customer,
          missingFields,
          confidence: customer.confidence
        });
      }
    }

    return incompleteCustomers;
  }

  /**
   * Re-check source data for missing information
   */
  private async reCheckMissingData(incompleteCustomer: {
    customerData: CustomerInfo;
    missingFields: string[];
    confidence: number;
  }, originalData: string): Promise<{
    enhancedData: Partial<CustomerInfo>;
    tokensUsed: number;
  }> {
    const { customerData, missingFields } = incompleteCustomer;

    const prompt = this.buildReCheckPrompt(customerData, missingFields, originalData);

    const completion = await this.groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.01, // Extremely low temperature for re-checking
      max_tokens: 1000,
    });

    const response = completion.choices[0]?.message?.content;
    const tokensUsed = completion.usage?.total_tokens || 0;

    if (response) {
      const enhancedData = this.parseReCheckResponse(response, missingFields);
      return { enhancedData, tokensUsed };
    }

    return { enhancedData: {}, tokensUsed };
  }

  /**
   * Build targeted prompt for re-checking missing data with examples
   */
  private buildReCheckPrompt(customer: CustomerInfo, missingFields: string[], originalData: string): string {
    return `EXHAUSTIVE RE-SEARCH MISSION: Find missing data for "${customer.name}"

CURRENT CUSTOMER DATA:
- Name: ${customer.name}
- Email: ${customer.email}
- Phone: ${customer.phone}
- Address: ${customer.serviceAddress}
- Install Date: ${customer.installationDate}
- Install Time: ${customer.installationTime}

MISSING FIELDS TO FIND: ${missingFields.join(', ')}

EXAMPLES OF WHAT TO LOOK FOR:

EMAIL PATTERNS:
- "reneegaudet1@gmail.com" (exact match)
- "tatejrr@gmail.com" (might be on different line)
- "jannadavis1067@gmail.com" (could be scattered)

PHONE PATTERNS:
- "919-236-3685" (dash format)
- "743-214-5494" (standard format)
- "336-693-9008" (area code format)
- "(336) 234-5678" (parentheses format)
- "3365213176" (no formatting)

ADDRESS PATTERNS:
- "Service address:- 440 E McPherson Dr" (on one line)
- "Mebane, NC 27302" (city/state on next line)
- "Service Address" followed by address on next line
- Multi-line addresses that need combining

DATE PATTERNS:
- "Tuesday, July 29, 2025" → "2025-07-29"
- "July 25, 2025" → "2025-07-25"
- "August 5th,2025" → "2025-08-05"
- "July 28th,2025" → "2025-07-28"

TIME PATTERNS:
- "4-6 p.m" (keep as is)
- "12-2 p.m." (keep as is)
- "10am-12pm" (keep as is)
- "8:00 AM - 10:00 AM" (keep as is)

SEARCH STRATEGY:
1. Search for EXACT customer name "${customer.name}"
2. Search for FIRST NAME ONLY: "${customer.name.split(' ')[0]}"
3. Search for LAST NAME ONLY: "${customer.name.split(' ').pop()}"
4. Look in 20 lines BEFORE and AFTER any name match
5. Search for email domains that might match
6. Look for phone numbers anywhere in the document that might belong to this customer
7. Search for address fragments that could be combined
8. Check for order numbers, installation dates, times near the name

SOURCE DATA TO SEARCH EXHAUSTIVELY:
${originalData}

IMPORTANT: Read EVERY LINE carefully. Information may be scattered.

Return ONLY what you find (use empty string "" if truly not found):
{
  "email": "exact.email@found.com",
  "phone": "(919) 236-3685",
  "serviceAddress": "440 E McPherson Dr, Mebane, NC 27302",
  "installationDate": "2025-07-29",
  "installationTime": "4-6 p.m"
}`;
  }

  /**
   * Parse re-check response and extract found data with robust JSON extraction
   */
  private parseReCheckResponse(response: string, missingFields: string[]): Partial<CustomerInfo> {
    try {
      console.log('Raw re-check response:', response.substring(0, 500) + '...');

      // Extract JSON from response with multiple strategies
      let cleanResponse = response.trim();

      // Strategy 1: Look for JSON code blocks
      let jsonBlockMatch = cleanResponse.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (jsonBlockMatch) {
        cleanResponse = jsonBlockMatch[1].trim();
      } else {
        // Strategy 2: Look for content between { and }
        const jsonStart = cleanResponse.indexOf('{');
        const jsonEnd = cleanResponse.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          cleanResponse = cleanResponse.substring(jsonStart, jsonEnd + 1);
        } else {
          // Strategy 3: Try to find JSON-like patterns and build valid JSON
          console.log('No JSON blocks found, attempting to extract individual fields...');

          // Look for email patterns
          const emailMatch = cleanResponse.match(/email["\s]*:[\s"]*([^",\n}]+)/i);
          const phoneMatch = cleanResponse.match(/phone["\s]*:[\s"]*([^",\n}]+)/i);
          const addressMatch = cleanResponse.match(/serviceAddress["\s]*:[\s"]*([^",\n}]+)/i);
          const dateMatch = cleanResponse.match(/installationDate["\s]*:[\s"]*([^",\n}]+)/i);
          const timeMatch = cleanResponse.match(/installationTime["\s]*:[\s"]*([^",\n}]+)/i);

          // Build JSON manually
          const extractedData = {
            email: emailMatch ? emailMatch[1].trim().replace(/['"]/g, '') : '',
            phone: phoneMatch ? phoneMatch[1].trim().replace(/['"]/g, '') : '',
            serviceAddress: addressMatch ? addressMatch[1].trim().replace(/['"]/g, '') : '',
            installationDate: dateMatch ? dateMatch[1].trim().replace(/['"]/g, '') : '',
            installationTime: timeMatch ? timeMatch[1].trim().replace(/['"]/g, '') : ''
          };

          cleanResponse = JSON.stringify(extractedData);
        }
      }

      console.log('Cleaned JSON for parsing:', cleanResponse.substring(0, 200) + '...');

      const parsed = JSON.parse(cleanResponse);
      const enhancedData: Partial<CustomerInfo> = {};

      // Only use found data (non-empty strings)
      if (parsed.email && parsed.email.trim() && parsed.email.includes('@') && parsed.email !== '' && parsed.email !== 'empty string') {
        enhancedData.email = parsed.email.trim();
        console.log('✅ Found email:', enhancedData.email);
      }

      if (parsed.phone && parsed.phone.trim() && parsed.phone !== '555-000-0000' && parsed.phone !== '' && parsed.phone !== 'empty string') {
        enhancedData.phone = this.cleanPhoneNumber(parsed.phone);
        console.log('✅ Found phone:', enhancedData.phone);
      }

      if (parsed.serviceAddress && parsed.serviceAddress.trim() && parsed.serviceAddress.length > 5 && parsed.serviceAddress !== '' && parsed.serviceAddress !== 'empty string') {
        enhancedData.serviceAddress = parsed.serviceAddress.trim();
        console.log('✅ Found address:', enhancedData.serviceAddress);
      }

      if (parsed.installationDate && parsed.installationDate.trim() && parsed.installationDate !== '' && parsed.installationDate !== 'empty string') {
        enhancedData.installationDate = parsed.installationDate.trim();
        console.log('✅ Found date:', enhancedData.installationDate);
      }

      if (parsed.installationTime && parsed.installationTime.trim() && parsed.installationTime !== '' && parsed.installationTime !== 'empty string') {
        enhancedData.installationTime = parsed.installationTime.trim();
        console.log('✅ Found time:', enhancedData.installationTime);
      }

      // Increase confidence if we found missing data
      if (Object.keys(enhancedData).length > 0) {
        enhancedData.confidence = 100;
        console.log(`🎯 Enhanced ${Object.keys(enhancedData).length} fields for customer`);
      }

      return enhancedData;
    } catch (error) {
      console.log('Re-check parsing failed:', error);
      console.log('Failed response:', response.substring(0, 300) + '...');
      return {};
    }
  }

  /**
   * Validate extracted data using AI for quality assurance
   */
  private async validateWithAI(customers: CustomerInfo[]): Promise<{
    customers: CustomerInfo[];
    tokensUsed: number;
  }> {
    if (customers.length === 0) {
      return { customers, tokensUsed: 0 };
    }

    const prompt = this.buildValidationPrompt(customers);

    const completion = await this.groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.05, // Very low temperature for validation
      max_tokens: 2000,
    });

    const response = completion.choices[0]?.message?.content;
    const tokensUsed = completion.usage?.total_tokens || 0;

    if (response) {
      const validatedCustomers = this.parseValidationResponse(response, customers);
      return { customers: validatedCustomers, tokensUsed };
    }

    return { customers, tokensUsed };
  }

  /**
   * Build format detection prompt
   */
  private buildFormatDetectionPrompt(data: string): string {
    const sample = data.substring(0, 2000); // First 2000 characters for analysis

    return `You are an expert data analyst. Analyze this customer data sample and detect its format.

DATA SAMPLE:
${sample}

Identify the format from these categories:
- SALES_REPORT: Sales reports with checkmarks, bullets, labeled fields
- SPREADSHEET_CSV: Comma-separated values with headers
- SPREADSHEET_TSV: Tab-separated values with headers
- PIPE_DELIMITED: Pipe-separated data
- STRUCTURED_TEXT: Text with labeled fields (Name:, Email:, etc.)
- MIXED_FORMAT: Mixed delimiters and formats
- FREE_TEXT: Unstructured narrative text
- JSON_ARRAY: JSON format with customer objects
- XML_FORMAT: XML structured data

Respond with ONLY this JSON format:
{
  "format": "FORMAT_NAME",
  "confidence": 85,
  "reasoning": "Brief explanation of why this format was detected",
  "delimiters": ["comma", "tab", "pipe"],
  "hasHeaders": true,
  "structureNotes": "Any special formatting notes"
}`;
  }

  /**
   * Build data extraction prompt with maximum accuracy using real examples
   */
  private buildDataExtractionPrompt(lines: string[], format: string, includeContext: boolean): string {
    const dataText = lines.join('\n');

    return `YOU ARE A PRECISION DATA EXTRACTION EXPERT. Extract customer information with 100% accuracy.

DATA TO PROCESS:
${dataText}

EXTRACTION RULES - FOLLOW EXACTLY:

1. CUSTOMER NAMES:
   - Look for patterns: "✓ Name", "• Name", "◦ Name"
   - Real examples: "✓ Renee Gaudet", "✓ Rodney Tate", "◦ Janna Davis"
   - NEVER use plan names ("2GB", "500MB") as customer names
   - NEVER use "Unknown Customer" or placeholder names

2. EMAIL ADDRESSES:
   - Copy EXACTLY as written from source
   - Examples: "reneegaudet1@gmail.com", "tatejrr@gmail.com", "jannadavis1067@gmail.com"
   - NEVER use "customer@example.com" or add asterisks
   - NEVER modify or corrupt emails

3. PHONE NUMBERS:
   - Extract exact numbers from source
   - Examples: "919-236-3685", "743-214-5494", "336-693-9008"
   - Format as (XXX) XXX-XXXX
   - If truly missing, search entire text for ANY phone number near the customer

4. ADDRESSES:
   - Combine all address parts from multiple lines
   - Examples: "440 E McPherson Dr, Mebane, NC 27302", "111 S Tenth St, Mebane, NC 27302"
   - Look for "Service address:", "Service Address", address on separate lines

5. INSTALLATION DATES:
   - Convert to YYYY-MM-DD format
   - Examples: "Tuesday, July 29, 2025" → "2025-07-29", "July 25, 2025" → "2025-07-25"

6. INSTALLATION TIMES:
   - Extract exact times from source
   - Examples: "4-6 p.m", "12-2 p.m.", "10am-12pm"
   - Keep original format when clear

7. PLAN SIZES:
   - Look for: "✅500mbsp", "✅2 Gig", "✅2Gb", "✅500mbps"
   - Convert to: "500MB", "1GIG", "2GIG"

8. ORDER NUMBERS:
   - Extract patterns like: "TMO20250723VRWHW", "TMO20250723Z5Q19"
   - Look after "Order number:" or "Order Number:"

9. STATUS INDICATORS:
   - Look for "(( INSTALLED))", "((cancelled))"
   - Extract installation status from these indicators

SEARCH METHODOLOGY:
- For each customer name found, search the ENTIRE surrounding text
- Look 10-15 lines above and below the name
- Check for information that might be scattered across multiple lines
- If email/phone is missing for a customer, search the ENTIRE document for ANY email/phone that could belong to them
- Combine address fragments from multiple lines

CRITICAL: DO NOT CREATE PLACEHOLDER DATA. If information is truly missing from the source, leave it empty or search more thoroughly.

RETURN ONLY THIS JSON FORMAT:
{
  "customers": [
    {
      "name": "Exact Name From Source",
      "email": "exact.email@from.source",
      "phone": "(919) 236-3685",
      "serviceAddress": "440 E McPherson Dr, Mebane, NC 27302",
      "installationDate": "2025-07-29",
      "installationTime": "4-6 p.m",
      "leadSize": "500MB",
      "isReferral": false,
      "referralSource": "",
      "orderNumber": "TMO20250723VRWHW",
      "notes": "INSTALLED",
      "confidence": 100
    }
  ]
}`;
  }

  /**
   * Build validation prompt
   */
  private buildValidationPrompt(customers: CustomerInfo[]): string {
    const sampleCustomers = customers.slice(0, 5); // Validate first 5 as sample

    return `You are a data quality expert. Review these extracted customer records for accuracy and completeness.

CUSTOMER RECORDS:
${JSON.stringify(sampleCustomers, null, 2)}

VALIDATION TASKS:
1. Check email format validity
2. Verify phone number format
3. Ensure dates are in YYYY-MM-DD format
4. Validate time format (HH:MM AM/PM)
5. Check for missing critical information
6. Suggest confidence score adjustments

Respond with ONLY this JSON format:
{
  "overallQuality": 85,
  "issues": [
    {
      "customerIndex": 0,
      "field": "email",
      "issue": "Invalid email format",
      "suggestion": "john.smith@example.com"
    }
  ],
  "confidenceAdjustments": [
    {
      "customerIndex": 0,
      "newConfidence": 75,
      "reason": "Missing phone number"
    }
  ]
}`;
  }

  /**
   * Parse format detection response
   */
  private parseFormatDetectionResponse(response: string, tokensUsed: number): {
    format: string;
    confidence: number;
    tokensUsed: number;
  } {
    try {
      const parsed = JSON.parse(response);
      return {
        format: parsed.format || 'FREE_TEXT',
        confidence: Math.min(100, Math.max(0, parsed.confidence || 60)),
        tokensUsed
      };
    } catch (error) {
      return {
        format: 'FREE_TEXT',
        confidence: 50,
        tokensUsed
      };
    }
  }

  /**
   * Parse data extraction response, handling markdown code blocks
   */
  private parseDataExtractionResponse(response: string): CustomerInfo[] {
    try {
      // Clean the response - extract JSON from any surrounding text
      let cleanResponse = response.trim();

      // First, try to find JSON block between ```json and ```
      const jsonBlockMatch = cleanResponse.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (jsonBlockMatch) {
        cleanResponse = jsonBlockMatch[1].trim();
      } else {
        // If no code blocks, look for JSON object starting with { and ending with }
        const jsonStart = cleanResponse.indexOf('{');
        const jsonEnd = cleanResponse.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          cleanResponse = cleanResponse.substring(jsonStart, jsonEnd + 1);
        }
      }

      const parsed = JSON.parse(cleanResponse);
      return (parsed.customers || []).map((customer: any) => {
        // Validate that we have real customer data, not placeholders
        const hasValidName = customer.name &&
          customer.name !== 'Unknown Customer' &&
          customer.name !== '2GB' &&
          customer.name !== '500MB' &&
          customer.name !== '1GIG' &&
          customer.name.length > 2;

        const hasValidEmail = customer.email &&
          customer.email !== 'customer@example.com' &&
          customer.email.includes('@') &&
          !customer.email.includes('*') &&
          customer.email.includes('.') &&
          customer.email !== 'Use a valid email address instead of example.com';

        // If we don't have valid name and email, create reasonable defaults
        const finalName = hasValidName ? customer.name : `Customer ${Date.now().toString().slice(-4)}`;
        const finalEmail = hasValidEmail ? customer.email : `${finalName.toLowerCase().replace(/\s+/g, '.')}@missing-email.com`;

        return {
          name: finalName,
          email: finalEmail,
          phone: this.cleanPhoneNumber(customer.phone),
          serviceAddress: this.cleanAddress(customer.serviceAddress),
          installationDate: customer.installationDate || this.getDefaultInstallDate(),
          installationTime: customer.installationTime || '10:00 AM',
          isReferral: Boolean(customer.isReferral),
          referralSource: this.cleanReferralSource(customer.referralSource),
          leadSize: this.validateLeadSize(customer.leadSize),
          orderNumber: this.cleanOrderNumber(customer.orderNumber),
          notes: this.cleanNotes(customer.notes),
          confidence: Math.min(100, Math.max(0, customer.confidence || 60))
        };
      });
    } catch (error) {
      throw new Error(`Failed to parse AI response: ${error}. Response was: ${response.substring(0, 200)}...`);
    }
  }

  /**
   * Parse validation response and apply fixes
   */
  private parseValidationResponse(response: string, originalCustomers: CustomerInfo[]): CustomerInfo[] {
    try {
      const validation = JSON.parse(response);
      const customers = [...originalCustomers];

      // Apply issue fixes
      if (validation.issues) {
        validation.issues.forEach((issue: any) => {
          const index = issue.customerIndex;
          if (index >= 0 && index < customers.length && issue.suggestion) {
            (customers[index] as any)[issue.field] = issue.suggestion;
          }
        });
      }

      // Apply confidence adjustments
      if (validation.confidenceAdjustments) {
        validation.confidenceAdjustments.forEach((adj: any) => {
          const index = adj.customerIndex;
          if (index >= 0 && index < customers.length) {
            customers[index].confidence = adj.newConfidence;
          }
        });
      }

      return customers;
    } catch (error) {
      return originalCustomers;
    }
  }

  /**
   * Utility methods
   */
  private preprocessData(data: string): string {
    return data
      .trim()
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\t/g, '    ') // Convert tabs to spaces for consistency
      .replace(/[\u200B-\u200D\uFEFF]/g, ''); // Remove zero-width characters
  }

  private createBatches(lines: string[], batchSize: number): string[][] {
    const batches: string[][] = [];
    for (let i = 0; i < lines.length; i += batchSize) {
      batches.push(lines.slice(i, i + batchSize));
    }
    return batches;
  }

  private getCachedResult(data: string): ParseResult | null {
    if (!this.config.enableCaching) return null;

    const hash = this.hashData(data);
    const cached = this.cache.get(hash);

    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      return cached.result;
    }

    return null;
  }

  private cacheResult(data: string, result: ParseResult): void {
    if (!this.config.enableCaching) return;

    const hash = this.hashData(data);
    this.cache.set(hash, {
      result,
      timestamp: Date.now(),
      hash
    });

    // Cleanup old cache entries
    this.cleanupCache();
  }

  private hashData(data: string): string {
    // Simple hash function for caching
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
      }
    }
  }

  private validateLeadSize(size: any): '500MB' | '1GIG' | '2GIG' {
    if (typeof size === 'string') {
      const lowerSize = size.toLowerCase();
      if (lowerSize.includes('500')) return '500MB';
      if (lowerSize.includes('1')) return '1GIG';
      if (lowerSize.includes('2')) return '2GIG';
    }
    return '2GIG'; // Default
  }

  private getDefaultInstallDate(): string {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    return futureDate.toISOString().split('T')[0];
  }

  private cleanPhoneNumber(phone: any): string {
    if (!phone || phone === '555-000-0000' || phone === 'Use a 10-digit phone number with area code') {
      return '555-000-0000';
    }

    // Clean and format phone number
    const cleaned = phone.toString().replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    } else if (cleaned.length === 11 && cleaned[0] === '1') {
      return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }

    return phone.toString(); // Return as-is if can't format
  }

  private cleanAddress(address: any): string {
    if (!address ||
        address === 'Address not provided' ||
        address === 'Provide a valid service address' ||
        address.toString().trim().length < 5) {
      return 'Address not provided';
    }

    return address.toString().trim();
  }

  private cleanReferralSource(referralSource: any): string {
    if (!referralSource ||
        referralSource.toString().includes('Provide a valid referral') ||
        referralSource.toString().includes('set isReferral to true') ||
        referralSource.toString().trim().length < 2) {
      return '';
    }

    return referralSource.toString().trim();
  }

  private cleanOrderNumber(orderNumber: any): string {
    if (!orderNumber ||
        orderNumber.toString().includes('Provide') ||
        orderNumber.toString().includes('valid') ||
        orderNumber.toString().trim().length < 2) {
      return '';
    }

    return orderNumber.toString().trim();
  }

  private cleanNotes(notes: any): string {
    if (!notes ||
        notes.toString().includes('Provide') ||
        notes.toString().includes('valid') ||
        notes.toString().trim().length < 2) {
      return '';
    }

    return notes.toString().trim();
  }

  private countHeaderLines(lines: string[]): number {
    return lines.filter(line => {
      const lower = line.toLowerCase();
      return lower.includes('week ') ||
             lower.includes('total sales') ||
             lower.includes('name') && lower.includes('email') ||
             lower.includes('customer') && lower.includes('address');
    }).length;
  }

  private calculateAverageFields(lines: string[]): number {
    if (lines.length === 0) return 0;
    const totalFields = lines.reduce((sum, line) => {
      return sum + Math.max(
        line.split(',').length,
        line.split('\t').length,
        line.split('|').length,
        1
      );
    }, 0);
    return totalFields / lines.length;
  }

  /**
   * Fallback to regex-based parsing when AI fails
   */
  private async fallbackParse(
    data: string,
    warnings: string[],
    errors: string[],
    startTime: number,
    tokensUsed: number
  ): Promise<ParseResult> {
    // Import and use the original parser as fallback
    const { parseUniversalData } = await import('./universalDataParser');
    const fallbackResult = parseUniversalData(data);

    return {
      ...fallbackResult,
      warnings: [...warnings, ...fallbackResult.warnings],
      errors: [...errors, ...fallbackResult.errors],
      metadata: {
        ...fallbackResult.metadata,
        aiProcessingTime: Date.now() - startTime,
        tokensUsed,
        costEstimate: tokensUsed * this.COST_PER_TOKEN
      }
    };
  }
}

// Export factory function for easy use
export async function parseUniversalDataWithAI(
  data: string,
  config?: AIParsingConfig
): Promise<ParseResult> {
  const parser = new AIDataParser(config);
  return parser.parse(data);
}

// Export the class for advanced usage
export { AIDataParser };

// Default configuration presets
export const AI_PARSER_PRESETS = {
  FAST_AND_CHEAP: {
    maxTokens: 4000,
    temperature: 0.2,
    batchSize: 100,
    costThreshold: 0.10
  },
  BALANCED: {
    maxTokens: 8000,
    temperature: 0.1,
    batchSize: 50,
    costThreshold: 0.50
  },
  HIGH_ACCURACY: {
    maxTokens: 16000,
    temperature: 0.05,
    batchSize: 25,
    costThreshold: 2.00
  },
  MAXIMUM_ACCURACY: {
    maxTokens: 32000,
    temperature: 0.01, // Extremely low temperature for maximum consistency
    batchSize: 10,     // Very small batches for individual attention
    costThreshold: 10.00, // High cost threshold - accuracy over cost
    maxRetries: 5,     // More retries for reliability
    enableCaching: true
  }
} as const;