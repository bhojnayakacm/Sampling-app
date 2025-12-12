# Setup Instructions for Marble Sampling Management System

## Initial Setup Complete ✅

The project has been initialized with the following:

### 1. Project Structure
- ✅ Vite + React + TypeScript configuration
- ✅ Tailwind CSS + Shadcn/UI components
- ✅ Supabase client setup
- ✅ React Query (TanStack Query) for data fetching
- ✅ React Router for navigation
- ✅ Authentication context and hooks
- ✅ Role-based access control hooks

### 2. Database Schema
- ✅ Complete SQL schema in `supabase/schema.sql`
- ✅ Auto-generated request numbers (SMP-1001, etc.)
- ✅ Row Level Security (RLS) policies
- ✅ Storage bucket for sample images
- ✅ Auto-profile creation trigger

### 3. Components Created
- ✅ UI Components (Button, Input, Card, Badge, Label, Textarea, Select)
- ✅ Auth Context for authentication state management
- ✅ Custom hooks (useRole, useMediaQuery, useAuth)
- ✅ Placeholder pages for all routes

## Next Steps

### Step 1: Set Up Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Create a new project
3. Wait for the database to be provisioned

### Step 2: Run Database Schema

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy the entire contents of `supabase/schema.sql`
4. Paste and run the SQL script
5. Verify that tables and policies are created

### Step 3: Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Get your Supabase credentials:
   - Go to **Project Settings** > **API**
   - Copy the **Project URL**
   - Copy the **anon/public** key

3. Update `.env` with your credentials:
   ```
   VITE_SUPABASE_URL=your_project_url_here
   VITE_SUPABASE_ANON_KEY=your_anon_key_here
   ```

### Step 4: Install Dependencies and Run

```bash
# Install dependencies (if not already done)
npm install

# Start development server
npm run dev
```

The app will open at `http://localhost:3000`

### Step 5: Create Your First Admin User

1. Sign up via the login page (users are created as 'marketing' by default)
2. Go to Supabase Dashboard > **Table Editor** > **profiles**
3. Find your user and change the `role` column to `'admin'`
4. Sign out and sign back in

### Step 6: Verify Storage Bucket

1. Go to Supabase Dashboard > **Storage**
2. Verify that `sample-images` bucket exists
3. If not, it should have been created by the schema.sql script

## What's Working Now

✅ User authentication (login/logout)
✅ Role-based dashboard routing
✅ Protected routes
✅ Basic UI components
✅ Database schema with RLS policies

## What Needs to Be Built Next

1. **Request Form** - The critical mobile-optimized form for creating requests
2. **Request List** - Table/card view with filtering and sorting
3. **Request Details** - View and edit individual requests
4. **Dashboard Stats** - Real data from database
5. **Request Assignment** - Coordinator assigns requests to makers
6. **Status Updates** - Makers update status, coordinators dispatch
7. **Image Upload** - Upload reference photos to Supabase Storage

## Troubleshooting

### Error: "Missing Supabase environment variables"
- Make sure you've created `.env` file with correct credentials

### Error: "User not found after login"
- The auto-profile trigger should create profiles automatically
- Verify the trigger exists in your database

### Storage errors
- Verify the `sample-images` bucket exists
- Check RLS policies are applied to `storage.objects`

## Tech Stack Summary

- **Frontend:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS + Shadcn/UI
- **Backend:** Supabase (PostgreSQL + Auth + Storage)
- **State:** TanStack Query (React Query)
- **Routing:** React Router v6
- **Forms:** React Hook Form
- **Notifications:** Sonner (toast notifications)

## Project Status

**Phase 1:** ✅ Complete - Project initialization and basic structure
**Phase 2:** 🔄 Next - Implement core features (forms, lists, CRUD operations)
**Phase 3:** ⏳ Pending - Polish, testing, and deployment

---

**Ready to start development!** The foundation is solid. Next, we'll build the request form and connect it to the database.
