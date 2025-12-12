# Request History Table Explained

## ❓ Why is `request_history` Empty?

**This is completely normal!** The `request_history` table is for tracking **changes** to requests, not for storing the requests themselves.

---

## 📊 What Each Table Does

### **`requests` table**
- Stores the **current state** of each request
- This is where you see your 2 requests
- Contains all the request data (client info, marble specs, status, etc.)

### **`request_history` table** (Audit Trail)
- Stores a **log of changes** made to requests
- Only gets entries when someone **updates** a request
- Tracks who changed what and when

---

## 🔄 When Does `request_history` Get Populated?

The history table gets entries when:

1. **Status changes**
   - Pending → Approved
   - Assigned → In Production
   - Ready → Dispatched

2. **Assignment changes**
   - Coordinator assigns request to a maker
   - Request reassigned to different maker

3. **Field updates**
   - Client details updated
   - Marble specifications changed
   - Priority changed

---

## 📝 Example Workflow

### **Step 1: Create Request**
```
requests table:
  ✅ SMP-1001 | Status: pending_approval | Client: John Doe

request_history table:
  (empty - no changes yet)
```

### **Step 2: Coordinator Approves Request**
```
requests table:
  ✅ SMP-1001 | Status: approved | Client: John Doe

request_history table:
  ✅ SMP-1001 | Changed by: Coordinator | Field: status
              Old: pending_approval | New: approved | When: 2024-01-15 10:30
```

### **Step 3: Coordinator Assigns to Maker**
```
requests table:
  ✅ SMP-1001 | Status: assigned | Assigned to: Maker-123

request_history table:
  ✅ SMP-1001 | Field: status | Old: approved | New: assigned
  ✅ SMP-1001 | Field: assigned_to | Old: null | New: Maker-123
```

---

## 🎯 Current State (Your App)

Right now:
- ✅ You created 2 requests
- ✅ They exist in `requests` table
- ✅ No one has changed them yet
- ✅ So `request_history` is empty (expected!)

---

## 🔮 When Will You See History?

You'll see entries in `request_history` when:

1. **Coordinator** changes request status
2. **Coordinator** assigns request to a maker
3. **Maker** updates status (In Progress → Ready)
4. **Coordinator** marks as Dispatched

---

## 💡 Future Feature: Audit Trail View

Later, you could build a "Request History" view that shows:

```
SMP-1001 Timeline:
  ✓ Created by Marketing Staff A on Jan 15, 10:00 AM
  ✓ Approved by Coordinator B on Jan 15, 2:30 PM
  ✓ Assigned to Maker C on Jan 15, 3:00 PM
  ✓ Maker started work on Jan 16, 9:00 AM
  ✓ Completed on Jan 16, 4:30 PM
  ✓ Dispatched on Jan 17, 10:00 AM
```

---

## 🛠️ How to Populate History (For Testing)

If you want to test the history feature:

### **Option 1: Update via SQL**
```sql
-- Update a request status manually
UPDATE public.requests
SET status = 'approved'
WHERE request_number = 'SMP-1001';

-- Manually insert history record
INSERT INTO public.request_history (request_id, changed_by, field_name, old_value, new_value)
VALUES (
  'your-request-uuid',
  'your-profile-uuid',
  'status',
  'pending_approval',
  'approved'
);
```

### **Option 2: Build Status Update UI**
Create a page where coordinators can:
- View requests
- Click "Approve" button
- App updates request AND logs to history

---

## ✅ Summary

| Scenario | `requests` Table | `request_history` Table |
|----------|-----------------|------------------------|
| Create new request | ✅ New row added | ❌ Nothing (no changes yet) |
| Update request status | ✅ Status field updated | ✅ Change logged |
| Assign to maker | ✅ assigned_to updated | ✅ Change logged |
| No changes made | ✅ Rows exist | ❌ Empty (expected!) |

**Your empty `request_history` table is completely normal for newly created requests!**
