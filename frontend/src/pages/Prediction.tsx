import { TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const Prediction = () => {
  return (
    <div className="min-h-screen bg-background">
      <main className="container py-8 max-w-2xl">
        {/* Page Title */}
        <div className="flex items-center gap-3 mb-6">
          <TrendingUp className="h-6 w-6 text-foreground" />
          <h1 className="text-2xl font-bold text-foreground">Prediction</h1>
        </div>

        <Card className="glass-card">
          <CardContent className="p-12 text-center">
            <TrendingUp className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Prediction Analytics</h2>
            <p className="text-muted-foreground">
              Prediction capability is coming soon.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              You'll be able to view mycotoxin risk predictions and forecasts here.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Prediction;
