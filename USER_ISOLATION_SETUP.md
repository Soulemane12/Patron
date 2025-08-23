# User Data Isolation Setup

This guide will help you implement user-specific data isolation so that each user only sees their own customer data.

## Problem
Currently, all users can see all customer data in the application. This needs to be fixed so that each user only sees their own customers.

## Solution
We've implemented user data isolation by:
1. Adding a `user_id` field to the customers table
2. Implementing Row Level Security (RLS) policies
3. Adding authentication checks to the frontend
4. Updating all database operations to include user context

## Steps to Implement

### 1. Update Database Schema

Run the migration script in your Supabase SQL editor:

```sql
-- Run the contents of migration-add-user-isolation.sql
```

This will:
- Add `user_id` column to the customers table
- Add missing columns (status, is_referral, referral_source, lead_size)
- Create proper RLS policies
- Add indexes for performance

### 2. Assign Existing Data to Users

After running the migration, you need to assign existing customers to specific users:

1. First, check which customers need assignment:
```sql
SELECT id, name, email, created_at FROM customers WHERE user_id IS NULL;
```

2. Assign existing customers to a specific user (replace 'thechosen1351@gmail.com' with the user's email):
```sql
UPDATE customers 
SET user_id = (SELECT id FROM auth.users WHERE email = 'thechosen1351@gmail.com') 
WHERE user_id IS NULL;
```

3. After all customers are assigned, make user_id NOT NULL:
```sql
ALTER TABLE customers ALTER COLUMN user_id SET NOT NULL;
```

### 3. Test the Implementation

1. **Test with the existing user (thechosen1351@gmail.com):**
   - Log in with this account
   - Verify you can see all the existing customers
   - Try adding, editing, and deleting customers

2. **Test with a new user:**
   - Create a new account
   - Verify you see an empty customer list
   - Add some customers and verify they're only visible to you
   - Log out and log back in to verify data persistence

3. **Test data isolation:**
   - Log in with the first user and note some customer names
   - Log out and log in with the second user
   - Verify you cannot see the first user's customers
   - Add customers with the second user
   - Log back in with the first user and verify you cannot see the second user's customers

## Key Changes Made

### Database Changes
- Added `user_id` field to customers table
- Implemented RLS policies for user data isolation
- Added proper indexes for performance

### Frontend Changes
- Added authentication checks to the main page
- Updated all database operations to include user context
- Added user information display and sign-out functionality
- Implemented proper loading states during authentication

### Security Features
- Users can only see, create, update, and delete their own customers
- Authentication is required to access the application
- Automatic redirect to login page for unauthenticated users
- Proper session management with sign-out functionality

## Troubleshooting

### If users see blank pages:
1. Check that the user is properly authenticated
2. Verify that the user has a valid session
3. Check browser console for any errors
4. Ensure the database migration was run successfully

### If users can see other users' data:
1. Verify that RLS policies are properly applied
2. Check that the `user_id` field is being set correctly
3. Ensure all database operations include user context

### If authentication fails:
1. Check Supabase configuration
2. Verify environment variables are set correctly
3. Check that the auth service is properly configured

## Files Modified

- `database-schema.sql` - Updated schema with user isolation
- `migration-add-user-isolation.sql` - Migration script for existing databases
- `src/lib/supabase.ts` - Updated Customer interface
- `src/app/page.tsx` - Added authentication and user-specific data loading
- `src/app/login/page.tsx` - Already implemented
- `src/app/signup/page.tsx` - Already implemented

## Next Steps

After implementing these changes:
1. Test thoroughly with multiple users
2. Monitor for any performance issues
3. Consider adding user management features if needed
4. Implement any additional security measures as required
