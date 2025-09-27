/**
 * Universal Data Parser - Intelligent bulk data parsing system
 * Handles ANY format of customer data with advanced pattern recognition
 */

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
  confidence: number; // Confidence score for the parsing accuracy (0-100)
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
  };
}

// Format detection patterns
const FORMAT_PATTERNS = {
  SALES_REPORT: {
    indicators: ['Week ', 'Total Sales:', 'Order number:', 'Service address:', '✓', '◦', '•'],
    confidence: 95,
    description: 'Sales report with checkmarks and structured fields'
  },
  SPREADSHEET_TSV: {
    indicators: ['\t', 'Rep ID', 'Street Address', 'Installation Date', 'Fiber Plan'],
    confidence: 90,
    description: 'Tab-separated spreadsheet data'
  },
  SPREADSHEET_CSV: {
    indicators: [',', 'Name', 'Email', 'Phone', 'Address'],
    confidence: 85,
    description: 'Comma-separated spreadsheet data'
  },
  PIPE_DELIMITED: {
    indicators: ['|'],
    confidence: 80,
    description: 'Pipe-delimited data'
  },
  STRUCTURED_TEXT: {
    indicators: [':', 'Customer:', 'Name:', 'Email:', 'Phone:', 'Address:'],
    confidence: 85,
    description: 'Structured text with labeled fields'
  },
  FREE_TEXT: {
    indicators: [],
    confidence: 60,
    description: 'Unstructured free text'
  },
  MIXED_FORMAT: {
    indicators: ['@', /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/, /\b\d+\s+[A-Za-z]/],
    confidence: 70,
    description: 'Mixed format with various delimiters'
  }
};

