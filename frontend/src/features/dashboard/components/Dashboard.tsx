import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Header from '@/components/Header';
import SystemOverview from './SystemOverview';
import RiskOverview from './RiskOverview';
import ActionItems from './ActionItems';
import { useAuth } from '@/contexts/AuthContext';
import { sampleAPI } from '@/lib/api';
import { Loader2, AlertTriangle } from 'lucide-react';

const Dashboard = () => {
  const { isAdmin, isAuthenticated } = useAuth();

  // fetch samples for dashboard calculations - use 'samples-dashboard' key for cache isolation
  const { data: samplesData, isLoading, error } = useQuery({
    queryKey: ['samples-dashboard'],
    queryFn: () => sampleAPI.getSamples(undefined, 1000),
    enabled: isAuthenticated,
  });
  const samples = samplesData?.results || samplesData || [];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="mt-2 text-muted-foreground">
            {isAdmin
              ? 'Monitor system performance, team workload, and risk alerts'
              : 'View risk overview and important alerts'
            }
          </p>
        </div>

        <div className="space-y-8">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
              <AlertTriangle className="mx-auto h-12 w-12 text-red-600 mb-4" />
              <h2 className="text-2xl font-bold text-red-900">Error loading dashboard data</h2>
              <p className="mt-2 text-red-800">There was a problem fetching samples. Please refresh.</p>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : samples.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
              <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">No samples yet</h2>
              <p className="mt-2 text-gray-600">Start by adding samples from the <strong>Sample List</strong> to see dashboard metrics and risk analysis.</p>
            </div>
          ) : (
            <>            
              {/* System Overview - Admin only */}
              {isAdmin && <SystemOverview samples={samples} />}

              {/* Risk Overview - Visible to all */}
              <RiskOverview samples={samples} />

              {/* Action Items - More detailed for admins */}
              <ActionItems samples={samples} />
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
