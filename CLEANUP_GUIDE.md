# User Cleanup Guide

This guide shows you how to clean up test users and data from your Supabase database.

---

## 🗑️ Method 1: Delete via Supabase Dashboard (Easiest)

### **Step 1: Delete from Authentication**
1. Go to **Supabase Dashboard** → **Authentication** → **Users**
2. Find the test user you want to delete
3. Click the **three dots (...)** on the right
4. Click **"Delete user"**
5. Confirm the deletion

**✅ This automatically deletes:**
- The user from `auth.users`
- The profile from `public.profiles` (CASCADE delete)
- All sessions and tokens

---

## 🗑️ Method 2: Delete via SQL (Best for Multiple Users)

### **Delete a Specific User by Email**

Run this in **Supabase SQL Editor**:

```sql
-- First, find the user ID by email
SELECT id, email FROM auth.users WHERE email = 'test@example.com';

-- Delete the user (replace with the actual UUID)
DELETE FROM auth.users WHERE id = 'your-user-uuid-here';

-- The profile will auto-delete due to CASCADE constraint
```

### **Delete All Test Users at Once**

If you created multiple test users with a pattern (e.g., test1@, test2@):

```sql
-- Delete all users matching a pattern
DELETE FROM auth.users
WHERE email LIKE 'test%@example.com';
```

### **Delete ALL Users (Nuclear Option - Be Careful!)**

⚠️ **WARNING:** This deletes EVERYTHING. Only use in development!

```sql
-- Delete all users from auth
DELETE FROM auth.users;

-- Delete all profiles (should auto-delete with CASCADE)
DELETE FROM public.profiles;

-- Delete all requests
DELETE FROM public.requests;

-- Delete all clients
DELETE FROM public.clients;

-- Reset the request number sequence
ALTER SEQUENCE request_number_seq RESTART WITH 1001;
```

---

## 🗑️ Method 3: Clean Up Orphaned Profiles

If you have profiles without users (shouldn't happen, but just in case):

```sql
-- Find orphaned profiles (profiles with no matching user in auth.users)
SELECT p.id, p.email, p.full_name
FROM public.profiles p
LEFT JOIN auth.users u ON p.id = u.id
WHERE u.id IS NULL;

-- Delete orphaned profiles
DELETE FROM public.profiles
WHERE id NOT IN (SELECT id FROM auth.users);
```

---

## 🗑️ Clean Up Test Data

### **Delete Specific Request**

```sql
-- Find requests
SELECT request_number, client_name, sample_name, created_at
FROM public.requests
ORDER BY created_at DESC;

-- Delete a specific request by request_number
DELETE FROM public.requests
WHERE request_number = 'SMP-1001';

-- OR delete by ID
DELETE FROM public.requests
WHERE id = 'your-request-uuid-here';
```

### **Delete All Test Requests**

```sql
-- Delete all requests from a specific user
DELETE FROM public.requests
WHERE created_by = 'user-uuid-here';

-- Delete all requests created today
DELETE FROM public.requests
WHERE DATE(created_at) = CURRENT_DATE;

-- Delete ALL requests
DELETE FROM public.requests;

-- Reset sequence
ALTER SEQUENCE request_number_seq RESTART WITH 1001;
```

### **Delete Test Clients**

```sql
-- Delete all clients
DELETE FROM public.clients;
```

---

## 🔄 Complete Fresh Start

To completely wipe and restart:

```sql
-- 1. Delete all data
DELETE FROM public.request_history;
DELETE FROM public.requests;
DELETE FROM public.clients;
DELETE FROM public.profiles;
DELETE FROM auth.users;

-- 2. Reset sequences
ALTER SEQUENCE request_number_seq RESTART WITH 1001;

-- 3. Verify everything is clean
SELECT COUNT(*) FROM auth.users;        -- Should be 0
SELECT COUNT(*) FROM public.profiles;   -- Should be 0
SELECT COUNT(*) FROM public.requests;   -- Should be 0
```

---

## ✅ Verify Cleanup

After cleanup, verify everything is clean:

```sql
-- Check auth.users
SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC;

-- Check profiles
SELECT id, email, full_name, role FROM public.profiles ORDER BY created_at DESC;

-- Check requests
SELECT request_number, client_name, status FROM public.requests ORDER BY created_at DESC;
```

---

## 🎯 Best Practices for Testing

1. **Use Consistent Naming**
   - Test users: `test1@example.com`, `test2@example.com`
   - Easy to identify and batch delete

2. **Create Via Signup Page**
   - Always use `/signup` page instead of manual creation
   - Ensures profile trigger fires correctly

3. **Mark Test Data**
   - Use client names like "TEST CLIENT" or "Demo Customer"
   - Makes it easy to identify and delete

4. **Regular Cleanup**
   - Delete test data at end of each testing session
   - Keep database clean

---

## 🔐 For Your Current Issue

To clean up the user you created earlier:

### **Option A: Dashboard (Recommended)**
1. **Supabase** → **Authentication** → **Users**
2. Find the user by email
3. Click **three dots (...)** → **Delete user**

### **Option B: SQL**
```sql
-- Find your test user
SELECT id, email FROM auth.users;

-- Copy the UUID and delete
DELETE FROM auth.users WHERE id = 'paste-uuid-here';
```

---

**After cleanup, use the new `/signup` page to create test users properly!**
