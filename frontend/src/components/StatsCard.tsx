import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

const StatsCard = ({ title, value, icon: Icon, trend, variant = 'default' }: StatsCardProps) => {
  const variantStyles = {
    default: 'bg-gfs-maroon/10 text-gfs-maroon dark:bg-gfs-gold/15 dark:text-gfs-gold',
    success: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
    warning: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
    danger: 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400',
  };

  return (
    <Card className="rounded-gfs-card border border-gfs-maroon/15 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 shadow-gfs-card hover:shadow-gfs-card-hover transition-all duration-300 font-sans group animate-fade-in">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-gfs-text-muted dark:text-slate-400 uppercase tracking-wider">{title}</p>
            <p className="text-3xl font-extrabold tracking-tight text-gfs-maroon dark:text-white group-hover:text-gfs-maroon-hover dark:group-hover:text-gfs-gold transition-colors">{value}</p>
            {trend && (
              <p className="mt-1 text-xs font-medium text-gfs-text-muted dark:text-slate-400">{trend}</p>
            )}
          </div>
          <div className={cn('rounded-xl p-3 transition-transform duration-300 group-hover:scale-105', variantStyles[variant])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StatsCard;
