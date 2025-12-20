# Clickable Dashboard Cards - Implementation Plan

## 🎯 Goal
Make all dashboard stat cards clickable, navigating users to filtered views of their requests with excellent UI/UX.

---

## 📊 Current Dashboard State

### Requester Dashboard
- **Drafts** (count)
- **Submitted** (count)
- **Pending** (count)
- **Dispatched** (count)

### Coordinator Dashboard
- **Total Requests** (all submitted requests)
- **Pending** (pending_approval + approved)
- **In Production** (assigned + in_production)
- **Dispatched** (dispatched)

### Maker Dashboard
- **Assigned** (assigned to me)
- **In Progress** (in_production)
- **Completed** (ready + dispatched)

### Admin Dashboard
- **Total Requests** (all system requests)
- **Pending** (pending_approval + approved)
- **In Production** (assigned + in_production)
- **Dispatched** (dispatched)

---

## 🧭 Navigation Strategy

### URL Parameter Design

**For Requester:**
- Drafts → `/requests?filter=drafts`
- Submitted → `/requests?filter=submitted`
- Pending → `/requests?status=pending`
- Dispatched → `/requests?status=dispatched`

**For Coordinator/Admin:**
- Total → `/requests` (all requests)
- Pending → `/requests?status=pending`
- In Production → `/requests?status=in_production`
- Dispatched → `/requests?status=dispatched`

**For Maker:**
- Assigned → `/requests?status=assigned`
- In Progress → `/requests?status=in_production`
- Completed → `/requests?status=completed`

### Filter Logic

```typescript
// Priority of filters:
1. status param (specific status filter)
2. filter param (draft/submitted)
3. Default (all)

// Combining filters:
- filter=drafts → Show only drafts
- filter=submitted → Show only non-drafts
- status=pending → Show pending_approval + approved + assigned
- status=dispatched → Show only dispatched
- status=in_production → Show assigned + in_production
- status=completed → Show ready + dispatched (for makers)
```

---

## 🎨 UI/UX Enhancements

### 1. Clickable Cards
```tsx
<Card
  className="cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200"
  onClick={() => navigate('/requests?status=pending')}
>
  <CardHeader>
    <CardTitle className="flex items-center justify-between">
      <span>Pending</span>
      <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100" />
    </CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-3xl font-bold">42</p>
  </CardContent>
</Card>
```

### 2. Active Filter Indicator
```tsx
// In RequestList header
{activeFilter && (
  <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-lg">
    <Filter className="h-4 w-4" />
    <span className="font-medium">Showing: {activeFilterLabel}</span>
    <Button
      size="sm"
      variant="ghost"
      onClick={clearFilter}
    >
      <X className="h-4 w-4" />
    </Button>
  </div>
)}
```

### 3. Smart Filter Tabs
```tsx
// Show/hide tabs based on role
{isRequesterUser && (
  <Tabs value={activeTab}>
    <TabsList>
      <TabsTrigger value="all">All</TabsTrigger>
      <TabsTrigger value="drafts">Drafts</TabsTrigger>
      <TabsTrigger value="submitted">Submitted</TabsTrigger>
    </TabsList>
  </Tabs>
)}
```

### 4. Visual Feedback
- Hover effect: Card scales up slightly
- Active state: Border highlight when viewing that filtered data
- Loading state: Skeleton cards while fetching
- Empty state: Custom message based on filter

---

## 🔧 Implementation Steps

### Phase 1: Update RequestList Component
1. Add support for `status` URL param
2. Create filter mapping for status → actual statuses
3. Update filtering logic to handle both `filter` and `status`
4. Add active filter indicator
5. Add "Clear Filter" button

### Phase 2: Create Reusable StatCard Component
```tsx
interface StatCardProps {
  title: string;
  value: number;
  color?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  isLoading?: boolean;
}

function StatCard({ title, value, color, icon, onClick, isLoading }: StatCardProps) {
  return (
    <Card
      className={cn(
        "transition-all duration-200",
        onClick && "cursor-pointer hover:shadow-lg hover:scale-105"
      )}
      onClick={onClick}
    >
      {/* Card content */}
    </Card>
  );
}
```

### Phase 3: Update All Dashboards
1. **RequesterDashboard**
   - Drafts → `/requests?filter=drafts`
   - Submitted → `/requests?filter=submitted`
   - Pending → `/requests?status=pending`
   - Dispatched → `/requests?status=dispatched`

2. **CoordinatorDashboard**
   - Total → `/requests`
   - Pending → `/requests?status=pending`
   - In Production → `/requests?status=in_production`
   - Dispatched → `/requests?status=dispatched`

3. **MakerDashboard**
   - Assigned → `/requests?status=assigned`
   - In Progress → `/requests?status=in_production`
   - Completed → `/requests?status=completed`

