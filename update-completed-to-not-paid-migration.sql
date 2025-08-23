-- Migration script to update existing completed customers to not_paid status
-- This will help you understand your current data and update it appropriately
-- Run this in your Supabase SQL editor

-- Step 1: See current status distribution
SELECT 'CURRENT STATUS DISTRIBUTION' as info;
SELECT status, COUNT(*) as count 
FROM customers 
GROUP BY status 
ORDER BY status;

-- Step 2: Show customers who are currently 'completed' (these might need to be 'not_paid')
SELECT 'CUSTOMERS CURRENTLY MARKED AS COMPLETED' as info;
SELECT id, name, email, status, installation_date, created_at
FROM customers 
WHERE status = 'completed'
ORDER BY installation_date DESC;

-- Step 3: Show customers who are currently 'paid'
SELECT 'CUSTOMERS CURRENTLY MARKED AS PAID' as info;
SELECT id, name, email, status, installation_date, created_at
FROM customers 
WHERE status = 'paid'
ORDER BY installation_date DESC;

-- Step 4: Update logic - if you want to change 'completed' to 'not_paid'
-- UNCOMMENT THE NEXT LINE IF YOU WANT TO MAKE THIS CHANGE:
-- UPDATE customers SET status = 'not_paid' WHERE status = 'completed';

-- Step 5: After running the update, verify the changes
-- SELECT 'AFTER UPDATE - STATUS DISTRIBUTION' as info;
-- SELECT status, COUNT(*) as count 
-- FROM customers 
-- GROUP BY status 
-- ORDER BY status;

-- Step 6: Show final breakdown
SELECT 'FINAL ANALYTICS BREAKDOWN' as info;
SELECT 
  'Total Customers' as metric, COUNT(*) as count FROM customers
UNION ALL
SELECT 
  'Active Customers' as metric, COUNT(*) as count FROM customers WHERE status = 'active' OR status IS NULL
UNION ALL
SELECT 
  'Completed Installations' as metric, COUNT(*) as count FROM customers WHERE status IN ('completed', 'not_paid', 'paid')
UNION ALL
SELECT 
  'Not Paid Customers' as metric, COUNT(*) as count FROM customers WHERE status = 'not_paid'
UNION ALL
SELECT 
  'Paid Customers' as metric, COUNT(*) as count FROM customers WHERE status = 'paid'
UNION ALL
SELECT 
  'Cancelled Customers' as metric, COUNT(*) as count FROM customers WHERE status = 'cancelled';
