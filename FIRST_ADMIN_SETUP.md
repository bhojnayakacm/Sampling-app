# First Admin Setup Instructions

After running the migration and signing up your first user, follow these steps to promote yourself to Admin.

## Step 1: Sign Up Your Admin Account
1. Go to `/signup` in your application
2. Fill out the form:
   - Full Name: `Your Name`
   - Email: `admin@yourdomain.com`
   - Role: Select `Requester` (you'll promote yourself after)
   - Department: Select any (e.g., `Sales`)
   - Phone: `1234567890`
   - Password: `your-secure-password`
3. Click "Sign Up"

## Step 2: Find Your User ID
1. Go to Supabase Dashboard → Authentication → Users
2. Find your newly created user
3. Copy the **User ID** (UUID format, e.g., `a1b2c3d4-...`)

## Step 3: Promote to Admin
In Supabase SQL Editor, run the following SQL command:

```sql
-- Replace 'YOUR-USER-ID-HERE' with the actual UUID you copied
UPDATE public.profiles
SET role = 'admin'
WHERE id = 'YOUR-USER-ID-HERE';
```

**Example:**
```sql
UPDATE public.profiles
SET role = 'admin'
WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
```

## Step 4: Verify Admin Access
1. Log out of your application
2. Log back in with your admin credentials
3. You should now see:
   - Access to "User Management" page
   - Ability to change user roles
   - Ability to delete users

## Step 5: (Optional) Clean Up Department
Since you started as a requester, your profile has a department. You can optionally clear it:

```sql
UPDATE public.profiles
SET department = NULL
WHERE id = 'YOUR-USER-ID-HERE';
```

---

## Future Admins

Once you have one admin, you can promote other users directly through the User Management page without needing SQL commands.
