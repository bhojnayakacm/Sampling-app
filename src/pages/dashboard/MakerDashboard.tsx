import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useMakerStats } from '@/lib/api/requests';
import { Inbox, Hammer, CheckCircle, ArrowRight } from 'lucide-react';

export default function MakerDashboard() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { data: stats, isLoading } = useMakerStats(profile?.id);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">My Tasks</h1>
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
          {/* Assigned to Me */}
          <Card
            className="cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200 border-l-4 border-l-blue-500 group"
            onClick={() => navigate('/requests?status=assigned')}
          >
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Inbox className="h-4 w-4" />
                  Assigned to Me
                </div>
                <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">
                {isLoading ? '...' : stats?.assigned || 0}
              </p>
            </CardContent>
          </Card>

          {/* In Progress */}
          <Card
            className="cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200 border-l-4 border-l-orange-500 group"
            onClick={() => navigate('/requests?status=in_production')}
          >
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Hammer className="h-4 w-4" />
                  In Progress
                </div>
                <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-orange-600">
                {isLoading ? '...' : stats?.in_progress || 0}
              </p>
            </CardContent>
          </Card>

          {/* Completed */}
          <Card
            className="cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200 border-l-4 border-l-green-500 group"
            onClick={() => navigate('/requests?status=completed')}
          >
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Completed
                </div>
                <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">
                {isLoading ? '...' : stats?.completed || 0}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-4">
          <Button size="lg" onClick={() => navigate('/requests')}>View All Tasks</Button>
        </div>
      </main>
    </div>
  );
}
