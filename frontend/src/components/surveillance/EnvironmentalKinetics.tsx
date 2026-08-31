import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { EnvironmentalCorrelationResponse } from '@/types/dashboard';
import { AlertCircle, ChevronDown, CloudRain, Droplets, Loader2, MapPin, Thermometer, Waves } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface EnvironmentalKineticsProps {
  data?: EnvironmentalCorrelationResponse;
  isLoading?: boolean;
  isError?: boolean;
}

function formatValue(value: number | null | undefined, unit: string) {
  if (value === null || value === undefined) return 'N/A';
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}`;
}

export default function EnvironmentalKinetics({ data, isLoading = false, isError = false }: EnvironmentalKineticsProps) {
  const [isOpen, setIsOpen] = useState(true);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const summary = data?.summary;
  const metrics = [
    {
      label: 'T2M Air Temp',
      value: formatValue(summary?.temperatureC, 'C'),
      icon: Thermometer,
      color: 'text-rose-500',
    },
    {
      label: 'RH2M Humidity',
      value: formatValue(summary?.relativeHumidityPct, '%'),
      icon: Droplets,
      color: 'text-sky-500',
    },
    {
      label: 'PRECTOTCORR Rain',
      value: formatValue(summary?.precipitationMmHour, 'mm/hour'),
      icon: CloudRain,
      color: 'text-blue-500',
    },
    {
      label: 'TS Skin Temp',
      value: formatValue(summary?.soilTemperatureC, 'C'),
      icon: Waves,
      color: 'text-amber-500',
    },
  ];

  return (
    <Card className="overflow-hidden relative border border-gfs-maroon/15 dark:border-white/10 bg-white dark:bg-slate-900/80 rounded-gfs-card shadow-gfs-card font-sans">
      <CardHeader className="pb-4 px-6 pt-5 bg-white dark:bg-slate-900 border-b border-gfs-maroon/10 dark:border-white/10">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 font-sans">
              <div className="h-6 w-1.5 bg-gfs-gold rounded-full shrink-0" />
              <CardTitle className="text-xl font-bold tracking-tight text-gfs-maroon dark:text-white">
                Environmental Analysis
              </CardTitle>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen((open) => !open)}
              aria-expanded={isOpen}
              aria-controls="environmental-analysis-content"
              className="p-2 rounded-xl bg-gfs-canvas dark:bg-white/10 text-gfs-maroon dark:text-gfs-gold hover:bg-gfs-maroon hover:text-white transition-all active:scale-95 border border-gfs-maroon/20 md:hidden"
              title={isOpen ? 'Collapse Section' : 'Expand Section'}
            >
              <ChevronDown className={cn('w-4 h-4 transition-transform duration-500', !isOpen && 'rotate-180')} />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-gfs-text-muted">
            <span className="rounded-full border border-gfs-maroon/20 bg-gfs-maroon/5 dark:bg-white/5 px-3 py-1 text-gfs-maroon dark:text-gfs-gold">{data?.source ?? 'NASA POWER'}</span>
            {data?.location && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gfs-maroon/20 bg-gfs-maroon/5 dark:bg-white/5 px-3 py-1 text-gfs-maroon dark:text-gfs-gold">
                <MapPin className="h-3 w-3" />
                {data.location.label}
              </span>
            )}
            {data?.cache && (
              <span className="rounded-full border border-gfs-maroon/20 bg-gfs-maroon/5 dark:bg-white/5 px-3 py-1 text-gfs-maroon dark:text-gfs-gold">
                Cache {data.cache.status}
              </span>
            )}
            <button
              type="button"
              onClick={() => setIsOpen((open) => !open)}
              aria-expanded={isOpen}
              aria-controls="environmental-analysis-content"
              className="hidden p-2 rounded-xl bg-gfs-canvas dark:bg-white/10 text-gfs-maroon dark:text-gfs-gold hover:bg-gfs-maroon hover:text-white transition-all active:scale-95 border border-gfs-maroon/20 md:inline-flex"
              title={isOpen ? 'Collapse Section' : 'Expand Section'}
            >
              <ChevronDown className={cn('w-4 h-4 transition-transform duration-500', !isOpen && 'rotate-180')} />
            </button>
          </div>
        </div>
      </CardHeader>

      {isOpen && (
        <CardContent id="environmental-analysis-content" className="p-6 space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 ease-out">
          {isLoading ? (
            <div className="h-64 flex items-center justify-center text-gfs-text-muted">
              <Loader2 className="h-6 w-6 animate-spin text-gfs-maroon dark:text-gfs-gold" />
            </div>
          ) : isError || !data ? (
            <div className="h-64 flex items-center justify-center">
              <div className="max-w-sm rounded-gfs-card border border-amber-300/80 bg-amber-50/80 dark:bg-amber-950/30 p-6 text-center shadow-sm">
                <AlertCircle className="mx-auto mb-3 h-6 w-6 text-amber-600 dark:text-amber-400" />
                <p className="text-sm font-bold text-amber-900 dark:text-amber-200">NASA POWER data unavailable</p>
                <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-300/80">
                  Environmental data could not be loaded for the current dashboard filter.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-gfs-maroon/10 pb-4 border-b border-gfs-maroon/10">
                {metrics.map((metric, idx) => {
                  const Icon = metric.icon;
                  return (
                    <div key={metric.label} className={cn("py-2 sm:py-0", idx === 0 ? "sm:pr-5" : idx === 3 ? "sm:pl-5" : "sm:px-5")}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gfs-text-muted">{metric.label}</span>
                        <Icon className={`h-3.5 w-3.5 ${metric.color}`} />
                      </div>
                      <p className="mt-1 text-2xl font-extrabold tracking-tight text-gfs-maroon dark:text-gfs-gold">{metric.value}</p>
                    </div>
                  );
                })}
              </div>

              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.points} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(122,31,31,0.08)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#666666' }} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="temp" tick={{ fontSize: 10, fill: '#666666' }} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="humidity" orientation="right" tick={{ fontSize: 10, fill: '#666666' }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 14,
                        border: '1px solid rgba(122,31,31,0.2)',
                        background: isDark ? '#0f1418' : '#ffffff',
                        boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
                        color: isDark ? '#f8fafc' : '#313131',
                      }}
                    />
                    <Line yAxisId="temp" type="monotone" dataKey="temperatureC" name="T2M C" stroke="#7a1f1f" strokeWidth={2.5} dot={false} />
                    <Line yAxisId="humidity" type="monotone" dataKey="relativeHumidityPct" name="RH2M %" stroke="#0284c7" strokeWidth={2} dot={false} />
                    <Line yAxisId="humidity" type="monotone" dataKey="precipitationMmHour" name="Rain mm/hour" stroke="#2563eb" strokeWidth={2} dot={false} />
                    <Line yAxisId="temp" type="monotone" dataKey="soilTemperatureC" name="TS C" stroke="#FFC72C" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gfs-maroon/10 pt-4 text-xs font-medium text-gfs-text-muted">
                <span>
                  Window {data.request.start} to {data.request.end}, capped at {data.request.maxDays} days
                </span>
                <span className="font-bold text-gfs-text-primary dark:text-white">Total rainfall equivalent: {formatValue(summary?.precipitationTotalMm, 'mm')}</span>
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
