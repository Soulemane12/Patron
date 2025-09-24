# Batch Lead Import Feature Guide

This guide explains how to use the new batch import feature to add multiple customers at once from your spreadsheet data.

## Overview

The batch import feature allows you to:
- Copy data directly from Excel, Google Sheets, or CSV files
- Import multiple customer records in one operation
- See detailed success/failure results
- Automatically parse different data formats

## How to Use

### 1. Access Batch Import
1. Go to the "Add New Lead" section
2. Click the "Batch Import" toggle button
3. You'll see the batch import interface

### 2. Prepare Your Data
Your spreadsheet data can be in various formats. The system will automatically detect:

**Supported Data Points:**
- Customer Name
- Email Address
- Phone Number
- Service Address
- Installation Date
- Installation Time
- Lead Size (500MB, 1GIG, 2GIG)

### 3. Paste Your Data
Copy your data from your spreadsheet and paste it into the large text area. The system supports:

**Excel/Google Sheets Format:**
```
John Smith, 555-123-4567, john@email.com, 123 Main St, June 15th, 2pm
Jane Doe, 555-987-6543, jane@email.com, 456 Oak Ave, June 16th, 10am
Bob Wilson, 555-555-5555, bob@email.com, 789 Pine St, June 17th, 3pm
```

**Tab-Separated Format:**
```
John Smith	555-123-4567	john@email.com	123 Main St	June 15th	2pm
Jane Doe	555-987-6543	jane@email.com	456 Oak Ave	June 16th	10am
```

**Mixed Format (AI will parse):**
```
Customer: John Smith, phone 555-123-4567, email john@email.com, address 123 Main St, scheduled June 15th at 2pm, 2GIG package
Jane Doe - 555-987-6543 - jane@email.com - 456 Oak Ave - June 16th 10am - 1GIG
Bob Wilson | 555-555-5555 | bob@email.com | 789 Pine St | June 17th | 3pm
```

### 4. Process the Batch
1. Click "Process Batch Leads"
2. The system will parse and validate each row
3. You'll see a progress indicator while processing
4. Results will show success/failure counts

### 5. Review Results
After processing, you'll see:
- ✅ **Successful imports**: Number of customers added successfully
- ❌ **Failed imports**: Number of rows that couldn't be processed
- **Error details**: Expandable list showing specific issues for failed rows

## Data Format Requirements

### Required Fields
- **Name**: Customer's full name
- **Email**: Valid email address
- **Phone**: Phone number (various formats accepted)

### Optional Fields
- **Address**: Service address (defaults to "Address not provided")
- **Installation Date**: Date of installation (defaults to 7 days from now)
- **Installation Time**: Time of installation (defaults to "10:00 AM")
- **Lead Size**: Package size - 500MB, 1GIG, or 2GIG (defaults to 2GIG)

### Date Formats Supported
- **MM/DD/YYYY**: 06/15/2024
- **MM/DD/YY**: 06/15/24
- **Month DD**: June 15th, June 15
- **Month DD, YYYY**: June 15, 2024

### Phone Formats Supported
- (555) 123-4567
- 555-123-4567
- 555.123.4567
- 555 123 4567
- 5551234567

## Smart Parsing Features

The system uses intelligent parsing to:

### Auto-Detection
- **Email**: Looks for @ symbol
- **Phone**: Detects number patterns with dashes, dots, parentheses
- **Dates**: Recognizes month names and date patterns
- **Times**: Finds time patterns (12:30, 2pm, etc.)
- **Addresses**: Identifies longer text strings
- **Names**: Assumes first non-identified text is the name

### Fallback Logic
- If data format is unclear, assumes order: Name, Phone, Email, Address, Date, Time
- Missing dates default to 7 days from current date
- Missing times default to 10:00 AM
- Missing addresses get placeholder text

## Tips for Best Results

### 1. Consistent Formatting
- Keep similar data in the same column position
- Use consistent date formats throughout your data
- Include headers in your first row if helpful (they'll be ignored if not customer data)

### 2. Data Preparation
- Clean up your spreadsheet before copying
- Remove empty rows
- Ensure phone numbers include area codes
- Verify email addresses are valid

### 3. Testing
- Start with a small batch (5-10 rows) to verify the format works
- Check the results and adjust your data format if needed
- Then proceed with your full dataset

### 4. Error Handling
- Review any failed imports in the error details
- Common issues include:
  - Missing required fields (name, email, phone)
  - Invalid email formats
  - Duplicate email addresses
  - Invalid date formats

## Example Workflows

### From Excel
1. Select your customer data in Excel
2. Copy (Ctrl+C)
3. Switch to the batch import tab
4. Paste (Ctrl+V) into the text area
5. Click "Process Batch Leads"

### From Google Sheets
1. Select your data range
2. Copy the selection
3. Paste into the batch import area
4. Process the batch

### From CSV File
1. Open the CSV file in a text editor
2. Copy all the customer data
3. Paste into the batch import area
4. Process the batch

## Troubleshooting

### Common Issues

**"No valid customer data found"**
- Check that you have at least name, email, and phone for each customer
- Ensure data is properly formatted with clear separators

**High failure rate**
- Review your data format
- Try processing a smaller sample first
- Check the error messages for specific issues

**Date parsing issues**
- Use consistent date formats
- Spell out month names fully (June instead of Jun)
- Include the year when possible

### Getting Help
If you encounter issues:
1. Check the error messages in the results section
2. Try reformatting your data
3. Test with a smaller sample first
4. Contact support with specific error messages

## Performance Notes

- Batch processing handles up to 100 customers efficiently
- Each customer is processed individually for better error handling
- Failed imports don't affect successful ones
- All successful imports are immediately available in your pipeline

The batch import feature is designed to save you time while maintaining data accuracy and providing clear feedback on the import process.