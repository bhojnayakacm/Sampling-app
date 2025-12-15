import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';

interface RoleProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

/**
 * Route protection component that checks user role
 * Redirects to dashboard if user doesn't have required role
 */
export default function RoleProtectedRoute({ children, allowedRoles }: RoleProtectedRouteProps) {
  const { profile, loading } = useAuth();
  const [hasShownToast, setHasShownToast] = useState(false);

  useEffect(() => {
    // Show toast only once when access is denied
    if (!loading && profile && !allowedRoles.includes(profile.role) && !hasShownToast) {
      toast.error('You do not have permission to access this page');
      setHasShownToast(true);
    }
  }, [loading, profile, allowedRoles, hasShownToast]);

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Check if user has required role
  if (profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
