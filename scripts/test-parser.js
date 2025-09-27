#!/usr/bin/env node

/**
 * CLI tool to test the Universal Data Parser
 * Usage: node scripts/test-parser.js [command] [options]
 */

const fs = require('fs');
const path = require('path');

// Since we're in a Node.js context and the parser is TypeScript,
// we'll create a simple JavaScript version for testing
function testParser() {
  console.log('🧪 Universal Data Parser - CLI Test Tool');
  console.log('=' .repeat(50));

  // Sample test data
  const testData = `
✓ John Smith
john.smith@gmail.com
(555) 123-4567
Service address: 123 Main Street
Anytown, CA 90210
Installation: Tuesday, July 29, 2025
12-2pm
2GIG

Jane Doe, jane@email.com, 555-987-6543, 456 Oak Ave, July 30, 10am, 1GIG

Bob Wilson | bob@email.com | 555-555-5555 | 789 Pine St | July 31 | 3pm | 500MB
`;

  console.log('📥 Test Data:');
  console.log(testData);
  console.log('\n📊 Parser Analysis:');

  // Simple analysis
  const lines = testData.trim().split('\n').filter(line => line.trim());
  const emails = testData.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  const phones = testData.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || [];

  console.log(`✅ Lines detected: ${lines.length}`);
  console.log(`📧 Emails found: ${emails.length} (${emails.join(', ')})`);
  console.log(`📞 Phones found: ${phones.length} (${phones.join(', ')})`);

  // Format detection
  let format = 'UNKNOWN';
  if (testData.includes('✓')) format = 'SALES_REPORT';
  else if (testData.includes('|')) format = 'PIPE_DELIMITED';
  else if (testData.includes(',')) format = 'CSV';

  console.log(`📋 Format detected: ${format}`);
  console.log(`🎯 Estimated customers: ${emails.length}`);

  console.log('\n✅ Test completed! The actual Universal Data Parser provides much more detailed analysis.');
}

function showHelp() {
  console.log(`
Universal Data Parser - CLI Test Tool

Usage:
  node scripts/test-parser.js [command]

Commands:
  test        Run basic parser test
  help        Show this help message

Examples:
  node scripts/test-parser.js test
  node scripts/test-parser.js help

For full functionality, integrate the TypeScript parser into your application.
`);
}

// Main CLI logic
const command = process.argv[2] || 'help';

switch (command) {
  case 'test':
    testParser();
    break;
  case 'help':
  default:
    showHelp();
    break;
}