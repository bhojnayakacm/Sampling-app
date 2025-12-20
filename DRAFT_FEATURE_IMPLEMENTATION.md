# Draft Feature Implementation Summary

## Overview
This document summarizes the changes made to implement the "Save as Draft" feature for the request form, along with UI improvements.

## Changes Made

### 1. Database Schema Changes

#### Migration: `300_add_draft_status.sql`
- Added `'draft'` status to the `request_status` enum
- Allows requesters to save incomplete requests that are not yet ready for submission

#### Migration: `301_draft_update_policy.sql`
- Added RLS policy for requesters to update their own draft requests
- Allows requesters to edit and submit their draft requests later
- Policy ensures only draft requests can be updated by the requester

### 2. TypeScript Type Updates

#### File: `src/types/index.ts`
- **Added `'draft'` to `RequestStatus` type:**
  ```typescript
  export type RequestStatus =
    | 'draft'              // NEW: For incomplete/unsaved requests
    | 'pending_approval'
    | 'approved'
    | 'assigned'
    | 'in_production'
    | 'ready'
    | 'dispatched'
    | 'rejected';
  ```

- **Updated `DashboardStats` interface:**
  ```typescript
  export interface DashboardStats {
    total: number;      // Submitted requests (excludes drafts)
    drafts: number;     // NEW: Count of draft requests
    pending: number;
    in_production: number;
    dispatched: number;
  }
  ```

### 3. Frontend Changes

#### File: `src/pages/requests/NewRequest.tsx`

**UI Label Changes:**
- ✅ Changed "Sample Image" → "Quality Image" (line 623)
- ✅ Changed "Click to upload sample image" → "Click to upload quality image" (line 636)
- ✅ Changed "Sample preview" → "Quality image preview" (line 645)

**Button Changes:**
- ✅ Replaced single "Create Request" button with two buttons:
  1. **"Save as Draft"** (outline style) - Saves request with status = 'draft'
  2. **"Submit Request"** (primary style) - Submits request with status = 'pending_approval'

**Form Submission Logic:**
- Updated `onSubmit` function to accept a `status` parameter
- Dynamically sets success message based on status:
  - Draft: "Request saved as draft"
  - Submit: "Request submitted successfully"

**Button Implementation:**
```tsx
<Button
  type="button"
  variant="outline"
  onClick={handleSubmit((data) => onSubmit(data, 'draft'))}
  disabled={isSubmitting}
>
  {isSubmitting ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Saving...
    </>
  ) : (
    'Save as Draft'
  )}
</Button>
<Button
  type="button"
  onClick={handleSubmit((data) => onSubmit(data, 'pending_approval'))}
  disabled={isSubmitting}
>
  {isSubmitting ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Submitting...
    </>
  ) : (
    'Submit Request'
  )}
</Button>
```

#### File: `src/lib/api/requests.ts`

**Updated `useDashboardStats` function:**
- Now calculates `drafts` count separately
- Excludes drafts from `total` count (total = submitted requests only)
- Returns: `{ total, drafts, pending, in_production, dispatched }`

**Updated `useAllRequestsStats` function:**
- Excludes drafts from coordinator/admin view
- Coordinators and admins only see submitted requests

#### File: `src/pages/dashboard/RequesterDashboard.tsx`

**Dashboard Stats Display:**
- Changed from 3 cards to 4 cards
- Updated grid layout: `md:grid-cols-2 lg:grid-cols-4`
- **New card order:**
  1. **Drafts** (gray text) - Shows number of draft requests
  2. **Submitted** (black text) - Shows number of submitted requests
  3. **Pending** (yellow text) - Shows requests awaiting action
  4. **Dispatched** (green text) - Shows completed requests

### 4. Security & Access Control

**RLS Policies:**
- ✅ Requesters can view their own draft requests (existing policy covers this)
- ✅ Requesters can insert draft requests (existing policy covers this)
- ✅ **NEW:** Requesters can update their own draft requests (new policy in migration 301)
- ✅ Drafts are NOT visible to coordinators/admins until submitted
- ✅ Only the creator can edit/submit their drafts

