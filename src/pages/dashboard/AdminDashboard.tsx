import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useAllRequestsStats } from '@/lib/api/requests';
import { Inbox, Clock, Cog, Package, ArrowRight } from 'lucide-react';

export default function AdminDashboard() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { data: stats, isLoading } = useAllRequestsStats();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{profile?.full_name}</span>
            <Button variant="outline" size="sm" onClick={signOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Requests */}
          <Card
            className="cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200 border-l-4 border-l-blue-500 group"
            onClick={() => navigate('/requests')}
          >
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Inbox className="h-4 w-4" />
                  Total Requests
                </div>
                <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">
                {isLoading ? '...' : stats?.total || 0}
              </p>
            </CardContent>
          </Card>

          {/* Pending */}
          <Card
            className="cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200 border-l-4 border-l-yellow-500 group"
            onClick={() => navigate('/requests?status=pending')}
          >
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Pending
                </div>
                <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-yellow-600">
                {isLoading ? '...' : stats?.pending || 0}
              </p>
            </CardContent>
          </Card>

          {/* In Production */}
          <Card
            className="cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200 border-l-4 border-l-purple-500 group"
            onClick={() => navigate('/requests?status=in_production')}
          >
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cog className="h-4 w-4" />
                  In Production
                </div>
                <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-purple-600">
                {isLoading ? '...' : stats?.in_production || 0}
              </p>
            </CardContent>
          </Card>

          {/* Dispatched */}
          <Card
            className="cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200 border-l-4 border-l-green-500 group"
            onClick={() => navigate('/requests?status=dispatched')}
          >
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Dispatched
                </div>
                <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">
                {isLoading ? '...' : stats?.dispatched || 0}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-4 flex-wrap">
          <Button size="lg" onClick={() => navigate('/requests')}>
            View All Requests
          </Button>
          <Button variant="outline" onClick={() => navigate('/admin/users')}>
            Manage Users
          </Button>
        </div>
      </main>
    </div>
  );
}
