/**
 * Comprehensive Test Suite for AI-Powered Data Parser
 * Tests AI functionality, security features, and integration
 */

import { AIDataParser, parseUniversalDataWithAI, AI_PARSER_PRESETS } from './aiDataParser';
import { createSecurityModule, SECURITY_PRESETS } from './aiParserSecurity';

// Mock Groq SDK for testing
jest.mock('groq-sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    }))
  };
});

// Test data samples for AI parser
const AI_TEST_DATA = {
  CUSTOMER_LIST_UNSTRUCTURED: `
    Here are our new customers for this week:

    John Smith wants 2GIG service at john.smith@gmail.com or (555) 123-4567
    Installation at 123 Main Street, Anytown CA on July 29th at 2pm

    Jane Doe signed up for 1GIG, email jane.doe@hotmail.com, phone 555-987-6543
    She lives at 456 Oak Avenue and prefers July 30th morning installation

    Bob Wilson - bob@email.com - 555.555.5555 - 789 Pine St - July 31 3pm - 500MB plan
  `,

  MIXED_LANGUAGE_DATA: `
    Cliente: María García
    Email: maria.garcia@empresa.com
    Teléfono: (555) 111-2222
    Dirección: 321 Elm Street, Ciudad, CA 90210
    Fecha de instalación: 1 de agosto, 2025
    Plan: 2 Gig

    Customer: John Williams
    Email: john.w@company.com
    Phone: 555-333-4444
    Address: 654 Maple Ave, Town, NY 10001
    Install Date: August 2, 2025
    Package: 1GIG
  `,

  MALFORMED_JSON: `
    [
      {"name": "Alice Johnson", "email": "alice@test.com", "phone": "555-777-8888",
      {"name": "Missing closing bracket", "email": "broken@test.com"
      "name": "Charlie Brown", "email": "charlie@test.com", "phone": "555-999-0000"}
    ]
  `,

  SENSITIVE_DATA_TEST: `
    Customer: John Smith
    Email: john.smith@gmail.com
    Phone: 555-123-4567
    SSN: 123-45-6789
    Credit Card: 4532-1234-5678-9012
    Medical ID: MED123456
    Bank Account: 987654321
    Address: 123 Main St, Anytown CA 90210
  `,

  FOREIGN_CHARACTERS: `
    客户: 张三 (Zhang San)
    电子邮件: zhang.san@example.cn
    电话: +86-138-0013-8000
    地址: 北京市朝阳区建国门外大街1号

    Kunde: Hans Müller
    E-Mail: hans.mueller@beispiel.de
    Telefon: +49-30-12345678
    Adresse: Alexanderplatz 1, 10178 Berlin
  `,

  LARGE_DATASET: Array.from({ length: 100 }, (_, i) =>
    `Customer ${i + 1}, customer${i + 1}@email.com, 555-${String(i).padStart(3, '0')}-${String(i + 1000).padStart(4, '0')}, ${i + 1} Main St, July ${(i % 30) + 1} 2025, ${['500MB', '1GIG', '2GIG'][i % 3]}`
  ).join('\n')
};

