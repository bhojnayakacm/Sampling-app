# Role Testing Guide

Complete guide to test all 4 user roles in the Marble Sampling System.

---

## 🎭 **4 User Roles Overview**

| Role | Dashboard | Permissions | Use Case |
|------|-----------|-------------|----------|
| **Marketing** | My Requests | Create requests, view own requests only | Field staff (90+ users) |
| **Maker** | My Tasks | View assigned requests, update status | Sample production staff |
| **Coordinator** | All Requests | View all, assign to makers, update status | Operations manager |
| **Admin** | Full Access | Everything + user management | System administrator |

---

## 📋 **Testing Plan**

### **Method 1: Create New Test Users (Recommended)**

Create 3 new test users with different roles:

#### **Step 1: Create Test Users via Signup**

1. **Sign out** from your current account
2. Go to `http://localhost:3000/signup`
3. Create 3 test accounts:

**Coordinator Test Account:**
```
Email: coordinator@test.com
Password: password123
Full Name: Test Coordinator
Phone: +91 9876543210
```

**Maker Test Account:**
```
Email: maker@test.com
Password: password123
Full Name: Test Maker
Phone: +91 9876543211
```

**Admin Test Account:**
```
Email: admin@test.com
Password: password123
Full Name: Test Admin
Phone: +91 9876543212
```

#### **Step 2: Assign Roles in Supabase**

After creating the accounts:

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Run this SQL to update roles:

```sql
-- Find all test users
SELECT id, email FROM auth.users
WHERE email LIKE '%@test.com'
ORDER BY created_at DESC;

-- Update roles (replace UUIDs with actual IDs from above)
UPDATE public.profiles SET role = 'coordinator' WHERE id = 'coordinator-user-uuid';
UPDATE public.profiles SET role = 'maker' WHERE id = 'maker-user-uuid';
UPDATE public.profiles SET role = 'admin' WHERE id = 'admin-user-uuid';

-- Verify
SELECT p.full_name, p.role, u.email
FROM public.profiles p
JOIN auth.users u ON p.id = u.id
WHERE u.email LIKE '%@test.com';
```

---

### **Method 2: Change Current User's Role (Quick Test)**

Fastest way to test different dashboards:

```sql
-- Find your user
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- Change role to test (replace UUID)
UPDATE public.profiles SET role = 'admin' WHERE id = 'your-user-uuid';

-- Sign out and sign back in to see the new dashboard
```

**Test each role:**
```sql
-- Test as Coordinator
UPDATE public.profiles SET role = 'coordinator' WHERE id = 'your-user-uuid';

-- Test as Maker
UPDATE public.profiles SET role = 'maker' WHERE id = 'your-user-uuid';

-- Test as Admin
UPDATE public.profiles SET role = 'admin' WHERE id = 'your-user-uuid';

-- Back to Marketing
UPDATE public.profiles SET role = 'marketing' WHERE id = 'your-user-uuid';
```

**Important:** Sign out and sign back in after each role change!

---

## 🧪 **What to Test for Each Role**

### **1. Marketing Role** ✅ (Already Tested)

**Dashboard:** Shows only YOUR requests

**Features:**
- ✅ View dashboard with stats (Total, Pending, Dispatched)
- ✅ Create new requests
- ✅ View request list (only own requests)
- ✅ View request details

**Test Steps:**
1. Log in as marketing user
2. Dashboard shows: "My Requests"
3. Stats show your 2 requests
4. Create a new request
5. View request list - see only requests you created

---

### **2. Coordinator Role**

**Dashboard:** Shows ALL requests from ALL users

**Features:**
- ✅ View all requests in system
- ✅ See system-wide stats
- 🔄 Assign requests to makers (not built yet)
- 🔄 Update request status (not built yet)
- 🔄 Mark as dispatched (not built yet)

**Test Steps:**
1. Change role to 'coordinator'
2. Sign out and sign back in
3. Dashboard shows: "Coordinator Dashboard"
4. Stats show ALL requests (not just yours)
5. Click "View All Requests"
6. Should see requests from ALL marketing users

**Expected Stats:**
```
Total Requests: 2 (or more if you created more)
Pending Assignment: 2
In Production: 0
Ready to Dispatch: 0
```

---

### **3. Admin Role**

**Dashboard:** Same as Coordinator + additional admin features

**Features:**
- ✅ View all requests
- ✅ System-wide stats
- ✅ Create requests
- 🔄 Manage users (not built yet)
- 🔄 Change roles (not built yet)

**Test Steps:**
1. Change role to 'admin'
2. Sign out and sign back in
3. Dashboard shows: "Admin Dashboard"
4. Stats show ALL requests
5. Has "New Request" button (admins can create requests)
6. Can view all requests

