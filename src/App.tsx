import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Toaster } from 'sonner';

// Pages
import Login from '@/pages/auth/Login';
import Signup from '@/pages/auth/Signup';
import ForgotPassword from '@/pages/auth/ForgotPassword';
import UpdatePassword from '@/pages/auth/UpdatePassword';
import AdminDashboard from '@/pages/dashboard/AdminDashboard';
import CoordinatorDashboard from '@/pages/dashboard/CoordinatorDashboard';
import RequesterDashboard from '@/pages/dashboard/RequesterDashboard';
import MakerDashboard from '@/pages/dashboard/MakerDashboard';
import RequestList from '@/pages/requests/RequestList';
import NewRequest from '@/pages/requests/NewRequest';
import RequestDetail from '@/pages/requests/RequestDetail';
import UserManagement from '@/pages/admin/UserManagement';
import RequesterReport from '@/pages/reports/RequesterReport';
import NotFound from '@/pages/NotFound';
import RoleProtectedRoute from '@/components/RoleProtectedRoute';

// Loading spinner component
function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    </div>
  );
}

// Error recovery screen (shown when profile fetch fails)
function ProfileErrorScreen() {
  const { user, retryFetchProfile, signOut } = useAuth();

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 p-6 text-center">
        <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
          <svg className="h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          Almost there!
        </h2>
        <p className="text-slate-600 mb-6">
          We're setting up your account. This sometimes takes a moment for new users.
        </p>
        <div className="space-y-3">
          <button
            onClick={retryFetchProfile}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={signOut}
            className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
        {user?.email && (
          <p className="text-xs text-slate-400 mt-4">
            Signed in as {user.email}
          </p>
        )}
      </div>
    </div>
  );
}

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Dashboard router based on role
function DashboardRouter() {
  const { profile, loading, profileError } = useAuth();

  // Show loading while fetching profile
  if (loading) {
    return <LoadingScreen />;
  }

  // Show error recovery screen if profile fetch failed
  if (profileError || !profile) {
    return <ProfileErrorScreen />;
  }

  switch (profile.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'coordinator':
      return <CoordinatorDashboard />;
    case 'requester':
      return <RequesterDashboard />;
    case 'maker':
      return <MakerDashboard />;
    default:
      return <Navigate to="/login" replace />;
  }
}

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/update-password" element={<UpdatePassword />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardRouter />
              </ProtectedRoute>
            }
          />

          <Route
            path="/requests"
            element={
              <ProtectedRoute>
                <RequestList />
              </ProtectedRoute>
            }
          />

          <Route
            path="/requests/new"
            element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['requester']}>
                  <NewRequest />
                </RoleProtectedRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/requests/edit/:id"
            element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['requester']}>
                  <NewRequest />
                </RoleProtectedRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/requests/:id"
            element={
              <ProtectedRoute>
                <RequestDetail />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/users"
            element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['admin']}>
                  <UserManagement />
                </RoleProtectedRoute>
              </ProtectedRoute>
            }
          />

          {/* Reports Routes - Coordinators Only */}
          <Route
            path="/reports/requester"
            element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['coordinator', 'admin']}>
                  <RequesterReport />
                </RoleProtectedRoute>
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>

      <Toaster position="top-right" richColors />
    </>
  );
}

export default App;
