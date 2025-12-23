import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { useRequest } from '@/lib/api/requests';
import { formatDateTime } from '@/lib/utils';
import RequestActions from '@/components/requests/RequestActions';
import MakerActions from '@/components/requests/MakerActions';
import TrackingDialog from '@/components/requests/TrackingDialog';
import { MapPin, MessageSquare, CheckCircle, XCircle, ChevronLeft } from 'lucide-react';

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
      received: { label: 'Received', variant: 'secondary' },
      rejected: { label: 'Rejected', variant: 'destructive' },
    };

    const { label, variant } = statusMap[status] || { label: status, variant: 'outline' };
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const priorityMap: Record<string, { variant: 'default' | 'secondary' | 'destructive' }> = {
      urgent: { variant: 'destructive' },
      normal: { variant: 'default' },
    };

    return (
      <Badge variant={priorityMap[priority]?.variant || 'default'}>
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

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold mb-2">{request.request_number}</h2>
            <div className="flex gap-2">
              {getPriorityBadge(request.priority)}
              {getStatusBadge(request.status)}
            </div>
          </div>
          <div className="flex gap-2">
            <TrackingDialog
              request={request}
              trigger={
                <Button variant="outline" className="h-11">
                  <MapPin className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Track Sample</span>
                </Button>
              }
            />
            {/* Back button - Icon only on mobile, text on desktop */}
            <Button
              variant="outline"
              onClick={() => navigate('/')}
              className="h-11"
            >
              <ChevronLeft className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Back to Dashboard</span>
            </Button>
          </div>
        </div>

        {/* Coordinator Message Alert (if exists) */}
        {request.coordinator_message && (
          <Alert
            className={
              request.status === 'rejected'
                ? 'mb-6 border-l-4 border-l-red-500 bg-red-50'
                : request.status === 'approved'
                ? 'mb-6 border-l-4 border-l-green-500 bg-green-50'
                : 'mb-6 border-l-4 border-l-blue-500 bg-blue-50'
            }
          >
            <div className="flex items-start gap-3">
              {request.status === 'rejected' ? (
                <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
              ) : request.status === 'approved' ? (
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              ) : (
                <MessageSquare className="h-5 w-5 text-blue-600 mt-0.5" />
              )}
              <div className="flex-1">
                <AlertTitle
                  className={
                    request.status === 'rejected'
                      ? 'text-red-800 font-semibold'
                      : request.status === 'approved'
                      ? 'text-green-800 font-semibold'
                      : 'text-blue-800 font-semibold'
                  }
                >
                  Message from Coordinator
                </AlertTitle>
                <AlertDescription
                  className={
                    request.status === 'rejected'
                      ? 'text-red-700 mt-2'
                      : request.status === 'approved'
                      ? 'text-green-700 mt-2'
                      : 'text-blue-700 mt-2'
                  }
                >
                  {request.coordinator_message}
                </AlertDescription>
              </div>
            </div>
          </Alert>
        )}

        <div className="space-y-6">
          {/* Section 1: Request Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Request Overview</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <span className="text-sm font-medium text-gray-600">Request Number</span>
                <p className="text-base font-mono">{request.request_number}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600">Status</span>
                <div className="mt-1">{getStatusBadge(request.status)}</div>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600">Priority</span>
                <div className="mt-1">{getPriorityBadge(request.priority)}</div>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600">Required By</span>
                <p className="text-base">{formatDateTime(request.required_by)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Requester Details */}
          <Card>
            <CardHeader>
              <CardTitle>Requester Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-sm font-medium text-gray-600">Created By</span>
                  <p className="text-base">{request.creator?.full_name || 'Unknown'}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Department</span>
                  <p className="text-base capitalize">{request.department}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Mobile No</span>
                  <p className="text-base">{request.mobile_no}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium text-gray-600">Pickup Responsibility</span>
                  <p className="text-base capitalize">{request.pickup_responsibility.replace('_', ' ')}</p>
                </div>
                {request.pickup_remarks && (
                  <div>
                    <span className="text-sm font-medium text-gray-600">Pickup Remarks</span>
                    <p className="text-base">{request.pickup_remarks}</p>
                  </div>
                )}
              </div>
              {request.delivery_address && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Delivery Address</span>
                  <p className="text-base whitespace-pre-line">{request.delivery_address}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 3: Client Project Details */}
          <Card>
            <CardHeader>
              <CardTitle>Client Project Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium text-gray-600">Client Type</span>
                  <p className="text-base capitalize">{request.client_type}</p>
                </div>
                {request.client_type_remarks && (
                  <div>
                    <span className="text-sm font-medium text-gray-600">Client Type Remarks</span>
                    <p className="text-base">{request.client_type_remarks}</p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-sm font-medium text-gray-600">Client/Architect/Project Name</span>
                  <p className="text-base">{request.client_project_name}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Mobile</span>
                  <p className="text-base">{request.client_phone}</p>
                </div>
                {request.client_email && (
                  <div>
                    <span className="text-sm font-medium text-gray-600">Email</span>
                    <p className="text-base">{request.client_email}</p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium text-gray-600">Company Firm Name</span>
                  <p className="text-base">{request.company_firm_name}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Site Location</span>
                  <p className="text-base">{request.site_location}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 4: Sample Details */}
          <Card>
            <CardHeader>
              <CardTitle>Sample Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-sm font-medium text-gray-600">Product Type</span>
                  <p className="text-base capitalize">{request.product_type}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Quality</span>
                  <p className="text-base capitalize">{request.quality}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Quantity</span>
                  <p className="text-base">{request.quantity} pieces</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-sm font-medium text-gray-600">Sample Size</span>
                  <p className="text-base">{request.sample_size}</p>
                </div>
                {request.sample_size_remarks && (
                  <div className="md:col-span-2">
                    <span className="text-sm font-medium text-gray-600">Size Remarks</span>
                    <p className="text-base">{request.sample_size_remarks}</p>
                  </div>
                )}
              </div>

              {request.finish && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <span className="text-sm font-medium text-gray-600">Finish</span>
                    <p className="text-base">{request.finish}</p>
                  </div>
                  {request.finish_remarks && (
                    <div className="md:col-span-2">
                      <span className="text-sm font-medium text-gray-600">Finish Remarks</span>
                      <p className="text-base">{request.finish_remarks}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-sm font-medium text-gray-600">Thickness</span>
                  <p className="text-base">{request.thickness}</p>
                </div>
                {request.thickness_remarks && (
                  <div className="md:col-span-2">
                    <span className="text-sm font-medium text-gray-600">Thickness Remarks</span>
                    <p className="text-base">{request.thickness_remarks}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium text-gray-600">Purpose of Sample</span>
                  <p className="text-base capitalize">{request.purpose.replace('_', ' ')}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Packing</span>
                  <p className="text-base capitalize">{request.packing_details.replace('_', ' ')}</p>
                </div>
              </div>

              {request.packing_remarks && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Packing Remarks</span>
                  <p className="text-base">{request.packing_remarks}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 5: Additional Information */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

            {/* Timestamps */}
            <Card>
              <CardHeader>
                <CardTitle>Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
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
                {request.maker && (
                  <div>
                    <span className="text-sm font-medium text-gray-600">Assigned To</span>
                    <p className="text-base">{request.maker.full_name}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Request Actions - for coordinators */}
        <RequestActions request={request} userRole={profile?.role || ''} />

        {/* Maker Actions - for makers */}
        <MakerActions request={request} userRole={profile?.role || ''} userId={profile?.id || ''} />
      </main>
    </div>
  );
}