describe('AI Data Parser', () => {
  let mockGroqResponse: any;

  beforeEach(() => {
    // Setup default mock response
    mockGroqResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            format: 'FREE_TEXT',
            confidence: 85,
            reasoning: 'Unstructured text with customer information'
          })
        }
      }],
      usage: { total_tokens: 150 }
    };

    // Mock environment variable
    process.env.GROQ_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Configuration', () => {
    test('should initialize with default configuration', () => {
      const parser = new AIDataParser();
      expect(parser).toBeDefined();
    });

    test('should accept custom configuration', () => {
      const customConfig = {
        maxTokens: 4000,
        temperature: 0.2,
        costThreshold: 0.5
      };
      const parser = new AIDataParser(customConfig);
      expect(parser).toBeDefined();
    });

    test('should throw error when GROQ_API_KEY is missing', () => {
      delete process.env.GROQ_API_KEY;
      expect(() => new AIDataParser()).toThrow('GROQ_API_KEY environment variable is required');
      process.env.GROQ_API_KEY = 'test-api-key'; // Restore for other tests
    });
  });

  describe('Format Detection', () => {
    beforeEach(() => {
      const Groq = require('groq-sdk').default;
      const mockGroq = new Groq();
      mockGroq.chat.completions.create.mockResolvedValue(mockGroqResponse);
    });

    test('should detect unstructured text format', async () => {
      const parser = new AIDataParser();

      // Mock customer extraction response
      const customerResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              customers: [{
                name: 'John Smith',
                email: 'john.smith@gmail.com',
                phone: '(555) 123-4567',
                serviceAddress: '123 Main Street, Anytown CA',
                installationDate: '2025-07-29',
                installationTime: '2:00 PM',
                leadSize: '2GIG',
                isReferral: false,
                referralSource: '',
                orderNumber: '',
                notes: '',
                confidence: 90
              }]
            })
          }
        }],
        usage: { total_tokens: 200 }
      };

      const Groq = require('groq-sdk').default;
      const mockGroq = new Groq();
      mockGroq.chat.completions.create
        .mockResolvedValueOnce(mockGroqResponse) // Format detection
        .mockResolvedValueOnce(customerResponse) // Data extraction
        .mockResolvedValueOnce({ // Validation
          choices: [{ message: { content: JSON.stringify({ overallQuality: 85, issues: [], confidenceAdjustments: [] }) } }],
          usage: { total_tokens: 50 }
        });

      const result = await parser.parse(AI_TEST_DATA.CUSTOMER_LIST_UNSTRUCTURED);

      expect(result.formatDetected).toBe('FREE_TEXT');
      expect(result.customers).toHaveLength(1);
      expect(result.customers[0].name).toBe('John Smith');
    });
  });

  describe('Data Extraction', () => {
    test('should extract customers from unstructured text', async () => {
      const customerResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              customers: [
                {
                  name: 'John Smith',
                  email: 'john.smith@gmail.com',
                  phone: '(555) 123-4567',
                  serviceAddress: '123 Main Street, Anytown CA',
                  installationDate: '2025-07-29',
                  installationTime: '2:00 PM',
                  leadSize: '2GIG',
                  isReferral: false,
                  referralSource: '',
                  orderNumber: '',
                  notes: '',
                  confidence: 90
                },
                {
                  name: 'Jane Doe',
                  email: 'jane.doe@hotmail.com',
                  phone: '(555) 987-6543',
                  serviceAddress: '456 Oak Avenue',
                  installationDate: '2025-07-30',
                  installationTime: '10:00 AM',
                  leadSize: '1GIG',
                  isReferral: false,
                  referralSource: '',
                  orderNumber: '',
                  notes: '',
                  confidence: 85
                }
              ]
            })
          }
        }],
        usage: { total_tokens: 300 }
      };

      const Groq = require('groq-sdk').default;
      const mockGroq = new Groq();
      mockGroq.chat.completions.create
        .mockResolvedValueOnce(mockGroqResponse)
        .mockResolvedValueOnce(customerResponse)
        .mockResolvedValueOnce({
          choices: [{ message: { content: JSON.stringify({ overallQuality: 85, issues: [], confidenceAdjustments: [] }) } }],
          usage: { total_tokens: 50 }
        });

      const result = await parseUniversalDataWithAI(AI_TEST_DATA.CUSTOMER_LIST_UNSTRUCTURED);

      expect(result.customers).toHaveLength(2);
      expect(result.customers[0].email).toBe('john.smith@gmail.com');
      expect(result.customers[1].email).toBe('jane.doe@hotmail.com');
    });

    test('should handle mixed language data', async () => {
      const multilingualResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              customers: [
                {
                  name: 'María García',
                  email: 'maria.garcia@empresa.com',
                  phone: '(555) 111-2222',
                  serviceAddress: '321 Elm Street, Ciudad, CA 90210',
                  installationDate: '2025-08-01',
                  installationTime: '10:00 AM',
                  leadSize: '2GIG',
                  isReferral: false,
                  referralSource: '',
                  orderNumber: '',
                  notes: '',
                  confidence: 88
                },
                {
                  name: 'John Williams',
                  email: 'john.w@company.com',
                  phone: '(555) 333-4444',
                  serviceAddress: '654 Maple Ave, Town, NY 10001',
                  installationDate: '2025-08-02',
                  installationTime: '10:00 AM',
                  leadSize: '1GIG',
                  isReferral: false,
                  referralSource: '',
                  orderNumber: '',
                  notes: '',
                  confidence: 92
                }
              ]
            })
          }
        }],
        usage: { total_tokens: 250 }
      };

      const Groq = require('groq-sdk').default;
      const mockGroq = new Groq();
      mockGroq.chat.completions.create
        .mockResolvedValueOnce(mockGroqResponse)
        .mockResolvedValueOnce(multilingualResponse)
        .mockResolvedValueOnce({
          choices: [{ message: { content: JSON.stringify({ overallQuality: 90, issues: [], confidenceAdjustments: [] }) } }],
          usage: { total_tokens: 40 }
        });

      const result = await parseUniversalDataWithAI(AI_TEST_DATA.MIXED_LANGUAGE_DATA);

      expect(result.customers).toHaveLength(2);
      expect(result.customers[0].name).toBe('María García');
      expect(result.customers[1].name).toBe('John Williams');
    });
  });

  describe('Error Handling and Fallbacks', () => {
    test('should fallback to regex parser when AI fails', async () => {
      const Groq = require('groq-sdk').default;
      const mockGroq = new Groq();
      mockGroq.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const result = await parseUniversalDataWithAI(
        AI_TEST_DATA.CUSTOMER_LIST_UNSTRUCTURED,
        { enableFallback: true }
      );

      expect(result.warnings).toContain('AI parsing failed, used pattern matching fallback');
      expect(result.customers.length).toBeGreaterThan(0);
    });

    test('should handle malformed AI responses', async () => {
      const invalidResponse = {
        choices: [{
          message: {
            content: 'Invalid JSON response'
          }
        }],
        usage: { total_tokens: 50 }
      };

      const Groq = require('groq-sdk').default;
      const mockGroq = new Groq();
      mockGroq.chat.completions.create
        .mockResolvedValueOnce(mockGroqResponse)
        .mockResolvedValueOnce(invalidResponse);

      await expect(parseUniversalDataWithAI(AI_TEST_DATA.CUSTOMER_LIST_UNSTRUCTURED))
        .rejects.toThrow('Failed to parse AI response');
    });

    test('should respect cost thresholds', async () => {
      const expensiveResponse = {
        choices: [{ message: { content: JSON.stringify({ customers: [] }) } }],
        usage: { total_tokens: 100000 } // Very high token count
      };

      const Groq = require('groq-sdk').default;
      const mockGroq = new Groq();
      mockGroq.chat.completions.create
        .mockResolvedValueOnce(mockGroqResponse)
        .mockResolvedValueOnce(expensiveResponse);

      const result = await parseUniversalDataWithAI(
        AI_TEST_DATA.CUSTOMER_LIST_UNSTRUCTURED,
        { costThreshold: 0.01 } // Very low threshold
      );

      expect(result.warnings.some(w => w.includes('Cost threshold exceeded'))).toBe(true);
    });
  });

  describe('Configuration Presets', () => {
    test('should apply FAST_AND_CHEAP preset correctly', async () => {
      const parser = new AIDataParser(AI_PARSER_PRESETS.FAST_AND_CHEAP);
      expect(parser).toBeDefined();
    });

    test('should apply BALANCED preset correctly', async () => {
      const parser = new AIDataParser(AI_PARSER_PRESETS.BALANCED);
      expect(parser).toBeDefined();
    });

    test('should apply HIGH_ACCURACY preset correctly', async () => {
      const parser = new AIDataParser(AI_PARSER_PRESETS.HIGH_ACCURACY);
      expect(parser).toBeDefined();
    });
  });

  describe('Caching Functionality', () => {
    test('should cache results when enabled', async () => {
      const customerResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              customers: [{
                name: 'John Smith',
                email: 'john@test.com',
                phone: '555-123-4567',
                serviceAddress: '123 Main St',
                installationDate: '2025-07-29',
                installationTime: '10:00 AM',
                leadSize: '2GIG',
                isReferral: false,
                referralSource: '',
                orderNumber: '',
                notes: '',
                confidence: 90
              }]
            })
          }
        }],
        usage: { total_tokens: 100 }
      };

      const Groq = require('groq-sdk').default;
      const mockGroq = new Groq();
      mockGroq.chat.completions.create
        .mockResolvedValue(mockGroqResponse)
        .mockResolvedValue(customerResponse)
        .mockResolvedValue({
          choices: [{ message: { content: JSON.stringify({ overallQuality: 90, issues: [], confidenceAdjustments: [] }) } }],
          usage: { total_tokens: 30 }
        });

      const parser = new AIDataParser({ enableCaching: true });

      // First call
      const result1 = await parser.parse('test data');

      // Second call should use cache
      const result2 = await parser.parse('test data');

      expect(result2.warnings).toContain('Result served from cache');
    });
  });
});

