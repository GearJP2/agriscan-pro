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

  // fetch samples for dashboard calculations
  const { data: samplesData, isLoading, error } = useQuery(
    ['samples', {}],
    () => sampleAPI.getSamples(undefined, 1000),
    { enabled: isAuthenticated }
  );
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
