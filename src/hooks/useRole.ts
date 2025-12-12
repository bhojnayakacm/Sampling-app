import { useAuth } from '@/contexts/AuthContext';

export function useRole() {
  const { profile } = useAuth();

  const role = profile?.role;

  const isAdmin = role === 'admin';
  const isCoordinator = role === 'coordinator';
  const isMarketing = role === 'marketing';
  const isMaker = role === 'maker';

  const canViewAllRequests = isAdmin || isCoordinator;
  const canAssignRequests = isAdmin || isCoordinator;
  const canCreateRequests = isAdmin || isCoordinator || isMarketing;
  const canUpdateStatus = isAdmin || isCoordinator || isMaker;
  const canDeleteRequests = isAdmin;

  return {
    role,
    isAdmin,
    isCoordinator,
    isMarketing,
    isMaker,
    canViewAllRequests,
    canAssignRequests,
    canCreateRequests,
    canUpdateStatus,
    canDeleteRequests,
  };
}