describe('Security Module Integration', () => {
  describe('PII Detection', () => {
    test('should detect and handle sensitive data', async () => {
      const security = createSecurityModule(SECURITY_PRESETS.STANDARD);

      const result = await security.validateSecurityRequirements(AI_TEST_DATA.SENSITIVE_DATA_TEST);

      expect(result.piiAnalysis.hasPII).toBe(true);
      expect(result.piiAnalysis.riskLevel).toBe('HIGH');
      expect(result.piiAnalysis.piiTypes).toContain('SSN');
      expect(result.piiAnalysis.piiTypes).toContain('CREDIT_CARD');
    });

    test('should sanitize sensitive information', async () => {
      const security = createSecurityModule(SECURITY_PRESETS.STANDARD);

      const result = await security.validateSecurityRequirements(AI_TEST_DATA.SENSITIVE_DATA_TEST);

      expect(result.sanitizedData).not.toContain('123-45-6789');
      expect(result.sanitizedData).not.toContain('4532-1234-5678-9012');
      expect(result.sanitizedData).toContain('XXX-XX-XXXX');
      expect(result.sanitizedData).toContain('XXXX-XXXX-XXXX-XXXX');
    });
  });

  describe('Security Presets', () => {
    test('should apply PERMISSIVE preset correctly', () => {
      const security = createSecurityModule(SECURITY_PRESETS.PERMISSIVE);
      expect(security).toBeDefined();
    });

    test('should apply STANDARD preset correctly', () => {
      const security = createSecurityModule(SECURITY_PRESETS.STANDARD);
      expect(security).toBeDefined();
    });

    test('should apply STRICT preset correctly', () => {
      const security = createSecurityModule(SECURITY_PRESETS.STRICT);
      expect(security).toBeDefined();
    });
  });

  describe('Audit Logging', () => {
    test('should log security events when enabled', async () => {
      const security = createSecurityModule({ enableAuditLogging: true });

      await security.validateSecurityRequirements('test data');

      const logs = security.getAuditLogs();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].action).toBe('security_validation');
    });

    test('should generate compliance reports', async () => {
      const security = createSecurityModule(SECURITY_PRESETS.STANDARD);

      // Generate some audit events
      await security.validateSecurityRequirements('test data 1');
      await security.validateSecurityRequirements('test data 2');

      const report = security.generateComplianceReport();

      expect(report.totalEvents).toBe(2);
      expect(report.riskLevel).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
    });
  });
});

