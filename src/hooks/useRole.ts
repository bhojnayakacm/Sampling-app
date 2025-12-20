import { useAuth } from '@/contexts/AuthContext';

export function useRole() {
  const { profile } = useAuth();

  const role = profile?.role;

  const isAdmin = role === 'admin';
  const isCoordinator = role === 'coordinator';
  const isRequester = role === 'requester';
  const isMaker = role === 'maker';

  const canViewAllRequests = isAdmin || isCoordinator;
  const canAssignRequests = isAdmin || isCoordinator;
  const canCreateRequests = isAdmin || isCoordinator || isRequester;
  const canUpdateStatus = isAdmin || isCoordinator || isMaker;
  const canDeleteRequests = isAdmin;

  return {
    role,
    isAdmin,
    isCoordinator,
    isRequester,
    isMaker,
    canViewAllRequests,
    canAssignRequests,
    canCreateRequests,
    canUpdateStatus,
    canDeleteRequests,
  };
}
