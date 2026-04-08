import { FolderOpen } from 'lucide-react';
import Header from '@/components/Header';
import { Card, CardContent } from '@/components/ui/card';

const Activity = () => {
  return (
    <div className="min-h-screen bg-background">
      <main className="container py-8 max-w-2xl">
        {/* Page Title */}
        <div className="flex items-center gap-3 mb-6">
          <FolderOpen className="h-6 w-6 text-foreground" />
          <h1 className="text-2xl font-bold text-foreground">Activity</h1>
        </div>

        <Card className="glass-card">
          <CardContent className="p-12 text-center">
            <FolderOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Activity Log</h2>
            <p className="text-muted-foreground">
              Activity tracking feature is coming soon.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              You'll be able to view your recent actions and sample history here.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Activity;