describe('Performance and Load Testing', () => {
  test('should handle large datasets efficiently', async () => {
    const startTime = Date.now();

    // Mock successful responses for large dataset
    const Groq = require('groq-sdk').default;
    const mockGroq = new Groq();

    // Mock batch responses
    const batchResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            customers: Array.from({ length: 25 }, (_, i) => ({
              name: `Customer ${i + 1}`,
              email: `customer${i + 1}@test.com`,
              phone: '555-123-4567',
              serviceAddress: `${i + 1} Main St`,
              installationDate: '2025-07-29',
              installationTime: '10:00 AM',
              leadSize: '2GIG',
              isReferral: false,
              referralSource: '',
              orderNumber: '',
              notes: '',
              confidence: 85
            }))
          })
        }
      }],
      usage: { total_tokens: 500 }
    };

    mockGroq.chat.completions.create
      .mockResolvedValueOnce(mockGroqResponse) // Format detection
      .mockResolvedValue(batchResponse); // Multiple batch responses

    const result = await parseUniversalDataWithAI(
      AI_TEST_DATA.LARGE_DATASET,
      AI_PARSER_PRESETS.FAST_AND_CHEAP
    );

    const processingTime = Date.now() - startTime;

    expect(result.customers.length).toBeGreaterThan(50);
    expect(processingTime).toBeLessThan(30000); // Should complete within 30 seconds
    expect(result.metadata.tokensUsed).toBeGreaterThan(0);
  }, 35000); // 35 second timeout

  test('should respect rate limiting between batches', async () => {
    const startTime = Date.now();

    const Groq = require('groq-sdk').default;
    const mockGroq = new Groq();

    mockGroq.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ customers: [] }) } }],
      usage: { total_tokens: 100 }
    });

    await parseUniversalDataWithAI(
      AI_TEST_DATA.LARGE_DATASET,
      { batchSize: 10 }
    );

    const processingTime = Date.now() - startTime;

    // Should take some time due to rate limiting
    expect(processingTime).toBeGreaterThan(2000); // At least 2 seconds for rate limiting
  }, 10000);
});

