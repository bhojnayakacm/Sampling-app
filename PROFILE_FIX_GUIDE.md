# Profile Auto-Creation Fix Guide

## 🔍 The Problem

When you sign up with email confirmation enabled:
1. User is created in `auth.users`
2. Email confirmation is required
3. The profile trigger doesn't fire properly
4. You can log in, but get stuck on loading screen (no profile)

## ✅ The Solution (2 Steps)

---

### **Step 1: Fix RLS Policy (Run Once)**

Run this in **Supabase SQL Editor**:

```sql
-- Fix the profile insert policy to allow self-creation
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;

CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can insert any profile"
ON public.profiles
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);
```

**What this does:**
- Allows users to create their own profile
- Keeps admin ability to create profiles for others
- Enables the AuthContext fallback to work

---

### **Step 2: Fix Your Current User**

#### **Option A: Automatic (Easiest)**

1. **Sign out** from the app
2. **Sign in** again with your credentials
3. The app will **automatically create** your profile
4. You should land on the Marketing Dashboard!

#### **Option B: Manual (If Option A fails)**

Run this in **Supabase SQL Editor**:

```sql
-- 1. Find your user ID
SELECT id, email, created_at, email_confirmed_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- 2. Check if profile exists
SELECT p.id, p.full_name, p.role, u.email
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
ORDER BY u.created_at DESC
LIMIT 5;

-- 3. If no profile exists, create it manually
-- (Replace YOUR_USER_ID with the UUID from step 1)
INSERT INTO public.profiles (id, role, full_name, phone)
VALUES (
  'YOUR_USER_ID',      -- Replace with your user UUID
  'marketing',         -- Role: admin, coordinator, marketing, or maker
  'Your Full Name',    -- Replace with your name
  '+91 1234567890'     -- Optional phone number
)
ON CONFLICT (id) DO NOTHING;

-- 4. Verify profile was created
SELECT p.*, u.email
FROM public.profiles p
JOIN auth.users u ON p.id = u.id
ORDER BY p.created_at DESC;
```

---

## 🧪 Testing the Fix

### **Test 1: Current User**
1. Sign out from the app
2. Sign in again
3. ✅ Should land on Marketing Dashboard (not loading screen)

### **Test 2: New User Signup**
1. Go to `/signup`
2. Create a new test account
3. Confirm email (check inbox)
4. Sign in
5. ✅ Profile should be auto-created
6. ✅ Should land on Marketing Dashboard

### **Test 3: Create Request**
1. Navigate to `/requests/new`
2. Fill out the form
3. Submit
4. ✅ Request should be created
5. Check Supabase → **requests** table

---

## 🔧 How the Fix Works

### **Updated AuthContext Behavior:**

```typescript
// Before (Old behavior):
fetchProfile() → Profile not found → Error → Loading forever

// After (New behavior):
fetchProfile() → Profile not found → Auto-create profile → Success!
```

### **Auto-Creation Flow:**

1. User logs in
2. AuthContext tries to fetch profile
3. **If profile doesn't exist** (error code PGRST116):
   - Automatically creates profile with:
     - `id`: User's UUID
     - `role`: 'marketing' (default)
     - `full_name`: From signup form or email
     - `phone`: From signup form (if provided)
4. Profile is set and dashboard loads

---

## 🎯 Why Email Confirmation Causes This

**Normal Signup Flow:**
```
signUp() → INSERT into auth.users → Trigger fires → Profile created ✅
```

**Email Confirmation Flow:**
```
signUp() → INSERT into auth.users (unconfirmed state)
         → Trigger might not fire or fails
         → User confirms email
         → User can log in
         → No profile exists ❌
```

**Our Fix:**
```
Login → Fetch profile → Not found? → Auto-create → Success! ✅
```

---

## 🚀 Disable Email Confirmation (Optional)

If you want to skip email confirmation for faster testing:

1. **Supabase Dashboard** → **Authentication** → **Settings**
2. Find **"Enable email confirmations"**
3. Toggle **OFF**
4. Save

**Note:** This is fine for development, but enable it for production!

---

## 📋 Verification Checklist

After running the fix:

- [ ] RLS policy updated (Step 1 SQL ran successfully)
- [ ] Old user can log in without loading screen
- [ ] New signups auto-create profiles
- [ ] Can create requests without errors
- [ ] Dashboard loads correctly for all roles

---

## 🆘 If Still Not Working

### **Check Browser Console**

1. Open browser DevTools (F12)
2. Go to **Console** tab
3. Log in again
4. Look for:
   - ✅ "Profile not found, creating one..."
   - ✅ "Profile created successfully"
   - ❌ Any red errors

### **Common Issues:**

**Issue:** "Policy violation" error when creating profile

**Solution:** Make sure you ran the RLS policy fix (Step 1)

---

**Issue:** Profile created but role is wrong

**Solution:** Update role in Supabase:
```sql
UPDATE public.profiles
SET role = 'admin'  -- or coordinator, marketing, maker
WHERE id = 'your-user-id';
```

---

**Issue:** Still stuck on loading screen

**Solution:** Clear browser cache and local storage:
```javascript
// In browser console:
localStorage.clear();
sessionStorage.clear();
location.reload();
```

---

## ✅ Summary

1. **Run the RLS policy fix** (Step 1 SQL)
2. **Sign out and sign in** (profile auto-creates)
3. **Test the New Request form**
4. **Future signups work automatically**

**The fix is now permanent!** All future users (with or without email confirmation) will have profiles auto-created on first login.
