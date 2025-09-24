# User Approval System Implementation

This document describes the user approval system that has been implemented to require admin approval for all new user sign-ins.

## Overview

The system now requires that every user who signs in must be approved by an administrator before they can access the website. Users will see a "pending approval" message if they try to log in before being approved.

## Features

1. **Automatic Approval Check**: All login attempts are checked against an approval status
2. **Admin Approval Interface**: Admin panel at `/soulemane` allows approving/disapproving users
3. **Pending User Notifications**: Users see clear messages when their account needs approval
4. **Existing User Protection**: All existing users are automatically approved during migration

## Implementation Details

### Database Changes

- Added approval columns to existing `user_status` table:
  - `is_approved` (boolean): Whether user is approved
  - `approved_at` (timestamp): When user was approved
  - `approved_by` (text): Who approved the user

### API Endpoints

1. **`/api/check-approval`**: Checks if a user is approved
2. **`/api/admin/users/approve`**: Allows admins to approve/disapprove users
3. **Updated `/api/admin/users`**: Now includes approval status in user data

### UI Changes

1. **Admin Panel (`/soulemane`)**:
   - New "Approval" column showing user approval status
   - Approve/Disapprove buttons for each user
   - Visual indicators (yellow highlight for pending users)

2. **Login Flow**:
   - Approval check after successful authentication
   - Clear error messages for pending approval
   - Automatic sign-out for unapproved users

## Setup Instructions

1. **Run Database Migration**:
   ```sql
   -- Execute the SQL in migration-add-user-approval.sql
   -- This will add approval columns and set existing users as approved
   ```

2. **Test the System**:
   - Existing users should continue to work normally
   - New sign-ups will be pending approval by default
   - Admins can manage approvals at `/soulemane`

## Usage Workflow

### For New Users:
1. User signs up and attempts to log in
2. System checks approval status
3. If not approved: User sees "pending approval" message
4. Admin approves user in `/soulemane` panel
5. User can now log in successfully

### For Admins:
1. Go to `/soulemane` and log in with password "soulemane"
2. Click "Load All Data" to see user list
3. Users needing approval will be highlighted in yellow
4. Click "Approve" button next to pending users
5. Users can immediately log in after approval

## Security Features

- All approval checks happen server-side
- Users are automatically signed out if not approved
- Approval status is verified on every login attempt
- Admin authentication required for approval actions

## Migration Safety

- All existing users are automatically approved
- System gracefully handles missing approval data
- Fallback behavior allows login if approval check fails
- No existing functionality is broken

## Troubleshooting

- **User can't log in**: Check approval status in admin panel
- **Admin can't access panel**: Verify password is "soulemane"
- **Migration issues**: Check database connection and permissions
- **API errors**: Check server logs for detailed error messages