// Field pattern definitions
const FIELD_PATTERNS = {
  EMAIL: {
    patterns: [
      /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
    ],
    weight: 100,
    required: true
  },
  PHONE: {
    patterns: [
      /(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/g,
      /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
      /\(\d{3}\)\s*\d{3}[-.\s]?\d{4}/g,
      /\d{10}/g
    ],
    weight: 95,
    required: true
  },
  NAME: {
    patterns: [
      /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, // First Last
      /\b[A-Z][a-z]+\s+[A-Z]\.\s+[A-Z][a-z]+\b/g, // First M. Last
      /\b[A-Z][a-z]+\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, // First Middle Last
    ],
    weight: 85,
    required: true
  },
  ADDRESS: {
    patterns: [
      /\b\d+\s+[A-Za-z\s]+(St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Blvd|Boulevard|Ln|Lane|Ct|Court|Pl|Place|Way|Circle|Cir)\b/gi,
      /\b\d+\s+[A-Za-z\s]+,\s*[A-Za-z\s]+,\s*[A-Z]{2}\s*\d{5}/g,
      /Service\s+[Aa]ddress:?\s*(.+)/g
    ],
    weight: 80,
    required: false
  },
  DATE: {
    patterns: [
      /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi,
      /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\b/gi,
      /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi,
      /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
      /\b\d{4}-\d{2}-\d{2}\b/g,
      /Installation\s*[Dd]ate:?\s*(.+)/gi
    ],
    weight: 75,
    required: false
  },
  TIME: {
    patterns: [
      /\b\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)\b/g,
      /\b\d{1,2}\s*(?:AM|PM|am|pm)\b/g,
      /\b\d{1,2}[-\s]*\d{1,2}\s*(?:PM|AM|pm|am)\b/g,
      /Installation\s*[Tt]ime:?\s*(.+)/gi
    ],
    weight: 70,
    required: false
  },
  LEAD_SIZE: {
    patterns: [
      /\b500\s*MB(?:SP?)?\b/gi,
      /\b1\s*GIG\b/gi,
      /\b2\s*GIG\b/gi,
      /\b500\s*Mbps?\b/gi,
      /\b1000\s*Mbps?\b/gi,
      /\b2000\s*Mbps?\b/gi
    ],
    weight: 65,
    required: false
  },
  ORDER_NUMBER: {
    patterns: [
      /Order\s*(?:Number|#):?\s*([A-Z0-9\-]+)/gi,
      /\b[A-Z]{2,4}\d{4,8}\b/g,
      /\b\d{6,12}\b/g
    ],
    weight: 60,
    required: false
  }
};

// Smart delimiters detection
const DELIMITER_PATTERNS = [
  { char: '\t', name: 'tab', weight: 100 },
  { char: ',', name: 'comma', weight: 90 },
  { char: '|', name: 'pipe', weight: 85 },
  { char: ';', name: 'semicolon', weight: 80 },
  { char: /\s{2,}/, name: 'multiple_spaces', weight: 75 },
  { char: ':', name: 'colon', weight: 70 },
  { char: '-', name: 'dash', weight: 65 }
];

export class UniversalDataParser {
  private data: string;
  private lines: string[];
  private detectedFormat: string = '';
  private confidence: number = 0;
  private warnings: string[] = [];
  private errors: string[] = [];

  constructor(data: string) {
    this.data = data.trim();
    this.lines = this.data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  }

  /**
   * Main parsing method - analyzes and extracts customer data
   */
  public parse(): ParseResult {
    try {
      // Step 1: Detect format
      const formatResult = this.detectFormat();
      this.detectedFormat = formatResult.format;
      this.confidence = formatResult.confidence;

      // Step 2: Parse based on detected format
      let customers: CustomerInfo[] = [];

      switch (this.detectedFormat) {
        case 'SALES_REPORT':
          customers = this.parseSalesReport();
          break;
        case 'SPREADSHEET_TSV':
        case 'SPREADSHEET_CSV':
          customers = this.parseSpreadsheet();
          break;
        case 'PIPE_DELIMITED':
          customers = this.parsePipeDelimited();
          break;
        case 'STRUCTURED_TEXT':
          customers = this.parseStructuredText();
          break;
        case 'MIXED_FORMAT':
          customers = this.parseMixedFormat();
          break;
        default:
          customers = this.parseFreeText();
      }

      // Step 3: Validate and enhance data
      customers = this.validateAndEnhanceCustomers(customers);

      // Step 4: Generate metadata
      const metadata = this.generateMetadata();

      return {
        customers,
        formatDetected: this.detectedFormat,
        confidence: this.confidence,
        warnings: this.warnings,
        errors: this.errors,
        metadata
      };

    } catch (error) {
      this.errors.push(`Critical parsing error: ${error}`);
      return {
        customers: [],
        formatDetected: 'ERROR',
        confidence: 0,
        warnings: this.warnings,
        errors: this.errors,
        metadata: this.generateMetadata()
      };
    }
  }

  /**
   * Intelligent format detection using pattern analysis
   */
  private detectFormat(): { format: string, confidence: number } {
    const sampleSize = Math.min(10, this.lines.length);
    const sampleLines = this.lines.slice(0, sampleSize);
    const sampleText = sampleLines.join('\n');

    const scores: { [key: string]: number } = {};

    // Test each format pattern
    Object.entries(FORMAT_PATTERNS).forEach(([format, pattern]) => {
      let score = 0;
      let matches = 0;

      pattern.indicators.forEach(indicator => {
        if (typeof indicator === 'string') {
          // String indicator
          const count = (sampleText.match(new RegExp(indicator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length;
          if (count > 0) {
            matches++;
            score += count * 10;
          }
        } else if (indicator instanceof RegExp) {
          // Regex indicator
          const count = (sampleText.match(indicator) || []).length;
          if (count > 0) {
            matches++;
            score += count * 15;
          }
        }
      });

      // Bonus for multiple indicators
      if (matches > 1) {
        score *= 1.5;
      }

      scores[format] = score * (pattern.confidence / 100);
    });

    // Additional heuristics
    this.applyAdditionalHeuristics(scores, sampleText);

    // Find best match
    const bestFormat = Object.entries(scores).reduce((a, b) => scores[a[0]] > scores[b[0]] ? a : b);

    if (bestFormat[1] === 0) {
      return { format: 'FREE_TEXT', confidence: 60 };
    }

    return {
      format: bestFormat[0],
      confidence: Math.min(100, Math.max(60, bestFormat[1]))
    };
  }

  /**
   * Apply additional heuristics for format detection
   */
  private applyAdditionalHeuristics(scores: { [key: string]: number }, sampleText: string) {
    // Check for consistent delimiters
    const tabCount = (sampleText.match(/\t/g) || []).length;
    const commaCount = (sampleText.match(/,/g) || []).length;
    const pipeCount = (sampleText.match(/\|/g) || []).length;

    if (tabCount > commaCount && tabCount > pipeCount) {
      scores['SPREADSHEET_TSV'] += 20;
    } else if (commaCount > tabCount && commaCount > pipeCount) {
      scores['SPREADSHEET_CSV'] += 20;
    } else if (pipeCount > tabCount && pipeCount > commaCount) {
      scores['PIPE_DELIMITED'] += 20;
    }

    // Check for email density
    const emailMatches = (sampleText.match(FIELD_PATTERNS.EMAIL.patterns[0]) || []).length;
    if (emailMatches > this.lines.length * 0.3) {
      scores['SPREADSHEET_CSV'] += 15;
      scores['SPREADSHEET_TSV'] += 15;
    }

    // Check for phone number density
    const phoneMatches = (sampleText.match(FIELD_PATTERNS.PHONE.patterns[0]) || []).length;
    if (phoneMatches > this.lines.length * 0.3) {
      scores['SPREADSHEET_CSV'] += 15;
      scores['SPREADSHEET_TSV'] += 15;
    }

    // Check for checkmark patterns
    const checkmarkMatches = (sampleText.match(/[✓◦•]/g) || []).length;
    if (checkmarkMatches > 0) {
      scores['SALES_REPORT'] += 30;
    }
  }

  /**
   * Parse sales report format
   */
  private parseSalesReport(): CustomerInfo[] {
    const customers: CustomerInfo[] = [];
    let currentCustomer: Partial<CustomerInfo> = {};
    let collectingCustomerData = false;

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];

      // Skip header lines
      if (this.isHeaderLine(line)) continue;

      // Look for customer name patterns
      if (line.match(/^[✓◦•]\s+(.+)/) || (line.includes('@') && !collectingCustomerData)) {
        // Save previous customer
        if (currentCustomer.name && this.hasMinimumFields(currentCustomer)) {
          customers.push(this.completeCustomer(currentCustomer));
        }

        // Start new customer
        currentCustomer = {};
        collectingCustomerData = true;

        // Extract name
        const nameMatch = line.match(/^[✓◦•]\s+(.+)/);
        if (nameMatch) {
          currentCustomer.name = this.cleanText(nameMatch[1]);
        }

        // Extract email if on same line
        const emailMatch = line.match(FIELD_PATTERNS.EMAIL.patterns[0]);
        if (emailMatch) {
          currentCustomer.email = emailMatch[1];
        }
        continue;
      }

      if (collectingCustomerData && currentCustomer.name) {
        // Extract all possible fields from current line
        this.extractFieldsFromLine(line, currentCustomer);
      }
    }

    // Don't forget the last customer
    if (currentCustomer.name && this.hasMinimumFields(currentCustomer)) {
      customers.push(this.completeCustomer(currentCustomer));
    }

    return customers;
  }

  /**
   * Parse spreadsheet format (CSV/TSV)
   */
  private parseSpreadsheet(): CustomerInfo[] {
    const customers: CustomerInfo[] = [];
    const delimiter = this.detectDelimiter();

    // Detect headers
    const hasHeaders = this.detectHeaders(this.lines[0], delimiter);
    const startIndex = hasHeaders ? 1 : 0;

    let headers: string[] = [];
    if (hasHeaders) {
      headers = this.lines[0].split(delimiter).map(h => h.trim());
    }

    for (let i = startIndex; i < this.lines.length; i++) {
      const line = this.lines[i];
      if (!line) continue;

      try {
        const parts = line.split(delimiter).map(part => part.trim());
        const customer = this.parseSpreadsheetRow(parts, headers);

        if (this.hasMinimumFields(customer)) {
          customers.push(this.completeCustomer(customer));
        }
      } catch (error) {
        this.errors.push(`Error parsing line ${i + 1}: ${error}`);
      }
    }

    return customers;
  }

  /**
   * Parse pipe-delimited format
   */
  private parsePipeDelimited(): CustomerInfo[] {
    const customers: CustomerInfo[] = [];

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      if (!line) continue;

      try {
        const parts = line.split('|').map(part => part.trim());
        const customer: Partial<CustomerInfo> = {};

        // Extract fields from each part
        parts.forEach(part => {
          this.extractFieldsFromLine(part, customer);
        });

        if (this.hasMinimumFields(customer)) {
          customers.push(this.completeCustomer(customer));
        }
      } catch (error) {
        this.errors.push(`Error parsing pipe-delimited line ${i + 1}: ${error}`);
      }
    }

    return customers;
  }

  /**
   * Parse structured text with labels
   */
  private parseStructuredText(): CustomerInfo[] {
    const customers: CustomerInfo[] = [];
    let currentCustomer: Partial<CustomerInfo> = {};

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];

      // Check if this line starts a new customer
      if (line.toLowerCase().includes('customer:') ||
          line.toLowerCase().includes('name:') ||
          (currentCustomer.name && this.hasMinimumFields(currentCustomer))) {

        // Save previous customer
        if (currentCustomer.name && this.hasMinimumFields(currentCustomer)) {
          customers.push(this.completeCustomer(currentCustomer));
        }

        // Start new customer
        currentCustomer = {};
      }

      // Extract labeled fields
      this.extractLabeledFields(line, currentCustomer);
    }

    // Don't forget the last customer
    if (currentCustomer.name && this.hasMinimumFields(currentCustomer)) {
      customers.push(this.completeCustomer(currentCustomer));
    }

    return customers;
  }

  /**
   * Parse mixed format using intelligent field detection
   */
  private parseMixedFormat(): CustomerInfo[] {
    const customers: CustomerInfo[] = [];

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      if (!line) continue;

      try {
        const customer: Partial<CustomerInfo> = {};

        // Try multiple delimiter patterns
        const delimiters = [',', '\t', '|', ';', /\s{2,}/];
        let bestParsing: Partial<CustomerInfo> = {};
        let bestScore = 0;

        for (const delimiter of delimiters) {
          const parts = typeof delimiter === 'string'
            ? line.split(delimiter)
            : line.split(delimiter as RegExp);

          const tempCustomer: Partial<CustomerInfo> = {};
          parts.forEach(part => {
            this.extractFieldsFromLine(part.trim(), tempCustomer);
          });

          const score = this.calculateParsingScore(tempCustomer);
          if (score > bestScore) {
            bestScore = score;
            bestParsing = tempCustomer;
          }
        }

        // Also try treating the entire line as one unit
        this.extractFieldsFromLine(line, customer);
        const lineScore = this.calculateParsingScore(customer);

        const finalCustomer = lineScore > bestScore ? customer : bestParsing;

        if (this.hasMinimumFields(finalCustomer)) {
          customers.push(this.completeCustomer(finalCustomer));
        }
      } catch (error) {
        this.errors.push(`Error parsing mixed format line ${i + 1}: ${error}`);
      }
    }

    return customers;
  }

  /**
   * Parse free text using advanced pattern matching
   */
  private parseFreeText(): CustomerInfo[] {
    const customers: CustomerInfo[] = [];
    const allText = this.lines.join(' ');

    // Try to extract all emails first
    const emails = this.extractAllMatches(allText, FIELD_PATTERNS.EMAIL.patterns);

    if (emails.length === 0) {
      this.warnings.push('No email addresses found in the text');
      return customers;
    }

    // For each email, try to find associated information
    emails.forEach((email, index) => {
      const customer: Partial<CustomerInfo> = { email };

      // Find the context around this email
      const emailIndex = allText.indexOf(email);
      const contextStart = Math.max(0, emailIndex - 200);
      const contextEnd = Math.min(allText.length, emailIndex + 200);
      const context = allText.substring(contextStart, contextEnd);

      // Extract other fields from context
      this.extractFieldsFromLine(context, customer);

      if (this.hasMinimumFields(customer)) {
        customers.push(this.completeCustomer(customer));
      }
    });

    return customers;
  }

  /**
   * Extract fields from a single line using pattern matching
   */
  private extractFieldsFromLine(line: string, customer: Partial<CustomerInfo>): void {
    // Extract email
    if (!customer.email) {
      const emailMatch = this.extractFirstMatch(line, FIELD_PATTERNS.EMAIL.patterns);
      if (emailMatch) customer.email = emailMatch;
    }

    // Extract phone
    if (!customer.phone) {
      const phoneMatch = this.extractFirstMatch(line, FIELD_PATTERNS.PHONE.patterns);
      if (phoneMatch) customer.phone = this.formatPhone(phoneMatch);
    }

    // Extract address
    if (!customer.serviceAddress) {
      const addressMatch = this.extractFirstMatch(line, FIELD_PATTERNS.ADDRESS.patterns);
      if (addressMatch) customer.serviceAddress = this.cleanText(addressMatch);
    }

    // Extract date
    if (!customer.installationDate) {
      const dateMatch = this.extractFirstMatch(line, FIELD_PATTERNS.DATE.patterns);
      if (dateMatch) customer.installationDate = this.parseAndFormatDate(dateMatch);
    }

    // Extract time
    if (!customer.installationTime) {
      const timeMatch = this.extractFirstMatch(line, FIELD_PATTERNS.TIME.patterns);
      if (timeMatch) customer.installationTime = this.formatTime(timeMatch);
    }

    // Extract lead size
    if (!customer.leadSize) {
      const leadSizeMatch = this.extractFirstMatch(line, FIELD_PATTERNS.LEAD_SIZE.patterns);
      if (leadSizeMatch) customer.leadSize = this.parseLeadSize(leadSizeMatch);
    }

    // Extract order number
    if (!customer.orderNumber) {
      const orderMatch = this.extractFirstMatch(line, FIELD_PATTERNS.ORDER_NUMBER.patterns);
      if (orderMatch) customer.orderNumber = orderMatch;
    }

    // Extract name (if not already set)
    if (!customer.name) {
      const nameMatch = this.extractFirstMatch(line, FIELD_PATTERNS.NAME.patterns);
      if (nameMatch) {
        // Validate it's not part of an address or other field
        if (!nameMatch.toLowerCase().includes('street') &&
            !nameMatch.toLowerCase().includes('address') &&
            !line.toLowerCase().includes('service address')) {
          customer.name = this.cleanText(nameMatch);
        }
      }
    }
  }

  /**
   * Extract labeled fields (e.g., "Name: John Smith")
   */
  private extractLabeledFields(line: string, customer: Partial<CustomerInfo>): void {
    const labelPatterns = {
      name: /(?:name|customer):\s*([^,\n]+)/gi,
      email: /(?:email|e-mail):\s*([^\s,\n]+)/gi,
      phone: /(?:phone|tel|telephone):\s*([^\s,\n]+)/gi,
      address: /(?:address|addr):\s*([^,\n]+)/gi,
      date: /(?:date|install.*date|installation.*date):\s*([^,\n]+)/gi,
      time: /(?:time|install.*time|installation.*time):\s*([^,\n]+)/gi,
      size: /(?:size|plan|package|speed):\s*([^,\n]+)/gi,
      order: /(?:order|order.*number|#):\s*([^,\n]+)/gi
    };

    Object.entries(labelPatterns).forEach(([field, pattern]) => {
      const match = pattern.exec(line);
      if (match && match[1]) {
        const value = match[1].trim();
        switch (field) {
          case 'name':
            if (!customer.name) customer.name = this.cleanText(value);
            break;
          case 'email':
            if (!customer.email) customer.email = value;
            break;
          case 'phone':
            if (!customer.phone) customer.phone = this.formatPhone(value);
            break;
          case 'address':
            if (!customer.serviceAddress) customer.serviceAddress = this.cleanText(value);
            break;
          case 'date':
            if (!customer.installationDate) customer.installationDate = this.parseAndFormatDate(value);
            break;
          case 'time':
            if (!customer.installationTime) customer.installationTime = this.formatTime(value);
            break;
          case 'size':
            if (!customer.leadSize) customer.leadSize = this.parseLeadSize(value);
            break;
          case 'order':
            if (!customer.orderNumber) customer.orderNumber = value;
            break;
        }
      }
    });
  }

  /**
   * Parse spreadsheet row with optional headers
   */
  private parseSpreadsheetRow(parts: string[], headers: string[]): Partial<CustomerInfo> {
    const customer: Partial<CustomerInfo> = {};

    if (headers.length > 0) {
      // Use header-based parsing
      headers.forEach((header, index) => {
        if (index < parts.length && parts[index]) {
          const value = parts[index];
          this.mapHeaderToField(header, value, customer);
        }
      });
    } else {
      // Use positional and pattern-based parsing
      parts.forEach((part, index) => {
        if (!part) return;

        // Try to identify field type by content
        if (part.includes('@') && !customer.email) {
          customer.email = part;
        } else if (FIELD_PATTERNS.PHONE.patterns[0].test(part) && !customer.phone) {
          customer.phone = this.formatPhone(part);
        } else if (FIELD_PATTERNS.DATE.patterns.some(p => p.test(part)) && !customer.installationDate) {
          customer.installationDate = this.parseAndFormatDate(part);
        } else if (!customer.name && index === 0 && FIELD_PATTERNS.NAME.patterns.some(p => p.test(part))) {
          customer.name = this.cleanText(part);
        } else if (!customer.serviceAddress && part.length > 10 && /\d+\s+[A-Za-z]/.test(part)) {
          customer.serviceAddress = this.cleanText(part);
        }
      });
    }

    return customer;
  }

  /**
   * Map header name to customer field
   */
  private mapHeaderToField(header: string, value: string, customer: Partial<CustomerInfo>): void {
    const lowerHeader = header.toLowerCase();

    if (lowerHeader.includes('name') || lowerHeader.includes('customer')) {
      customer.name = this.cleanText(value);
    } else if (lowerHeader.includes('email') || lowerHeader.includes('e-mail')) {
      customer.email = value;
    } else if (lowerHeader.includes('phone') || lowerHeader.includes('tel')) {
      customer.phone = this.formatPhone(value);
    } else if (lowerHeader.includes('address') || lowerHeader.includes('street')) {
      customer.serviceAddress = this.cleanText(value);
    } else if (lowerHeader.includes('date') || lowerHeader.includes('install')) {
      customer.installationDate = this.parseAndFormatDate(value);
    } else if (lowerHeader.includes('time')) {
      customer.installationTime = this.formatTime(value);
    } else if (lowerHeader.includes('size') || lowerHeader.includes('plan') || lowerHeader.includes('fiber')) {
      customer.leadSize = this.parseLeadSize(value);
    } else if (lowerHeader.includes('order') || lowerHeader.includes('#')) {
      customer.orderNumber = value;
    }
  }

  /**
   * Utility methods
   */

  private extractFirstMatch(text: string, patterns: RegExp[]): string | null {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1];
      } else if (match && match[0]) {
        return match[0];
      }
    }
    return null;
  }

  private extractAllMatches(text: string, patterns: RegExp[]): string[] {
    const matches: string[] = [];
    for (const pattern of patterns) {
      const found = text.match(pattern);
      if (found) {
        matches.push(...found);
      }
    }
    return [...new Set(matches)]; // Remove duplicates
  }

  private detectDelimiter(): string {
    const sampleText = this.lines.slice(0, 5).join('\n');
    let bestDelimiter = ',';
    let bestScore = 0;

    DELIMITER_PATTERNS.forEach(({ char, weight }) => {
      const pattern = typeof char === 'string' ? char : char;
      const matches = typeof char === 'string'
        ? (sampleText.match(new RegExp(char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
        : (sampleText.match(char) || []).length;

      const score = matches * weight;
      if (score > bestScore) {
        bestScore = score;
        bestDelimiter = typeof char === 'string' ? char : ' ';
      }
    });

    return bestDelimiter;
  }

  private detectHeaders(firstLine: string, delimiter: string): boolean {
    const parts = firstLine.split(delimiter);
    const headerIndicators = ['name', 'email', 'phone', 'address', 'date', 'time', 'customer', 'rep', 'id'];

    let headerCount = 0;
    parts.forEach(part => {
      if (headerIndicators.some(indicator => part.toLowerCase().includes(indicator))) {
        headerCount++;
      }
    });

    return headerCount > parts.length * 0.3; // At least 30% should be recognizable headers
  }

  private isHeaderLine(line: string): boolean {
    const lowerLine = line.toLowerCase();
    return lowerLine.includes('week ') ||
           lowerLine.includes('total sales:') ||
           lowerLine.includes('completed:') ||
           lowerLine.includes('cancels:') ||
           lowerLine.includes('monthly total') ||
           lowerLine.includes('orders');
  }

  private hasMinimumFields(customer: Partial<CustomerInfo>): boolean {
    return !!(customer.name || customer.email || customer.phone);
  }

  private calculateParsingScore(customer: Partial<CustomerInfo>): number {
    let score = 0;
    if (customer.name) score += 25;
    if (customer.email) score += 30;
    if (customer.phone) score += 25;
    if (customer.serviceAddress) score += 15;
    if (customer.installationDate) score += 3;
    if (customer.installationTime) score += 2;
    return score;
  }

  private completeCustomer(partial: Partial<CustomerInfo>): CustomerInfo {
    const score = this.calculateParsingScore(partial);

    return {
      name: partial.name || this.generateFallbackName(partial),
      email: partial.email || this.generateFallbackEmail(partial),
      phone: partial.phone || '555-000-0000',
      serviceAddress: partial.serviceAddress || 'Address not provided',
      installationDate: partial.installationDate || this.getDefaultInstallDate(),
      installationTime: partial.installationTime || '10:00 AM',
      isReferral: false,
      referralSource: '',
      leadSize: (partial.leadSize as '500MB' | '1GIG' | '2GIG') || '2GIG',
      orderNumber: partial.orderNumber,
      notes: partial.notes,
      confidence: Math.round(score)
    };
  }

  private generateFallbackName(customer: Partial<CustomerInfo>): string {
    if (customer.email) {
      const localPart = customer.email.split('@')[0];
      return localPart.replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    return 'Unknown Customer';
  }

  private generateFallbackEmail(customer: Partial<CustomerInfo>): string {
    if (customer.name) {
      return `${customer.name.toLowerCase().replace(/\s+/g, '.')}@example.com`;
    }
    return 'customer@example.com';
  }

  private cleanText(text: string): string {
    return text.replace(/[✅💰✓◦•]/g, '').trim();
  }

  private formatPhone(phone: string): string {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');

    // Format as (XXX) XXX-XXXX if 10 digits
    if (digits.length === 10) {
      return `(${digits.substr(0,3)}) ${digits.substr(3,3)}-${digits.substr(6,4)}`;
    }

    // Return original if not 10 digits
    return phone;
  }

  private formatTime(time: string): string {
    // Clean up time format
    return time.replace(/\s+/g, ' ').trim();
  }

  private parseLeadSize(size: string): '500MB' | '1GIG' | '2GIG' {
    const lowerSize = size.toLowerCase();
    if (lowerSize.includes('500') || lowerSize.includes('500mb')) {
      return '500MB';
    } else if (lowerSize.includes('1') && (lowerSize.includes('gig') || lowerSize.includes('gb'))) {
      return '1GIG';
    } else if (lowerSize.includes('2') && (lowerSize.includes('gig') || lowerSize.includes('gb'))) {
      return '2GIG';
    }
    return '2GIG'; // Default
  }

  private parseAndFormatDate(dateStr: string): string {
    if (!dateStr || dateStr === 'null') {
      return this.getDefaultInstallDate();
    }

    try {
      // Handle various date formats
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

      // Try to parse as standard date
      const parsedDate = new Date(dateStr);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString().split('T')[0];
      }

      return this.getDefaultInstallDate();

    } catch (error) {
      return this.getDefaultInstallDate();
    }
  }

  private getDefaultInstallDate(): string {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    return futureDate.toISOString().split('T')[0];
  }

  private validateAndEnhanceCustomers(customers: CustomerInfo[]): CustomerInfo[] {
    return customers.map(customer => {
      // Validate email format
      if (customer.email && !FIELD_PATTERNS.EMAIL.patterns[0].test(customer.email)) {
        this.warnings.push(`Invalid email format for ${customer.name}: ${customer.email}`);
        customer.email = this.generateFallbackEmail(customer);
      }

      // Validate phone format
      if (customer.phone && !FIELD_PATTERNS.PHONE.patterns[0].test(customer.phone.replace(/\D/g, ''))) {
        this.warnings.push(`Invalid phone format for ${customer.name}: ${customer.phone}`);
      }

      // Enhance confidence score based on data completeness
      let confidence = customer.confidence || 0;
      if (customer.name && customer.email && customer.phone) confidence += 20;
      if (customer.serviceAddress && customer.serviceAddress !== 'Address not provided') confidence += 10;
      if (customer.installationDate && customer.installationTime) confidence += 5;

      customer.confidence = Math.min(100, confidence);

      return customer;
    });
  }

  private generateMetadata() {
    return {
      totalLines: this.lines.length,
      emptyLines: this.data.split('\n').length - this.lines.length,
      headerLines: this.lines.filter(line => this.isHeaderLine(line)).length,
      dataLines: this.lines.filter(line => !this.isHeaderLine(line)).length,
      averageFieldsPerLine: this.lines.reduce((sum, line) => sum + line.split(/[,\t|]/).length, 0) / this.lines.length
    };
  }
}

// Export a factory function for easy use
export function parseUniversalData(data: string): ParseResult {
  const parser = new UniversalDataParser(data);
  return parser.parse();
}