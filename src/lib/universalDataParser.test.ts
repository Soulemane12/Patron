/**
 * Test suite for Universal Data Parser
 * Demonstrates parsing capabilities across various formats
 */

import { parseUniversalData, UniversalDataParser } from './universalDataParser';

// Test data samples representing different formats
const TEST_DATA = {
  SALES_REPORT: `
Week 1:
✓ John Smith
john.smith@gmail.com
(555) 123-4567
Service address: 123 Main Street
Anytown, CA 90210
Installation: Tuesday, July 29, 2025
12-2pm
2GIG

✓ Jane Doe 💰
jane.doe@hotmail.com
555-987-6543
Service address: 456 Oak Avenue
Installation Date: July 30, 2025
10am-12pm
1GIG

Total Sales: 2
`,

  SPREADSHEET_CSV: `
Name,Email,Phone,Address,City,State,Zip,Installation Date,Time,Plan
John Smith,john@email.com,555-123-4567,123 Main St,Anytown,CA,90210,2025-07-29,2:00 PM,2GIG
Jane Doe,jane@email.com,555-987-6543,456 Oak Ave,Somewhere,NY,10001,2025-07-30,10:00 AM,1GIG
Bob Wilson,bob@email.com,555-555-5555,789 Pine St,Elsewhere,TX,75001,2025-07-31,3:00 PM,500MB
`,

  SPREADSHEET_TSV: `
Rep ID	Rep Name	Order Date	Fiber Plan	Customer Type	Status	Street Address	Unit	City	State	Zip	Installation Date	Time
12345	John Smith	2025-07-25	2 Gig	Residential	Active	123 Main Street		Anytown	CA	90210	2025-07-29	2:00 PM
67890	Jane Doe	2025-07-26	1 Gig	Business	Active	456 Oak Avenue	Unit 5	Somewhere	NY	10001	2025-07-30	10:00 AM
`,

  PIPE_DELIMITED: `
John Smith | john@email.com | 555-123-4567 | 123 Main St, Anytown CA 90210 | July 29, 2025 | 2pm | 2GIG
Jane Doe | jane@email.com | 555-987-6543 | 456 Oak Ave, Somewhere NY 10001 | July 30, 2025 | 10am | 1GIG
Bob Wilson | bob@email.com | 555-555-5555 | 789 Pine St, Elsewhere TX 75001 | July 31, 2025 | 3pm | 500MB
`,

  STRUCTURED_TEXT: `
Customer: John Smith
Email: john@email.com
Phone: 555-123-4567
Address: 123 Main Street, Anytown CA 90210
Installation Date: July 29, 2025
Time: 2:00 PM
Plan: 2 Gig

Customer: Jane Doe
Email: jane@email.com
Phone: 555-987-6543
Address: 456 Oak Avenue, Somewhere NY 10001
Installation Date: July 30, 2025
Time: 10:00 AM
Plan: 1 Gig
`,

  MIXED_FORMAT: `
John Smith - john@email.com - Call: 555-123-4567 - Lives at 123 Main St, Anytown CA - Install on July 29th at 2pm - Wants 2GIG package
Customer #2: Jane Doe, email jane@email.com, phone (555) 987-6543, service address 456 Oak Ave Somewhere NY, scheduled July 30 10am, 1GIG speed
Bob Wilson | bob@email.com | 555.555.5555 | 789 Pine Street Elsewhere TX | 7/31/2025 3:00 PM | 500Mbps
`,

  FREE_TEXT: `
Here are the new customers for this week. John Smith wants our 2 gig service and can be reached at john@email.com or by calling 555-123-4567. His installation is scheduled for July 29th at 2pm at 123 Main Street in Anytown California.

We also have Jane Doe who signed up for 1 gig service. Her email is jane@email.com and phone is 555-987-6543. She lives at 456 Oak Avenue in Somewhere NY and wants installation on July 30th at 10am.

The third customer Bob Wilson (bob@email.com, 555-555-5555) requested our 500MB plan for his place at 789 Pine Street in Elsewhere Texas. He's available July 31st at 3pm.
`,

  EDGE_CASES: `
✓ Customer with (special) characters! & symbols
special.email+test@domain-name.co.uk
Phone: +1 (555) 123-4567 ext. 890
Address: 123 Main St, Apt #4B, Big City, CA 90210-1234
Install: Mon, Dec 25, 2024 @ 11:30 AM - 1:30 PM
Package: 2 Gig Fiber

No Name Customer
noemail
badphone
No address provided
Invalid date
Bad time
Unknown plan

JOHN DOE ALL CAPS
JOHN.DOE@COMPANY.COM
5551234567
123 MAIN STREET
DECEMBER 1 2024
2PM
`,

  MALFORMED_DATA: `
Random text with no customer data
Just some gibberish
No emails or phones here
This line has @ but not email format
This has numbers 123456 but not phone
`,

  MULTIPLE_FORMATS_MIXED: `
Week 1 Sales Report:
✓ John Smith (Sales Rep Format)
john@email.com
555-123-4567
Service address: 123 Main St

CSV Style Below:
Jane,jane@email.com,555-987-6543,456 Oak Ave,July 30
Bob,bob@email.com,555-555-5555,789 Pine St,July 31

Pipe format:
Alice Johnson | alice@email.com | 555-111-2222 | 321 Elm St | Aug 1 | 1GIG

Free text: Charlie Brown can be reached at charlie@email.com or 555-999-8888. He lives at 654 Maple Ave and wants installation on August 2nd.
`
};

