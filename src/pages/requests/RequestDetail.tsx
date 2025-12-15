import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { useRequest } from '@/lib/api/requests';
import { formatDate, formatDateTime } from '@/lib/utils';
import RequestActions from '@/components/requests/RequestActions';
import MakerActions from '@/components/requests/MakerActions';

export default function RequestDetail() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: request, isLoading, error } = useRequest(id);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-red-600 mb-4">Failed to load request details</p>
            <Button onClick={() => navigate('/requests')}>Back to Requests</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Request Details</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{profile?.full_name}</span>
            <Button variant="outline" size="sm" onClick={signOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold mb-2">{request.request_number}</h2>
            <div className="flex gap-2">
              {getPriorityBadge(request.priority)}
              {getStatusBadge(request.status)}
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate('/requests')}>
            Back to Requests
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* Client Information */}
            <Card>
              <CardHeader>
                <CardTitle>Client Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="text-sm font-medium text-gray-600">Client Name</span>
                  <p className="text-base">{request.client_name}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Phone</span>
                  <p className="text-base">{request.client_phone}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Delivery Address</span>
                  <p className="text-base whitespace-pre-line">{request.delivery_address}</p>
                </div>
              </CardContent>
            </Card>

            {/* Marble Specifications */}
            <Card>
              <CardHeader>
                <CardTitle>Marble Specifications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium text-gray-600">Sample Name</span>
                    <p className="text-base">{request.sample_name}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Stone Type</span>
                    <p className="text-base">{request.stone_type}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium text-gray-600">Dimensions</span>
                    <p className="text-base">{request.dimensions}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Thickness</span>
                    <p className="text-base">{request.thickness}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium text-gray-600">Finish</span>
                    <p className="text-base">{request.finish}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Edge Profile</span>
                    <p className="text-base">{request.edge_profile}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium text-gray-600">Quantity</span>
                    <p className="text-base">
                      {request.quantity} {request.unit}
                    </p>
                  </div>
                </div>

                {request.remarks && (
                  <div>
                    <span className="text-sm font-medium text-gray-600">Remarks</span>
                    <p className="text-base whitespace-pre-line">{request.remarks}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sample Image */}
            {request.image_url && (
              <Card>
                <CardHeader>
                  <CardTitle>Sample Image</CardTitle>
                </CardHeader>
                <CardContent>
                  <img
                    src={request.image_url}
                    alt="Sample reference"
                    className="w-full rounded-lg border"
                  />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - 1 column */}
          <div className="space-y-6">
            {/* Request Details */}
            <Card>
              <CardHeader>
                <CardTitle>Request Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="text-sm font-medium text-gray-600">Request Number</span>
                  <p className="text-base font-mono">{request.request_number}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Requested Date</span>
                  <p className="text-base">{formatDate(request.requested_date)}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Created</span>
                  <p className="text-base">{formatDateTime(request.created_at)}</p>
                </div>
                {request.completed_at && (
                  <div>
                    <span className="text-sm font-medium text-gray-600">Completed</span>
                    <p className="text-base">{formatDateTime(request.completed_at)}</p>
                  </div>
                )}
                {request.dispatched_at && (
                  <div>
                    <span className="text-sm font-medium text-gray-600">Dispatched</span>
                    <p className="text-base">{formatDateTime(request.dispatched_at)}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Status Timeline - Future enhancement */}
            <Card>
              <CardHeader>
                <CardTitle>Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 w-2 h-2 rounded-full bg-blue-500"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Request Created</p>
                      <p className="text-xs text-gray-500">{formatDateTime(request.created_at)}</p>
                    </div>
                  </div>
                  {/* More timeline items can be added based on request_history */}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Request Actions - for coordinators/admins */}
        <RequestActions request={request} userRole={profile?.role || ''} />

        {/* Maker Actions - for makers */}
        <MakerActions request={request} userRole={profile?.role || ''} userId={profile?.id || ''} />
      </main>
    </div>
  );
}
