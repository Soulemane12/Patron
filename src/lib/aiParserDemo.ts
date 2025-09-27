/**
 * AI Data Parser Demo Script
 * Showcases the capabilities of the AI-powered universal data parser
 */

import { parseUniversalDataWithAI, AI_PARSER_PRESETS } from './aiDataParser';
import { createSecurityModule, SECURITY_PRESETS } from './aiParserSecurity';

// Demo data samples showcasing various formats and complexities
const DEMO_DATA = {
  'Unstructured Email': `
    Hi team,

    Here are the new customers from this week's sales calls:

    John Smith really wants our 2 gig service. You can reach him at john.smith@tech-company.com
    or call (555) 123-4567. He's located at 123 Tech Drive, Innovation City, CA 94025.
    He's flexible on installation but prefers sometime next Tuesday morning.

    Also got Jane Doe signed up! Her email is jane.doe@startup.io and her phone is 555-987-6543.
    She's at 456 Startup Lane, Unit 2B, and wants our 1 gig plan. Installation on July 30th
    would work best, afternoon preferred.

    Bob Wilson from bob@consulting.com (phone: 555.555.5555) needs our basic 500MB package.
    His office is at 789 Business Center, Suite 100. Any time July 31st works for him.

    Thanks!
  `,

  'Mixed Language Support': `
    Nuevos clientes esta semana:

    Cliente: María García
    Correo: maria.garcia@empresa.mx
    Teléfono: +52 55 1234 5678
    Dirección: Av. Reforma 123, Ciudad de México
    Fecha preferida: 2 de agosto
    Plan: 2 Gig

    客户信息:
    姓名: 李明
    邮箱: li.ming@company.cn
    电话: +86 138 0013 8000
    地址: 北京市朝阳区建国门外大街1号
    安装日期: 8月3日
    套餐: 1 Gig

    Customer: John Williams
    Email: j.williams@corp.com
    Phone: (555) 777-8888
    Address: 321 Corporate Blvd, Business City, NY 10001
    Install: Aug 4, 2025 - Morning
    Package: 2GIG Business
  `,

  'Malformed JSON Recovery': `
    [
      {
        "name": "Alice Johnson",
        "email": "alice@tech.com",
        "phone": "555-111-2222",
        "address": "100 Tech Street",
        "date": "2025-08-01",
        "plan": "2GIG"
      },
      {
        "name": "Missing Quote Bob,
        "email": "bob@broken.com",
        "phone": "555-333-4444"
        // Missing closing bracket and comma
      {
        "name": "Charlie Brown",
        "email": "charlie@peanuts.com",
        "phone": "555-555-6666",
        "incomplete":
      }
    ]
  `,

  'Sales Report Format': `
    Weekly Sales Report - Week of July 28, 2025
    ===========================================

    Total Installations: 8
    Revenue: $2,400

    Customer Details:
    ----------------

    ✓ Premium Customer: David Park
      Email: david.park@enterprise.com
      Business Line: (555) 888-9999
      Service Address: 500 Enterprise Way, Business District
      Installation: Monday, August 5th @ 8:00 AM - 10:00 AM
      Package: 2 Gig Business + WiFi Pro
      Order Number: ENT-2025-789
      Notes: Requires dedicated fiber line, security protocols needed

    ✓ Residential: Emma Thompson
      Personal Email: emma.thompson@email.com
      Mobile: 555-222-3333
      Home Address: 250 Suburban Lane, Hometown, CA 90210
      Preferred Date: Tuesday, August 6th
      Time Window: 1:00 PM - 4:00 PM
      Plan: 1 Gig Residential
      Referral: From David Park (business customer)
      Special Requests: Pet-friendly installer (has 2 dogs)

    ✓ Student Discount: Alex Rodriguez
      alex.r@university.edu
      Cell: (555) 444-5555
      Dorm Address: 75 University Ave, Room 204, College Town
      Move-in Date: August 10th (flexible)
      Package: 500MB Student Plan
      Payment: Monthly billing to parents
      Emergency Contact: Maria Rodriguez (555) 777-6666
  `,

  'Structured Data with Noise': `
    // Customer Database Export - July 2025
    // Format: Name | Email | Phone | Address | Install Date | Plan
    // Note: Some records may be incomplete due to system migration

    John Anderson | john.a@company.com | 555-123-7890 | 400 Main Street | Aug 7 | 2GIG
    Sarah | sarah@incomplete.com | | Missing address | | 1GIG
    | missing.name@email.com | 555-999-8888 | 600 Oak Drive | August 8 | 500MB
    Mike Johnson | mike.johnson@corp.com | (555) 777-1111 | 700 Pine Avenue, Suite 5 | Aug 9, 2025 | 2 Gig Fiber

    --- Corrupted Record ---
    Invalid data: @@@@####$$$$

    --- Additional Notes ---
    - All August installations should include new equipment
    - Priority scheduling for business customers
    - Confirm all phone numbers before installation day

    Lisa Chen | lisa.chen@startup.com | 555.456.7890 | 800 Innovation Drive | 08/10/2025 | 1GIG Business
  `
};

