# Database Cleanup Guide

This guide explains how to clean all data from your database and start fresh.

## ⚠️ WARNING
**This process will DELETE ALL DATA permanently. There is NO undo.**
- All requests will be deleted
- All request history will be deleted
- All clients will be deleted
- All uploaded sample images will be deleted
- User profiles can be preserved or deleted (your choice)

## Option 1: Clean Everything Except Your Admin Account (RECOMMENDED)

### Step 1: Run the Cleanup Script
1. Open your Supabase Dashboard
2. Go to **SQL Editor**
3. Open the file `supabase/migrations/999_cleanup_data.sql`
4. Copy the entire content
5. Paste it into the SQL Editor
6. Make sure the default option is selected (keeps your current admin account)
7. Click **RUN**

### Step 2: Delete Sample Images from Storage
1. In Supabase Dashboard, go to **Storage**
2. Click on **sample-images** bucket
3. Select all files (if any)
4. Click **Delete** button
5. Confirm deletion

### Step 3: Refresh Your App
1. Refresh your browser at `http://localhost:3000`
2. You should still be logged in as admin
3. Dashboard should show all zeros
4. No requests should appear

## Option 2: Delete EVERYTHING (Including All Users)

If you want to delete ALL users including your admin account:

### Step 1: Modify the Cleanup Script
1. Open `supabase/migrations/999_cleanup_data.sql`
2. Find this section:
   ```sql
   DELETE FROM public.profiles
   WHERE id != auth.uid();
   ```
3. Comment it out and uncomment the line below:
   ```sql
   -- DELETE FROM public.profiles
   -- WHERE id != auth.uid();

   DELETE FROM public.profiles;
   ```

### Step 2: Delete Auth Users
1. Go to Supabase Dashboard → **Authentication** → **Users**
2. Select all users
3. Delete them manually

**OR** run this SQL (DANGEROUS):
```sql
-- This will delete ALL authentication users
DELETE FROM auth.users;
```

### Step 3: Run the Cleanup Script
Follow the same steps as Option 1

### Step 4: Sign Up Again
1. Go to `http://localhost:3000`
2. You'll be redirected to login
3. Click **Sign Up**
4. Create a new admin account
5. Then manually change the role in Supabase:
   - Go to **Table Editor** → **profiles**
   - Find your new user
   - Change role from `marketing` to `admin`

## Verification

After cleanup, verify by running these queries in SQL Editor:

```sql
SELECT COUNT(*) as request_count FROM public.requests;
SELECT COUNT(*) as history_count FROM public.request_history;
SELECT COUNT(*) as client_count FROM public.clients;
SELECT COUNT(*) as profile_count FROM public.profiles;
SELECT COUNT(*) as storage_count FROM storage.objects WHERE bucket_id = 'sample-images';
```

All counts should be 0 (except profiles which should be 1 if you kept your admin).

## What Gets Preserved

The following are NOT deleted and will remain intact:
- Database schema (all tables, columns, constraints)
- RLS policies
- Database functions and triggers
- Enums (user_role, request_status, etc.)
- Storage bucket configuration
- Your authentication setup

## Quick Cleanup (Command Line Alternative)

If you prefer, you can run the cleanup directly from command line using Supabase CLI:

```bash
# Make sure you're logged in to Supabase CLI first
supabase db reset --db-url "your-supabase-db-url"
```

**Note**: This will reset the ENTIRE database including schema, so you'll need to run all migrations again.
