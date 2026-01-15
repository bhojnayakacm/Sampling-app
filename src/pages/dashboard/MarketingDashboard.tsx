import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useDashboardStats } from '@/lib/api/requests';

export default function MarketingDashboard() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { data: stats, isLoading } = useDashboardStats(profile?.id);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">My Requests</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{profile?.full_name}</span>
            <Button variant="outline" size="sm" onClick={signOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">My Total Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {isLoading ? '...' : stats?.total || 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {isLoading ? '...' : stats?.inProgress || 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">Dispatched</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {isLoading ? '...' : stats?.dispatched || 0}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-4">
          <Button size="lg" onClick={() => navigate('/requests/new')}>
            Create New Request
          </Button>
          <Button variant="outline" onClick={() => navigate('/requests')}>
            View My Requests
          </Button>
        </div>
      </main>
    </div>
  );
}
