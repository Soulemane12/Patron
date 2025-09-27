// Test the multi-pass validation system with incomplete data
const testDataWithMissingInfo = `
✓ Renee Gaudet - reneegaudet1@gmail.com
Service address: 440 E McPherson Dr
Mebane, NC 27302
Installation: July 28, 2025 - 4-6 p.m.
2 Gig

✓ Frank Galloway
Email somewhere: fgalloway@atlantisapp.io
Phone: (336) 234-5678
Address: 202-1595 Bedford Highway
Bedford, NS B4A 3X6
July 30, 2025
1 Gig

✓ John Smith - (555) 987-6543
123 Main Street
Halifax, NS B3H 1T1
Email: johnsmith@email.com
Installation: July 31, 2025 - 10am-12pm
`;

async function testMultiPassSystem() {
  try {
    console.log('🔍 TESTING MULTI-PASS VALIDATION SYSTEM');
    console.log('=========================================\n');

    console.log('📋 Test Data (with deliberately scattered information):');
    console.log('- Customer 1: Missing phone number');
    console.log('- Customer 2: Missing installation time');
    console.log('- Customer 3: Email and phone on different lines\n');

    const response = await fetch('http://localhost:3000/api/preview-batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer soulemane'
      },
      body: JSON.stringify({
        batchText: testDataWithMissingInfo,
        useAI: true,
        aiConfig: 'MAXIMUM_ACCURACY'
      })
    });

    const result = await response.json();

    console.log('📊 MULTI-PASS RESULTS:');
    console.log('=======================');
    console.log('Status:', response.status);
    console.log('Customers found:', result.customers?.length || 0);

    if (result.customers && result.customers.length > 0) {
      console.log('\n👥 EXTRACTED CUSTOMERS (After Multi-Pass):');
      console.log('==========================================');

      result.customers.forEach((customer, index) => {
        console.log(`\n${index + 1}. ${customer.name}`);
        console.log(`   Email: ${customer.email}`);
        console.log(`   Phone: ${customer.phone}`);
        console.log(`   Address: ${customer.serviceAddress}`);
        console.log(`   Date: ${customer.installationDate}`);
        console.log(`   Time: ${customer.installationTime}`);
        console.log(`   Plan: ${customer.leadSize}`);

        // Quality assessment
        const completenessScore = [
          customer.email !== 'customer@example.com' && customer.email.includes('@'),
          customer.phone !== '555-000-0000',
          customer.serviceAddress !== 'Address not provided' && customer.serviceAddress.length > 10,
          customer.installationTime !== '10:00 AM',
          customer.installationDate && customer.installationDate !== '2025-01-01'
        ].filter(Boolean).length;

        console.log(`   Completeness: ${completenessScore}/5 fields (${Math.round((completenessScore/5)*100)}%)`);
      });

      console.log('\n🔍 QUALITY ANALYSIS:');
      console.log('====================');

      const qualityMetrics = {
        realEmails: result.customers.filter(c => c.email.includes('@') && !c.email.includes('example.com')).length,
        realPhones: result.customers.filter(c => c.phone !== '555-000-0000').length,
        completeAddresses: result.customers.filter(c => c.serviceAddress.length > 20).length,
        specificTimes: result.customers.filter(c => c.installationTime !== '10:00 AM').length,
        totalCustomers: result.customers.length
      };

      console.log(`Real emails: ${qualityMetrics.realEmails}/${qualityMetrics.totalCustomers}`);
      console.log(`Real phones: ${qualityMetrics.realPhones}/${qualityMetrics.totalCustomers}`);
      console.log(`Complete addresses: ${qualityMetrics.completeAddresses}/${qualityMetrics.totalCustomers}`);
      console.log(`Specific times: ${qualityMetrics.specificTimes}/${qualityMetrics.totalCustomers}`);

      const overallScore = Math.round(((qualityMetrics.realEmails + qualityMetrics.realPhones +
                                      qualityMetrics.completeAddresses + qualityMetrics.specificTimes) /
                                      (qualityMetrics.totalCustomers * 4)) * 100);
      console.log(`\n📈 Overall Quality Score: ${overallScore}%`);
    }

    if (result.parseDetails) {
      console.log('\n⚡ PERFORMANCE METRICS:');
      console.log('======================');
      console.log('Processing time:', result.parseDetails.metadata.aiProcessingTime + 'ms');
      console.log('Tokens used:', result.parseDetails.metadata.tokensUsed);
      console.log('Cost:', '$' + result.parseDetails.metadata.costEstimate.toFixed(4));
      console.log('Cost per customer:', '$' + (result.parseDetails.metadata.costEstimate / (result.customers?.length || 1)).toFixed(4));
    }

    if (result.error) {
      console.log('\n❌ ERROR:', result.error);
    }

  } catch (error) {
    console.error('\n💥 TEST FAILED:', error.message);
  }
}

testMultiPassSystem();