describe('Integration Tests', () => {
  test('should work end-to-end with real-world data formats', async () => {
    const realWorldData = `
      Weekly Sales Report - July 2025

      ✓ John Smith - Premium Customer
      john.smith@business.com
      Office: (555) 123-4567
      Service Location: 123 Business Park Drive, Suite 200
      Corporate Account, Anytown, CA 90210
      Installation: Tuesday, July 29th, 2025 @ 9:00 AM - 11:00 AM
      Package: 2 Gig Business Fiber
      Order #: BUS-2025-001234

      ✓ Sarah Johnson - Residential
      sarah.j@homemail.com
      Mobile: 555-987-6543
      Service address: 456 Maple Street
      Anytown, CA 90211
      Install Date: July 30, 2025
      Time: 1PM-3PM
      Plan: 1 Gig Residential
      Referral from: John Smith (existing customer)
    `;

    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            customers: [
              {
                name: 'John Smith',
                email: 'john.smith@business.com',
                phone: '(555) 123-4567',
                serviceAddress: '123 Business Park Drive, Suite 200, Corporate Account, Anytown, CA 90210',
                installationDate: '2025-07-29',
                installationTime: '9:00 AM - 11:00 AM',
                leadSize: '2GIG',
                isReferral: false,
                referralSource: '',
                orderNumber: 'BUS-2025-001234',
                notes: 'Premium Customer, Business Account',
                confidence: 95
              },
              {
                name: 'Sarah Johnson',
                email: 'sarah.j@homemail.com',
                phone: '(555) 987-6543',
                serviceAddress: '456 Maple Street, Anytown, CA 90211',
                installationDate: '2025-07-30',
                installationTime: '1:00 PM - 3:00 PM',
                leadSize: '1GIG',
                isReferral: true,
                referralSource: 'John Smith (existing customer)',
                orderNumber: '',
                notes: 'Residential',
                confidence: 92
              }
            ]
          })
        }
      }],
      usage: { total_tokens: 400 }
    };

    const Groq = require('groq-sdk').default;
    const mockGroq = new Groq();
    mockGroq.chat.completions.create
      .mockResolvedValueOnce(mockGroqResponse)
      .mockResolvedValueOnce(mockResponse)
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify({ overallQuality: 93, issues: [], confidenceAdjustments: [] }) } }],
        usage: { total_tokens: 50 }
      });

    const result = await parseUniversalDataWithAI(realWorldData);

    expect(result.customers).toHaveLength(2);
    expect(result.customers[0].orderNumber).toBe('BUS-2025-001234');
    expect(result.customers[1].isReferral).toBe(true);
    expect(result.customers[1].referralSource).toContain('John Smith');
  });
});

// Export test utilities for integration testing
export const aiTestDataSamples = AI_TEST_DATA;

export function runAIParsingTests() {
  console.log('🤖 Running AI-Powered Data Parser Tests...\n');

  Object.entries(AI_TEST_DATA).forEach(([format, data]) => {
    console.log(`\n🧪 Testing ${format}:`);
    console.log('─'.repeat(50));
    console.log(`Data length: ${data.length} characters`);
    console.log(`Sample: ${data.substring(0, 100)}...`);
  });

  console.log('\n✅ AI Testing Setup Complete!');
}