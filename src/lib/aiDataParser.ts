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

    // Set default configuration
    this.config = {
      maxTokens: 8000,
      temperature: 0.1, // Low temperature for consistent parsing
      enableFallback: true,
      batchSize: 50, // Lines per AI request
      maxRetries: 3,
      costThreshold: 1.0, // Max $1 per parsing request
      enableCaching: true,
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

      // Parse data using AI in batches if necessary
      const lines = cleanData.split('\n').filter(line => line.trim());
      const customers: CustomerInfo[] = [];

      // Process in batches to manage costs and token limits
      const batches = this.createBatches(lines, this.config.batchSize);

      for (let i = 0; i < batches.length; i++) {
        try {
          const batchResult = await this.parseDataBatch(
            batches[i],
            formatDetection.format,
            i === 0 // First batch gets context about the overall format
          );

          customers.push(...batchResult.customers);
          tokensUsed += batchResult.tokensUsed;

          // Check cost threshold
          const currentCost = tokensUsed * this.COST_PER_TOKEN;
          if (currentCost > this.config.costThreshold) {
            warnings.push(`Cost threshold exceeded ($${currentCost.toFixed(4)}). Processing stopped.`);
            break;
          }

          // Rate limiting between batches
          if (i < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error) {
          errors.push(`Batch ${i + 1} failed: ${error}`);
          if (!this.config.enableFallback) {
            throw error;
          }
        }
      }

      // Validate and enhance results
      const validatedCustomers = await this.validateWithAI(customers);
      tokensUsed += validatedCustomers.tokensUsed;

      const result: ParseResult = {
        customers: validatedCustomers.customers,
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

      // Fallback to regex-based parser if enabled
      if (this.config.enableFallback) {
        warnings.push('AI parsing failed, falling back to pattern matching');
        return this.fallbackParse(data, warnings, errors, startTime, tokensUsed);
      }

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
   * Parse data batch using AI intelligence
   */
  private async parseDataBatch(
    lines: string[],
    detectedFormat: string,
    includeContext: boolean
  ): Promise<{
    customers: CustomerInfo[];
    tokensUsed: number;
  }> {
    const prompt = this.buildDataExtractionPrompt(lines, detectedFormat, includeContext);

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
   * Build data extraction prompt with maximum accuracy for sales reports
   */
  private buildDataExtractionPrompt(lines: string[], format: string, includeContext: boolean): string {
    const dataText = lines.join('\n');

    const contextInfo = includeContext ? `
FORMAT DETECTED: ${format}
This data follows the ${format} format pattern.` : '';

    return `You are extracting customer data. Copy the exact information from the text below.

${contextInfo}

From this text, extract:
${dataText}

Copy exactly what you see:
- name: copy the customer name after ✓
- email: copy the email address exactly (example: reneegaudet1@gmail.com)
- phone: copy phone number if present, otherwise "555-000-0000"
- serviceAddress: combine address lines
- installationDate: convert date to YYYY-MM-DD format
- installationTime: convert time to HH:MM AM/PM format
- leadSize: convert plan to "500MB", "1GIG", or "2GIG"
- isReferral: false
- referralSource: ""
- orderNumber: ""
- notes: ""
- confidence: 95

Return JSON only:
{
  "customers": [
    {
      "name": "Customer Name",
      "email": "actual.email@domain.com",
      "phone": "555-000-0000",
      "serviceAddress": "Full Address",
      "installationDate": "2025-07-29",
      "installationTime": "4:00 PM",
      "leadSize": "2GIG",
      "isReferral": false,
      "referralSource": "",
      "orderNumber": "",
      "notes": "",
      "confidence": 95
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
      // Clean the response - remove markdown code blocks if present
      let cleanResponse = response.trim();

      // Remove markdown code blocks (```json or ``` at start/end)
      if (cleanResponse.startsWith('```')) {
        const lines = cleanResponse.split('\n');
        lines.shift(); // Remove first ``` line
        if (lines[lines.length - 1].trim() === '```') {
          lines.pop(); // Remove last ``` line
        }
        cleanResponse = lines.join('\n').trim();
      }

      // Also handle just ``` at the end
      if (cleanResponse.endsWith('```')) {
        cleanResponse = cleanResponse.slice(0, -3).trim();
      }

      const parsed = JSON.parse(cleanResponse);
      return (parsed.customers || []).map((customer: any) => ({
        name: customer.name || 'Unknown Customer',
        email: customer.email || 'customer@example.com',
        phone: customer.phone || '555-000-0000',
        serviceAddress: customer.serviceAddress || 'Address not provided',
        installationDate: customer.installationDate || this.getDefaultInstallDate(),
        installationTime: customer.installationTime || '10:00 AM',
        isReferral: Boolean(customer.isReferral),
        referralSource: customer.referralSource || '',
        leadSize: this.validateLeadSize(customer.leadSize),
        orderNumber: customer.orderNumber || '',
        notes: customer.notes || '',
        confidence: Math.min(100, Math.max(0, customer.confidence || 60))
      }));
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