describe('UniversalDataParser', () => {
  describe('Format Detection', () => {
    test('should detect sales report format', () => {
      const result = parseUniversalData(TEST_DATA.SALES_REPORT);
      expect(result.formatDetected).toBe('SALES_REPORT');
      expect(result.confidence).toBeGreaterThan(80);
    });

    test('should detect CSV format', () => {
      const result = parseUniversalData(TEST_DATA.SPREADSHEET_CSV);
      expect(result.formatDetected).toBe('SPREADSHEET_CSV');
      expect(result.confidence).toBeGreaterThan(80);
    });

    test('should detect TSV format', () => {
      const result = parseUniversalData(TEST_DATA.SPREADSHEET_TSV);
      expect(result.formatDetected).toBe('SPREADSHEET_TSV');
      expect(result.confidence).toBeGreaterThan(80);
    });

    test('should detect pipe delimited format', () => {
      const result = parseUniversalData(TEST_DATA.PIPE_DELIMITED);
      expect(result.formatDetected).toBe('PIPE_DELIMITED');
      expect(result.confidence).toBeGreaterThan(75);
    });

    test('should detect structured text format', () => {
      const result = parseUniversalData(TEST_DATA.STRUCTURED_TEXT);
      expect(result.formatDetected).toBe('STRUCTURED_TEXT');
      expect(result.confidence).toBeGreaterThan(80);
    });

    test('should handle mixed format', () => {
      const result = parseUniversalData(TEST_DATA.MIXED_FORMAT);
      expect(['MIXED_FORMAT', 'FREE_TEXT']).toContain(result.formatDetected);
      expect(result.confidence).toBeGreaterThan(60);
    });
  });

  describe('Field Extraction', () => {
    test('should extract all fields from sales report', () => {
      const result = parseUniversalData(TEST_DATA.SALES_REPORT);

      expect(result.customers).toHaveLength(2);

      const john = result.customers.find(c => c.name.includes('John'));
      expect(john).toBeDefined();
      expect(john?.email).toBe('john.smith@gmail.com');
      expect(john?.phone).toContain('555');
      expect(john?.serviceAddress).toContain('123 Main Street');
      expect(john?.leadSize).toBe('2GIG');

      const jane = result.customers.find(c => c.name.includes('Jane'));
      expect(jane).toBeDefined();
      expect(jane?.email).toBe('jane.doe@hotmail.com');
      expect(jane?.leadSize).toBe('1GIG');
    });

    test('should extract fields from CSV with headers', () => {
      const result = parseUniversalData(TEST_DATA.SPREADSHEET_CSV);

      expect(result.customers).toHaveLength(3);

      const customers = result.customers;
      expect(customers[0].name).toBe('John Smith');
      expect(customers[0].email).toBe('john@email.com');
      expect(customers[0].phone).toContain('555-123-4567');
      expect(customers[0].leadSize).toBe('2GIG');

      expect(customers[2].leadSize).toBe('500MB');
    });

    test('should handle pipe delimited data', () => {
      const result = parseUniversalData(TEST_DATA.PIPE_DELIMITED);

      expect(result.customers).toHaveLength(3);
      result.customers.forEach(customer => {
        expect(customer.name).toBeTruthy();
        expect(customer.email).toContain('@');
        expect(customer.phone).toContain('555');
      });
    });

    test('should parse structured text with labels', () => {
      const result = parseUniversalData(TEST_DATA.STRUCTURED_TEXT);

      expect(result.customers).toHaveLength(2);

      const john = result.customers[0];
      expect(john.name).toBe('John Smith');
      expect(john.email).toBe('john@email.com');
      expect(john.phone).toContain('555-123-4567');
      expect(john.serviceAddress).toContain('123 Main Street');
      expect(john.leadSize).toBe('2GIG');
    });

    test('should extract from free text', () => {
      const result = parseUniversalData(TEST_DATA.FREE_TEXT);

      expect(result.customers.length).toBeGreaterThan(0);

      // Should find emails and associate context
      const emails = result.customers.map(c => c.email);
      expect(emails).toContain('john@email.com');
      expect(emails).toContain('jane@email.com');
      expect(emails).toContain('bob@email.com');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle malformed data gracefully', () => {
      const result = parseUniversalData(TEST_DATA.MALFORMED_DATA);

      expect(result.customers).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThan(70);
    });

    test('should handle special characters and formatting', () => {
      const result = parseUniversalData(TEST_DATA.EDGE_CASES);

      expect(result.customers.length).toBeGreaterThan(0);

      const specialCustomer = result.customers.find(c =>
        c.name.includes('special') || c.email.includes('special')
      );

      if (specialCustomer) {
        expect(specialCustomer.email).toContain('@');
        expect(specialCustomer.phone).toContain('555');
      }
    });

    test('should handle empty input', () => {
      const result = parseUniversalData('');

      expect(result.customers).toHaveLength(0);
      expect(result.formatDetected).toBe('FREE_TEXT');
      expect(result.confidence).toBeLessThan(70);
    });

    test('should handle multiple formats in same input', () => {
      const result = parseUniversalData(TEST_DATA.MULTIPLE_FORMATS_MIXED);

      expect(result.customers.length).toBeGreaterThan(3);

      // Should find customers from different format sections
      const names = result.customers.map(c => c.name.toLowerCase());
      expect(names.some(name => name.includes('john'))).toBe(true);
      expect(names.some(name => name.includes('jane'))).toBe(true);
      expect(names.some(name => name.includes('alice'))).toBe(true);
      expect(names.some(name => name.includes('charlie'))).toBe(true);
    });
  });

  describe('Data Validation and Enhancement', () => {
    test('should validate email formats', () => {
      const badEmailData = `
        John Smith
        john.smith.gmail.com
        555-123-4567
      `;

      const result = parseUniversalData(badEmailData);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    test('should provide confidence scores', () => {
      const result = parseUniversalData(TEST_DATA.SPREADSHEET_CSV);

      result.customers.forEach(customer => {
        expect(customer.confidence).toBeGreaterThan(0);
        expect(customer.confidence).toBeLessThanOrEqual(100);
      });
    });

    test('should provide fallback data for missing fields', () => {
      const incompleteData = `
        John Smith
        john@email.com
      `;

      const result = parseUniversalData(incompleteData);

      if (result.customers.length > 0) {
        const customer = result.customers[0];
        expect(customer.phone).toBeTruthy(); // Should have fallback
        expect(customer.serviceAddress).toBeTruthy(); // Should have fallback
        expect(customer.installationDate).toBeTruthy(); // Should have fallback
      }
    });

    test('should generate comprehensive metadata', () => {
      const result = parseUniversalData(TEST_DATA.SALES_REPORT);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.totalLines).toBeGreaterThan(0);
      expect(result.metadata.dataLines).toBeGreaterThan(0);
      expect(result.metadata.averageFieldsPerLine).toBeGreaterThan(0);
    });
  });

  describe('Pattern Matching', () => {
    test('should handle various date formats', () => {
      const dateFormats = `
        John Smith, john@email.com, 555-123-4567, July 29, 2025
        Jane Doe, jane@email.com, 555-987-6543, 07/30/2025
        Bob Wilson, bob@email.com, 555-555-5555, 2025-07-31
        Alice Johnson, alice@email.com, 555-111-2222, Tuesday, August 1, 2025
      `;

      const result = parseUniversalData(dateFormats);

      result.customers.forEach(customer => {
        expect(customer.installationDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    test('should handle various phone formats', () => {
      const phoneFormats = `
        John Smith, john@email.com, (555) 123-4567
        Jane Doe, jane@email.com, 555-987-6543
        Bob Wilson, bob@email.com, 555.555.5555
        Alice Johnson, alice@email.com, 5551112222
      `;

      const result = parseUniversalData(phoneFormats);

      result.customers.forEach(customer => {
        expect(customer.phone).toBeTruthy();
        expect(customer.phone).toContain('555');
      });
    });

    test('should handle various lead size formats', () => {
      const leadSizeFormats = `
        John Smith, john@email.com, 555-123-4567, 2 Gig
        Jane Doe, jane@email.com, 555-987-6543, 1GIG
        Bob Wilson, bob@email.com, 555-555-5555, 500MB
        Alice Johnson, alice@email.com, 555-111-2222, 500 Mbps
      `;

      const result = parseUniversalData(leadSizeFormats);

      const leadSizes = result.customers.map(c => c.leadSize);
      expect(leadSizes).toContain('2GIG');
      expect(leadSizes).toContain('1GIG');
      expect(leadSizes).toContain('500MB');
    });
  });
});

// Performance test for large datasets
describe('Performance Tests', () => {
  test('should handle large datasets efficiently', () => {
    // Generate a large dataset
    const largeDataset = Array.from({ length: 1000 }, (_, i) =>
      `Customer ${i}, customer${i}@email.com, 555-${String(i).padStart(3, '0')}-${String(i + 1000).padStart(4, '0')}, ${i} Main St, City${i}, ST, ${10000 + i}, July ${(i % 30) + 1}, 2025, ${(i % 12) + 1}:00 AM, ${['500MB', '1GIG', '2GIG'][i % 3]}`
    ).join('\n');

    const startTime = Date.now();
    const result = parseUniversalData(largeDataset);
    const endTime = Date.now();

    expect(result.customers.length).toBeGreaterThan(900); // Allow for some parsing failures
    expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
  });
});

// Export test utilities for integration testing
export const testDataSamples = TEST_DATA;

export function runParsingTests() {
  console.log('🧪 Running Universal Data Parser Tests...\n');

  Object.entries(TEST_DATA).forEach(([format, data]) => {
    console.log(`\n📋 Testing ${format}:`);
    console.log('─'.repeat(50));

    const result = parseUniversalData(data);

    console.log(`Format Detected: ${result.formatDetected}`);
    console.log(`Confidence: ${result.confidence}%`);
    console.log(`Customers Found: ${result.customers.length}`);
    console.log(`Warnings: ${result.warnings.length}`);
    console.log(`Errors: ${result.errors.length}`);

    if (result.customers.length > 0) {
      console.log('\n👥 Sample Customer:');
      const sample = result.customers[0];
      console.log(`  Name: ${sample.name}`);
      console.log(`  Email: ${sample.email}`);
      console.log(`  Phone: ${sample.phone}`);
      console.log(`  Address: ${sample.serviceAddress}`);
      console.log(`  Date: ${sample.installationDate}`);
      console.log(`  Size: ${sample.leadSize}`);
      console.log(`  Confidence: ${sample.confidence}%`);
    }

    if (result.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      result.warnings.forEach(warning => console.log(`  - ${warning}`));
    }

    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.forEach(error => console.log(`  - ${error}`));
    }
  });

  console.log('\n✅ Testing Complete!');
}