**Expected Dashboard:**
```
Total Requests: 2
Pending: 2
In Production: 0
Dispatched: 0
```

---

### **4. Maker Role**

**Dashboard:** Shows only requests ASSIGNED to this maker

**Features:**
- ✅ View assigned tasks
- ✅ See task stats
- 🔄 Update status (In Progress, Ready) (not built yet)
- ❌ Cannot create requests
- ❌ Cannot see unassigned requests

**Test Steps:**
1. Change role to 'maker'
2. Sign out and sign back in
3. Dashboard shows: "My Tasks"
4. Stats should be **ALL ZEROS** (no requests assigned yet)

**Expected Stats:**
```
Assigned to Me: 0
In Progress: 0
Completed: 0
```

**To test with data:**
1. First assign a request to the maker:
```sql
-- Find maker's ID
SELECT id, full_name FROM public.profiles WHERE role = 'maker';

-- Find a request
SELECT id, request_number FROM public.requests LIMIT 1;

-- Assign request to maker
UPDATE public.requests
SET assigned_to = 'maker-user-uuid', status = 'assigned'
WHERE id = 'request-uuid';
```

2. Refresh dashboard - now should show:
```
Assigned to Me: 1
In Progress: 0
Completed: 0
```

---

## 📊 **Quick Role Comparison**

| Feature | Marketing | Maker | Coordinator | Admin |
|---------|-----------|-------|-------------|-------|
| Create requests | ✅ | ❌ | ✅ | ✅ |
| View own requests | ✅ | - | ✅ | ✅ |
| View all requests | ❌ | ❌ | ✅ | ✅ |
| View assigned requests | - | ✅ | - | - |
| Assign to makers | ❌ | ❌ | 🔄 | 🔄 |
| Update status | ❌ | 🔄 | 🔄 | 🔄 |
| Manage users | ❌ | ❌ | ❌ | 🔄 |

✅ = Working
🔄 = Not implemented yet
❌ = Not allowed

---

## 🎯 **Testing Workflow**

### **Complete Role Testing Sequence:**

```bash
# 1. Create 4 test accounts
marketing@test.com  → Keep as marketing
coordinator@test.com → Change to coordinator
maker@test.com → Change to maker
admin@test.com → Change to admin

# 2. Login as each and test:
```

**Test 1: Marketing**
1. Login as marketing@test.com
2. Create 2 requests
3. View request list - see only own requests
4. Dashboard shows "2" total

**Test 2: Admin**
1. Login as admin@test.com
2. Dashboard shows ALL requests (including marketing's 2)
3. Can create new requests
4. Total shows "2" (system-wide)

**Test 3: Coordinator**
1. Login as coordinator@test.com
2. Dashboard shows ALL requests
3. Click "View All Requests"
4. See requests from marketing user

**Test 4: Maker**
1. Login as maker@test.com
2. Dashboard shows "0" (nothing assigned yet)
3. Assign a request via SQL (see above)
4. Refresh - shows "1" assigned

---

## 🔄 **Features Still To Build**

### **Coordinator Features:**
- [ ] Assign request to maker (dropdown/select)
- [ ] Update request status
- [ ] Mark as dispatched
- [ ] View all users

### **Maker Features:**
- [ ] Update status to "In Progress"
- [ ] Update status to "Ready"
- [ ] Add completion notes

### **Admin Features:**
- [ ] User management page
- [ ] Change user roles
- [ ] View audit logs (request_history)

---

## 📝 **SQL Cheat Sheet**

**View all users and roles:**
```sql
SELECT p.full_name, p.role, u.email
FROM public.profiles p
JOIN auth.users u ON p.id = u.id
ORDER BY p.created_at DESC;
```

**Change user role:**
```sql
UPDATE public.profiles
SET role = 'admin'  -- or coordinator, marketing, maker
WHERE id = 'user-uuid';
```

**Assign request to maker:**
```sql
UPDATE public.requests
SET assigned_to = 'maker-uuid', status = 'assigned'
WHERE request_number = 'SMP-1001';
```

**View request counts by status:**
```sql
SELECT status, COUNT(*)
FROM public.requests
GROUP BY status;
```

---

## ✅ **Testing Checklist**

- [ ] Created test users for all 4 roles
- [ ] Tested Marketing dashboard (shows own requests)
- [ ] Tested Admin dashboard (shows all requests)
- [ ] Tested Coordinator dashboard (shows all requests)
- [ ] Tested Maker dashboard (shows assigned tasks)
- [ ] Verified role-based routing works
- [ ] Confirmed request list shows correct data per role
- [ ] Checked request detail page works for all roles

---

**Ready to test! Start with Method 1 (create new users) or Method 2 (change current user's role).**
