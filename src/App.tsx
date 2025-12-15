import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Toaster } from 'sonner';

// Pages
import Login from '@/pages/auth/Login';
import Signup from '@/pages/auth/Signup';
import AdminDashboard from '@/pages/dashboard/AdminDashboard';
import CoordinatorDashboard from '@/pages/dashboard/CoordinatorDashboard';
import MarketingDashboard from '@/pages/dashboard/MarketingDashboard';
import MakerDashboard from '@/pages/dashboard/MakerDashboard';
import RequestList from '@/pages/requests/RequestList';
import NewRequest from '@/pages/requests/NewRequest';
import RequestDetail from '@/pages/requests/RequestDetail';
import UserManagement from '@/pages/admin/UserManagement';
import NotFound from '@/pages/NotFound';
import RoleProtectedRoute from '@/components/RoleProtectedRoute';

// Loading spinner component
function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
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
  const { profile } = useAuth();

  if (!profile) {
    return <LoadingScreen />;
  }

  switch (profile.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'coordinator':
      return <CoordinatorDashboard />;
    case 'marketing':
      return <MarketingDashboard />;
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
                <RoleProtectedRoute allowedRoles={['marketing']}>
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

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>

      <Toaster position="top-right" richColors />
    </>
  );
}

export default App;