4. **AdminDashboard**
   - Same as Coordinator

### Phase 4: Polish UI/UX
1. Add hover animations
2. Add active state when viewing filtered data
3. Add breadcrumbs
4. Add empty states
5. Add loading skeletons

---

## 📋 Status Filter Mapping

```typescript
const STATUS_FILTERS = {
  // For Requester
  pending: ['pending_approval', 'approved', 'assigned'],
  dispatched: ['dispatched'],

  // For Coordinator/Admin
  in_production: ['assigned', 'in_production'],

  // For Maker
  assigned: ['assigned'],
  completed: ['ready', 'dispatched'],
} as const;
```

---

## 🎯 Expected User Flow

### Requester Journey
1. **Lands on Dashboard** → Sees 4 stat cards
2. **Clicks "Pending" card** → Navigates to `/requests?status=pending`
3. **Request List shows** → Only pending requests (pending_approval, approved, assigned)
4. **Sees filter indicator** → "Showing: Pending Requests"
5. **Can click "X"** → Clears filter, returns to all requests

### Coordinator Journey
1. **Lands on Dashboard** → Sees system-wide stats
2. **Clicks "In Production" card** → Navigates to `/requests?status=in_production`
3. **Request List shows** → Requests being worked on (assigned + in_production)
4. **Can take action** → Approve, assign, dispatch directly from list

### Maker Journey
1. **Lands on Dashboard** → Sees task stats
2. **Clicks "Assigned" card** → Navigates to `/requests?status=assigned`
3. **Request List shows** → Tasks assigned to them
4. **Can start work** → Click to view details and start production

---

## ✨ Bonus Features

### 1. Quick Stats in Filter Bar
```tsx
<div className="flex items-center gap-4">
  <span>Showing: Pending Requests</span>
  <Badge variant="secondary">{filteredCount} items</Badge>
</div>
```

### 2. Smart Empty States
```tsx
{requests.length === 0 && filter === 'pending' && (
  <EmptyState
    icon={<CheckCircle />}
    title="No Pending Requests"
    description="All requests have been processed!"
    action={
      <Button onClick={() => navigate('/requests')}>
        View All Requests
      </Button>
    }
  />
)}
```

### 3. Filter Persistence
- Store last filter in localStorage
- Restore filter on page load
- Per-user preference

### 4. Keyboard Shortcuts
- `Ctrl+D` → View drafts
- `Ctrl+P` → View pending
- `Ctrl+A` → View all

---

## 🧪 Testing Checklist

### Requester
- [ ] Click Drafts → See only drafts
- [ ] Click Submitted → See only non-drafts
- [ ] Click Pending → See pending_approval + approved + assigned
- [ ] Click Dispatched → See only dispatched
- [ ] Click X → Clear filter, see all

### Coordinator
- [ ] Click Total → See all submitted requests
- [ ] Click Pending → See pending_approval + approved
- [ ] Click In Production → See assigned + in_production
- [ ] Click Dispatched → See only dispatched

### Maker
- [ ] Click Assigned → See only assigned to me
- [ ] Click In Progress → See only in_production
- [ ] Click Completed → See ready + dispatched

### UI/UX
- [ ] Cards have hover effect
- [ ] Cards scale on hover
- [ ] Active filter shows in header
- [ ] Clear filter button works
- [ ] Empty states show correctly
- [ ] Loading states work

---

## 📊 Success Metrics

1. **Usability** - Users can navigate from dashboard to filtered view in 1 click
2. **Clarity** - Active filter is clearly visible
3. **Flexibility** - Users can clear filter and browse all
4. **Consistency** - All dashboards work the same way
5. **Performance** - Navigation is instant, no loading delays

---

## 🎨 Visual Design Guidelines

### Card Hover State
```css
.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  border-color: var(--primary);
}
```

### Active Filter Indicator
```css
.filter-badge {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 9999px;
  animation: slideIn 0.3s ease-out;
}
```

### Card Colors
- Drafts: Gray (#6B7280)
- Submitted: Blue (#3B82F6)
- Pending: Yellow (#F59E0B)
- In Production: Purple (#8B5CF6)
- Dispatched/Completed: Green (#10B981)

---

## 🚀 Implementation Priority

**High Priority (Must Have)**
1. ✅ Make cards clickable
2. ✅ Status-based filtering
3. ✅ Active filter indicator
4. ✅ Clear filter button

**Medium Priority (Should Have)**
5. ✅ Hover animations
6. ✅ Empty states
7. ✅ Loading states

**Low Priority (Nice to Have)**
8. ⏳ Keyboard shortcuts
9. ⏳ Filter persistence
10. ⏳ Quick stats in filter bar

---

**Plan Status:** ✅ Complete
**Ready for Implementation:** Yes
