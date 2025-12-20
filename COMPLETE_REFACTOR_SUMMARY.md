# Complete Clean Slate Refactor Summary

## Overview
This document summarizes the complete database and frontend refactor for the Marble Sampling Management System. This is a **CLEAN SLATE** approach - all existing data will be deleted.

---

## What Was Implemented

### 1. Database Schema (Complete Clean Slate)
**File:** `supabase/migrations/200_complete_clean_slate.sql`

**Actions:**
- Dropped ALL existing tables: `requests`, `profiles`, `request_history`, `clients`
- Dropped ALL existing types/enums
- Created fresh `user_role` ENUM: `'admin'`, `'coordinator'`, `'requester'`, `'maker'`
- Created fresh `profiles` table with:
  - `role` (user_role, default: 'requester')
  - `full_name` (Text)
  - `phone` (Text, NOT NULL)
  - `department` (Text, nullable - only for requesters)
- Created `requests` table with complete new schema
- Created **SECURITY DEFINER** function `get_my_role()` to prevent RLS recursion
- Created **SECURITY DEFINER** function `delete_user_by_admin(target_user_id UUID)`:
  - Checks if current user is admin
  - Deletes user from `auth.users` (cascades to profile)
  - Raises exception if not admin or user not found
- Created triggers for auto-profile creation, timestamps
- Created RLS policies using `get_my_role()`
- Created indexes for performance

### 2. Signup Flow Refactor
**File:** `src/pages/auth/Signup.tsx`

**Features:**
- **Role Selection Dropdown:**
  - Options: Requester, Maker, Coordinator
  - **NO Admin option** (Admins promoted manually)
  - Helper text: "Admin access is granted manually by existing admins"
- **Department Dropdown:**
  - **Conditional Visibility:** Only shown if Role = "Requester"
  - **Conditional Validation:** Required ONLY if Role = "Requester"
  - Options: Sales, Marketing, Logistics
  - Auto-clears when role changes
- **Phone Number:**
  - **Mandatory** with 10-digit validation
  - Placeholder: `"1234567890"`
- **Metadata Passing:**
  - Passes `role`, `phone` to all users
  - Passes `department` only if role is requester

### 3. Admin User Management
**File:** `src/pages/admin/UserManagement.tsx`

**Features:**
- **User List Table/Cards:**
  - Displays: Name, Email, Phone, **Department**, Status, Role
  - Desktop: Table view
  - Mobile: Card view
- **Change Role Dropdown:**
  - Can select: Requester, Maker, Coordinator, **Admin**
  - Admins can promote other users to Admin
- **Delete User Button:**
  - Red trash icon button
  - **Confirmation Dialog:** "Are you absolutely sure?"
  - Shows user name in confirmation
  - **Safety Check:** Cannot delete yourself
  - Calls `delete_user_by_admin` RPC function
  - Invalidates user cache after deletion

### 4. API Updates
**File:** `src/lib/api/users.ts`

**New Function:**
```typescript
export function useDeleteUser() {
  // Calls supabase.rpc('delete_user_by_admin', { target_user_id: userId })
  // Invalidates all-users cache on success
}
```

### 5. UI Components
**File:** `src/components/ui/alert-dialog.tsx` (NEW)
- Added AlertDialog component from Radix UI
- Used for delete confirmation dialogs

---

## Setup Instructions

### Step 1: Run the Migration
1. Open Supabase Dashboard → SQL Editor
2. Open the file: `supabase/migrations/200_complete_clean_slate.sql`
3. Click "Run"
4. Verify success (all tables dropped and recreated)