/**
 * Demo function to showcase AI parser capabilities
 */
export async function runAIParserDemo() {
  console.log('🤖 AI-Powered Universal Data Parser Demo');
  console.log('==========================================\n');

  // Check if API key is configured
  if (!process.env.GROQ_API_KEY) {
    console.log('❌ GROQ_API_KEY not found in environment variables');
    console.log('💡 To run this demo:');
    console.log('   1. Get a Groq API key from https://console.groq.com');
    console.log('   2. Add GROQ_API_KEY=your_key_here to your .env.local file');
    console.log('   3. Restart your application\n');
    return;
  }

  console.log('✅ Groq API key found - starting demo...\n');

  // Initialize security module
  const security = createSecurityModule(SECURITY_PRESETS.STANDARD);

  for (const [formatName, sampleData] of Object.entries(DEMO_DATA)) {
    console.log(`\n📋 Testing: ${formatName}`);
    console.log('─'.repeat(60));

    try {
      // Security check first
      console.log('🔒 Running security validation...');
      const securityCheck = await security.validateSecurityRequirements(sampleData);

      if (!securityCheck.isValid) {
        console.log('❌ Security validation failed:', securityCheck.errors);
        continue;
      }

      if (securityCheck.warnings.length > 0) {
        console.log('⚠️  Security warnings:', securityCheck.warnings);
      }

      if (securityCheck.piiAnalysis.hasPII) {
        console.log(`🔍 PII detected (${securityCheck.piiAnalysis.riskLevel} risk): ${securityCheck.piiAnalysis.piiTypes.join(', ')}`);
      }

      // Run AI parser
      console.log('🤖 Processing with AI parser...');
      const startTime = Date.now();

      const result = await parseUniversalDataWithAI(
        securityCheck.sanitizedData,
        AI_PARSER_PRESETS.BALANCED
      );

      const processingTime = Date.now() - startTime;

      // Display results
      console.log('\n📊 Results:');
      console.log(`   Format Detected: ${result.formatDetected}`);
      console.log(`   Confidence: ${result.confidence}%`);
      console.log(`   Customers Found: ${result.customers.length}`);
      console.log(`   Processing Time: ${processingTime}ms`);
      console.log(`   AI Processing Time: ${result.metadata.aiProcessingTime}ms`);
      console.log(`   Tokens Used: ${result.metadata.tokensUsed}`);
      console.log(`   Estimated Cost: $${result.metadata.costEstimate.toFixed(4)}`);

      if (result.warnings.length > 0) {
        console.log(`   Warnings: ${result.warnings.length}`);
      }

      if (result.errors.length > 0) {
        console.log(`   Errors: ${result.errors.length}`);
      }

      // Show sample customers
      if (result.customers.length > 0) {
        console.log('\n👥 Sample Customers:');
        result.customers.slice(0, 2).forEach((customer, index) => {
          console.log(`\n   Customer ${index + 1}:`);
          console.log(`     Name: ${customer.name}`);
          console.log(`     Email: ${customer.email}`);
          console.log(`     Phone: ${customer.phone}`);
          console.log(`     Address: ${customer.serviceAddress}`);
          console.log(`     Install Date: ${customer.installationDate}`);
          console.log(`     Install Time: ${customer.installationTime}`);
          console.log(`     Plan: ${customer.leadSize}`);
          console.log(`     Confidence: ${customer.confidence}%`);
          if (customer.isReferral) {
            console.log(`     Referral Source: ${customer.referralSource}`);
          }
          if (customer.orderNumber) {
            console.log(`     Order Number: ${customer.orderNumber}`);
          }
          if (customer.notes) {
            console.log(`     Notes: ${customer.notes}`);
          }
        });

        if (result.customers.length > 2) {
          console.log(`\n   ... and ${result.customers.length - 2} more customers`);
        }
      }

      // Show warnings and errors if any
      if (result.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        result.warnings.forEach(warning => console.log(`     - ${warning}`));
      }

      if (result.errors.length > 0) {
        console.log('\n❌ Errors:');
        result.errors.forEach(error => console.log(`     - ${error}`));
      }

    } catch (error) {
      console.log(`❌ Failed to process ${formatName}:`, error);
    }
  }

  // Generate compliance report
  console.log('\n\n🔒 Security Compliance Report');
  console.log('=============================');
  const complianceReport = security.generateComplianceReport();
  console.log(`Total Security Events: ${complianceReport.totalEvents}`);
  console.log(`Security Violations: ${complianceReport.securityViolations}`);
  console.log(`PII Detections: ${complianceReport.piiDetections}`);
  console.log(`Overall Risk Level: ${complianceReport.riskLevel}`);

  if (complianceReport.recommendations.length > 0) {
    console.log('\nRecommendations:');
    complianceReport.recommendations.forEach(rec => console.log(`  - ${rec}`));
  }

  console.log('\n✅ Demo completed successfully!');
  console.log('\n💡 Key Benefits Demonstrated:');
  console.log('   • Handles ANY data format automatically');
  console.log('   • Understands context and relationships');
  console.log('   • Provides confidence scoring');
  console.log('   • Includes comprehensive security features');
  console.log('   • Falls back gracefully when needed');
  console.log('   • Optimizes costs with intelligent batching');
  console.log('   • Supports multiple languages and character sets');
  console.log('   • Recovers from malformed data structures');
}

