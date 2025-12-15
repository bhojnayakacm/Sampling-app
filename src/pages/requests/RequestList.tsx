import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useMyRequests, useRequests } from '@/lib/api/requests';
import { formatDate } from '@/lib/utils';
import { useMemo } from 'react';

export default function RequestList() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  // Determine which requests to fetch based on role
  const isMarketingUser = profile?.role === 'marketing';
  const isMakerUser = profile?.role === 'maker';
  const isAdminOrCoordinator = profile?.role === 'admin' || profile?.role === 'coordinator';

  // Fetch requests based on role
  const { data: myRequests, isLoading: myRequestsLoading } = useMyRequests(profile?.id);
  const { data: allRequests, isLoading: allRequestsLoading } = useRequests();

  // Select appropriate data based on role
  const { requests, isLoading } = useMemo(() => {
    if (isMarketingUser) {
      return { requests: myRequests, isLoading: myRequestsLoading };
    } else if (isMakerUser) {
      // Filter to show only assigned tasks
      const assignedRequests = allRequests?.filter(r => r.assigned_to === profile?.id) || [];
      return { requests: assignedRequests, isLoading: allRequestsLoading };
    } else {
      // Admin and Coordinator see all requests
      return { requests: allRequests, isLoading: allRequestsLoading };
    }
  }, [isMarketingUser, isMakerUser, myRequests, allRequests, myRequestsLoading, allRequestsLoading, profile?.id]);

  // Get appropriate page title based on role
  const getPageTitle = () => {
    if (isMarketingUser) return 'My Requests';
    if (isMakerUser) return 'My Tasks';
    return 'All Requests';
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      pending_approval: { label: 'Pending Approval', variant: 'outline' },
      approved: { label: 'Approved', variant: 'secondary' },
      assigned: { label: 'Assigned', variant: 'secondary' },
      in_production: { label: 'In Production', variant: 'default' },
      ready: { label: 'Ready', variant: 'default' },
      dispatched: { label: 'Dispatched', variant: 'default' },
      rejected: { label: 'Rejected', variant: 'destructive' },
    };

    const { label, variant } = statusMap[status] || { label: status, variant: 'outline' };
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const priorityMap: Record<string, { variant: 'default' | 'secondary' | 'destructive' }> = {
      high: { variant: 'destructive' },
      medium: { variant: 'default' },
      low: { variant: 'secondary' },
    };

    return (
      <Badge variant={priorityMap[priority]?.variant || 'secondary'}>
        {priority.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">{getPageTitle()}</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{profile?.full_name}</span>
            <Button variant="outline" size="sm" onClick={signOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">
            {isLoading ? 'Loading...' : `${requests?.length || 0} Requests`}
          </h2>
          <div className="flex gap-4">
            <Button onClick={() => navigate('/')}>Back to Dashboard</Button>
            {isMarketingUser && (
              <Button onClick={() => navigate('/requests/new')}>New Request</Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-lg border p-8 text-center">
            <p className="text-gray-500">Loading requests...</p>
          </div>
        ) : !requests || requests.length === 0 ? (
          <div className="bg-white rounded-lg border p-8 text-center">
            <p className="text-gray-500">
              {isMarketingUser && 'No requests found. Create your first request to get started.'}
              {isMakerUser && 'No tasks assigned to you yet.'}
              {isAdminOrCoordinator && 'No requests found in the system.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <Card
                key={request.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/requests/${request.id}`)}
              >
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">{request.request_number}</h3>
                      <p className="text-sm text-gray-600">{request.client_name}</p>
                      {request.creator && (
                        <p className="text-xs text-gray-500 mt-1">
                          Created by: <span className="font-medium text-gray-700">{request.creator.full_name}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {getPriorityBadge(request.priority)}
                      {getStatusBadge(request.status)}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Sample:</span> {request.sample_name}
                    </div>
                    <div>
                      <span className="font-medium">Stone Type:</span> {request.stone_type}
                    </div>
                    <div>
                      <span className="font-medium">Quantity:</span> {request.quantity} {request.unit}
                    </div>
                  </div>

                  <div className="mt-4 flex justify-between items-center text-sm text-gray-500">
                    <span>Created on {formatDate(request.created_at)}</span>
                    {request.maker && (
                      <span className="text-xs">
                        Assigned to: <span className="font-medium text-gray-700">{request.maker.full_name}</span>
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