**Policy Logic:**
```sql
-- Requesters can update their own draft requests
CREATE POLICY "Requesters can update own draft requests"
  ON public.requests FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() AND
    public.get_my_role() = 'requester' AND
    status = 'draft'
  )
  WITH CHECK (
    created_by = auth.uid() AND
    public.get_my_role() = 'requester'
  );
```

## Workflow

### Creating a Draft Request
1. Requester fills out the request form
2. Clicks "Save as Draft" button
3. Request is saved with `status = 'draft'`
4. Success message: "Request saved as draft"
5. Draft appears in "Drafts" count on dashboard

### Submitting a Request
1. Requester fills out the request form
2. Clicks "Submit Request" button
3. Request is saved with `status = 'pending_approval'`
4. Success message: "Request submitted successfully"
5. Request appears in "Submitted" count and is visible to coordinators

### Editing a Draft (Future Enhancement)
Currently, drafts can be updated via the API (RLS policy allows it), but the UI for editing drafts needs to be implemented:
- Add "Edit" button for draft requests in the request list
- Load draft data into the form
- Allow updates and resubmission

## Testing Checklist

### Database Migrations
- [ ] Run migration `300_add_draft_status.sql` in Supabase Dashboard
- [ ] Run migration `301_draft_update_policy.sql` in Supabase Dashboard
- [ ] Verify `draft` status exists in enum:
  ```sql
  SELECT enum_range(NULL::request_status);
  ```
- [ ] Verify RLS policy exists:
  ```sql
  SELECT * FROM pg_policies WHERE tablename = 'requests' AND policyname LIKE '%draft%';
  ```

### Frontend Testing
- [ ] Test "Save as Draft" button creates request with status = 'draft'
- [ ] Test "Submit Request" button creates request with status = 'pending_approval'
- [ ] Verify success messages are correct for each action
- [ ] Verify drafts count appears on requester dashboard
- [ ] Verify drafts are NOT visible to coordinators/admins
- [ ] Verify submitted requests count excludes drafts
- [ ] Test UI labels show "Quality Image" instead of "Sample Image"

### Security Testing
- [ ] Verify requester can only view their own drafts
- [ ] Verify coordinators cannot see drafts
- [ ] Verify requester can update their own drafts (via API)
- [ ] Verify requester cannot update others' drafts

## Future Enhancements

### 1. Edit Draft Feature (High Priority)
- Add "Edit" button for draft requests in RequestList
- Create EditRequest page or reuse NewRequest with pre-filled data
- Allow conversion from draft → pending_approval

### 2. Draft Management
- Add "Delete Draft" option
- Add "Drafts" filter in RequestList
- Show draft age (e.g., "Saved 2 hours ago")

### 3. Auto-Save Drafts
- Implement auto-save every 30 seconds while filling form
- Prevent data loss if browser closes

### 4. Draft Validation
- Allow saving drafts with incomplete data (remove required validations for drafts)
- Show validation warnings when saving as draft

## Files Modified

1. **Database Migrations:**
   - `supabase/migrations/300_add_draft_status.sql` (NEW)
   - `supabase/migrations/301_draft_update_policy.sql` (NEW)

2. **TypeScript Types:**
   - `src/types/index.ts` (MODIFIED)

3. **Frontend Components:**
   - `src/pages/requests/NewRequest.tsx` (MODIFIED)
   - `src/lib/api/requests.ts` (MODIFIED)
   - `src/pages/dashboard/RequesterDashboard.tsx` (MODIFIED)

## Summary

**Features Implemented:**
- ✅ "Save as Draft" functionality for incomplete requests
- ✅ "Submit Request" button for final submission
- ✅ UI label changed from "Sample Image" to "Quality Image"
- ✅ Draft count displayed on requester dashboard
- ✅ Drafts excluded from coordinator/admin view
- ✅ RLS policy for draft editing

**Status:** All requested features have been successfully implemented and are ready for testing.

**Next Steps:**
1. Run the database migrations in Supabase Dashboard
2. Test the functionality in the application
3. Consider implementing the "Edit Draft" feature for complete workflow