### Step 2: Sign Up Your First Admin
1. Go to your app's `/signup` page
2. Fill out the form:
   - Full Name: `Your Name`
   - Email: `admin@yourdomain.com`
   - **Role:** Select `Requester` (temporary - you'll promote yourself)
   - **Department:** Select any (e.g., `Sales`)
   - Phone: `1234567890`
   - Password: Your secure password
3. Click "Sign Up"

### Step 3: Promote Yourself to Admin
1. Go to Supabase Dashboard → Authentication → Users
2. Find your user and copy the **User ID** (UUID)
3. Go to SQL Editor and run:
   ```sql
   UPDATE public.profiles
   SET role = 'admin'
   WHERE id = 'YOUR-USER-ID-HERE';
   ```
4. **Optional:** Clear the department field:
   ```sql
   UPDATE public.profiles
   SET department = NULL
   WHERE id = 'YOUR-USER-ID-HERE';
   ```

### Step 4: Log In and Test
1. Log out of your app
2. Log back in with your admin credentials
3. You should now see "User Management" in your navigation

---

## Testing Checklist

### Test 1: Signup with Different Roles
- [ ] Sign up as **Requester** (Sales) - Department should be visible and required
- [ ] Sign up as **Maker** - Department should be hidden
- [ ] Sign up as **Coordinator** - Department should be hidden
- [ ] Verify all users appear in Supabase `profiles` table with correct roles
- [ ] Verify requesters have department, others have NULL

### Test 2: Admin User Management
- [ ] Log in as admin
- [ ] Navigate to User Management page
- [ ] Verify table shows all users with Name, Email, Phone, Department, Status, Role
- [ ] **Change Role:** Select a user and change their role (e.g., Requester → Coordinator)
- [ ] Verify role updates successfully and badge changes color
- [ ] **Promote to Admin:** Select a user and promote to Admin
- [ ] Verify the user can now access User Management

### Test 3: Delete User Functionality
- [ ] Click the red delete button next to a user (NOT yourself)
- [ ] Verify confirmation dialog appears with user's name
- [ ] Click "Cancel" - dialog closes, user not deleted
- [ ] Click delete button again
- [ ] Click "Delete User" - user should be deleted
- [ ] Verify user removed from list
- [ ] Verify user removed from Supabase Auth → Users
- [ ] Verify user removed from `profiles` table
- [ ] **Try to delete yourself** - should show error: "You cannot delete your own account"

### Test 4: Request Creation
- [ ] Log in as requester
- [ ] Create a new request
- [ ] **Section 1** should show Name, Department, Mobile No (read-only)
- [ ] Verify these auto-fill from your profile
- [ ] Complete and submit request
- [ ] Verify request appears in database with correct department and mobile_no

### Test 5: RLS Security
- [ ] Log in as Maker - verify they can only see assigned requests
- [ ] Log in as Requester - verify they can only see their own requests
- [ ] Log in as Coordinator - verify they can see all requests
- [ ] Log in as Admin - verify they can see all requests and all users

---

## Key Security Features

1. **Admin Delete Function:**
   - SECURITY DEFINER ensures proper permissions
   - Checks current user role before allowing deletion
   - Raises exception if not admin
   - Cascading delete removes user from auth.users and profiles

2. **RLS Policies:**
   - Use `get_my_role()` SECURITY DEFINER function to prevent recursion
   - Admin can view/update all profiles
   - Users can only view/update own profile
   - Coordinators can view all profiles (for assignment)

3. **Signup Security:**
   - Cannot sign up as Admin directly
   - All users default to their selected role (or 'requester')
   - Admin promotion requires SQL access or existing admin

---

## File Changes Summary

**New Files:**
- `supabase/migrations/200_complete_clean_slate.sql`
- `FIRST_ADMIN_SETUP.md`
- `COMPLETE_REFACTOR_SUMMARY.md`
- `src/components/ui/alert-dialog.tsx`

**Modified Files:**
- `src/pages/auth/Signup.tsx` - Added role and conditional department
- `src/pages/admin/UserManagement.tsx` - Added delete functionality with confirmation
- `src/lib/api/users.ts` - Added `useDeleteUser()` hook

---

## Rollback Instructions

If you need to rollback this migration:

1. **Restore from Backup:** If you have a backup, restore it
2. **Manual Rollback:** Re-run your previous migration files in order

**WARNING:** This clean slate migration is **IRREVERSIBLE** without a backup. All data is permanently deleted.

---

## Support

If you encounter issues:
1. Check Supabase Logs for RPC function errors
2. Verify RLS policies are active
3. Check browser console for frontend errors
4. Verify `get_my_role()` function returns correct role

---

## Success Criteria

✅ Clean database with new schema
✅ Signup flow with role selection and conditional department
✅ Admin can view all users with department column
✅ Admin can change any user's role (including promote to Admin)
✅ Admin can delete users with confirmation dialog
✅ Admin cannot delete themselves
✅ Delete function securely checks admin role before allowing deletion
✅ All RLS policies prevent infinite recursion
✅ Requesters have department auto-filled in request form
✅ Other roles do not have department field