/**
 * Performance comparison demo
 */
export async function runPerformanceComparison() {
  console.log('\n⚡ Performance Comparison: AI vs Pattern Matching');
  console.log('================================================\n');

  const testData = DEMO_DATA['Sales Report Format'];

  // Test AI parser
  console.log('🤖 Testing AI Parser...');
  const aiStartTime = Date.now();
  try {
    const aiResult = await parseUniversalDataWithAI(testData, AI_PARSER_PRESETS.FAST_AND_CHEAP);
    const aiTime = Date.now() - aiStartTime;

    console.log(`   AI Processing Time: ${aiTime}ms`);
    console.log(`   AI Customers Found: ${aiResult.customers.length}`);
    console.log(`   AI Confidence: ${aiResult.confidence}%`);
    console.log(`   AI Tokens Used: ${aiResult.metadata.tokensUsed}`);
    console.log(`   AI Cost: $${aiResult.metadata.costEstimate.toFixed(4)}`);

    // Test fallback parser for comparison
    console.log('\n🔧 Testing Pattern Matching Parser...');
    const { parseUniversalData } = await import('./universalDataParser');

    const regexStartTime = Date.now();
    const regexResult = parseUniversalData(testData);
    const regexTime = Date.now() - regexStartTime;

    console.log(`   Pattern Processing Time: ${regexTime}ms`);
    console.log(`   Pattern Customers Found: ${regexResult.customers.length}`);
    console.log(`   Pattern Confidence: ${regexResult.confidence}%`);

    // Comparison
    console.log('\n📊 Comparison Results:');
    console.log(`   Speed Difference: ${aiTime - regexTime}ms (AI overhead)`);
    console.log(`   Accuracy Gain: ${aiResult.customers.length - regexResult.customers.length} more customers`);
    console.log(`   Confidence Gain: +${aiResult.confidence - regexResult.confidence}% confidence`);

    // Quality comparison
    const aiEmails = aiResult.customers.map(c => c.email).filter(e => e.includes('@'));
    const regexEmails = regexResult.customers.map(c => c.email).filter(e => e.includes('@'));

    console.log(`   Valid Emails - AI: ${aiEmails.length}, Pattern: ${regexEmails.length}`);

  } catch (error) {
    console.log('❌ Performance comparison failed:', error);
  }
}

/**
 * Cost analysis demo
 */
export async function runCostAnalysis() {
  console.log('\n💰 Cost Analysis Demo');
  console.log('====================\n');

  const configs = [
    { name: 'Fast & Cheap', config: AI_PARSER_PRESETS.FAST_AND_CHEAP },
    { name: 'Balanced', config: AI_PARSER_PRESETS.BALANCED },
    { name: 'High Accuracy', config: AI_PARSER_PRESETS.HIGH_ACCURACY }
  ];

  const testData = DEMO_DATA['Unstructured Email'];

  for (const { name, config } of configs) {
    console.log(`📊 Testing ${name} Configuration:`);

    try {
      const result = await parseUniversalDataWithAI(testData, config);

      console.log(`   Tokens Used: ${result.metadata.tokensUsed}`);
      console.log(`   Cost: $${result.metadata.costEstimate.toFixed(4)}`);
      console.log(`   Processing Time: ${result.metadata.aiProcessingTime}ms`);
      console.log(`   Customers Found: ${result.customers.length}`);
      console.log(`   Average Confidence: ${Math.round(result.customers.reduce((sum, c) => sum + c.confidence, 0) / result.customers.length)}%`);
      console.log(`   Cost per Customer: $${(result.metadata.costEstimate / result.customers.length).toFixed(6)}\n`);

    } catch (error) {
      console.log(`   ❌ Failed: ${error}\n`);
    }
  }
}

// Export demo functions
export { DEMO_DATA };

// Main demo runner
if (require.main === module) {
  console.log('🚀 Starting AI Parser Demo...\n');

  runAIParserDemo()
    .then(() => runPerformanceComparison())
    .then(() => runCostAnalysis())
    .then(() => {
      console.log('\n🎉 All demos completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Demo failed:', error);
      process.exit(1);
    });
}