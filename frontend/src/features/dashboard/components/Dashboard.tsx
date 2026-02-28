import { useMemo } from 'react';
import Header from '@/components/Header';
import SystemOverview from './SystemOverview';
import RiskOverview from './RiskOverview';
import ActionItems from './ActionItems';
import { mockSamples } from '@/data/mockSamples';
import { useAuth } from '@/contexts/AuthContext';

const Dashboard = () => {
  const { isAdmin } = useAuth();

  // In real app, this would come from a query
  const samples = useMemo(() => mockSamples, []);

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
          {/* System Overview - Admin only */}
          {isAdmin && <SystemOverview samples={samples} />}

          {/* Risk Overview - Visible to all */}
          <RiskOverview samples={samples} />

          {/* Action Items - More detailed for admins */}
          <ActionItems samples={samples} />
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
