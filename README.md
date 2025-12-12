# Marble Sampling Management System

A web application to track marble sample requests for a marble company in India.

## Features

- 🔐 Role-based authentication (Admin, Coordinator, Marketing, Maker)
- 📱 Mobile-responsive design (optimized for field staff)
- 📊 Role-specific dashboards
- 📝 Comprehensive sample request forms with image upload
- 🔄 Request tracking from creation to dispatch
- 🎨 Clean, minimalist design with Tailwind CSS

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS + Shadcn/UI
- **Backend:** Supabase (PostgreSQL + Auth + Storage)
- **State Management:** TanStack Query (React Query)
- **Routing:** React Router v6

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Supabase account and project

### Installation

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Set up environment variables:

```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key

3. Set up the database:

- Go to your Supabase project dashboard
- Navigate to SQL Editor
- Copy the contents of `supabase/schema.sql`
- Run the SQL script

4. Create the storage bucket:

The schema.sql file automatically creates the `sample-images` bucket with appropriate policies.

5. Create your first admin user:

- Sign up via the app (they'll be created as 'marketing' by default)
- Go to Supabase Dashboard > Table Editor > profiles
- Update the user's role to 'admin'

### Development

```bash
npm run dev
```

The app will open at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

## User Roles

- **Admin:** Full access to all data and settings
- **Coordinator:** View all requests, assign makers, update statuses
- **Marketing (90+ users):** Create requests and view only their own requests
- **Maker:** View assigned requests and update status to "In Progress" or "Done"

## Request Workflow

1. Marketing staff creates a request
2. Coordinator assigns it to a Sample Maker
3. Maker updates status (In Progress → Ready)
4. Coordinator marks as Dispatched

## Project Structure

```
src/
├── components/       # Reusable UI components
├── pages/           # Page components
├── lib/             # Utilities and API hooks
├── hooks/           # Custom React hooks
├── types/           # TypeScript type definitions
├── contexts/        # React contexts
└── App.tsx          # Main application component
```

## License

Proprietary - Internal use only
