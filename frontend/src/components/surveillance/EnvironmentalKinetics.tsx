import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { EnvironmentalCorrelationResponse } from '@/types/dashboard';
import { AlertCircle, ChevronDown, CloudRain, Droplets, Loader2, MapPin, Thermometer, Waves } from 'lucide-react';
import { cn } from '@/lib/utils';
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
    <Card className="glass-card overflow-hidden relative border-2 border-border dark:border-border/50 bg-card dark:bg-card rounded-2xl shadow-none">
      <CardHeader className="pb-4 px-6 pt-5 bg-card dark:bg-card border-b border-border/5 shadow-none">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CloudRain className="w-5 h-5 text-primary" />
              <CardTitle className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                Environmental Kinetics
              </CardTitle>
            </div>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2.5 rounded-xl bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-all active:scale-95 border border-border/40 md:hidden"
              title={isOpen ? 'Collapse Section' : 'Expand Section'}
              aria-expanded={isOpen}
            >
              <ChevronDown className={cn('w-5 h-5 transition-transform duration-500', !isOpen && 'rotate-180')} />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-black tracking-normal text-muted-foreground">
            <span className="rounded-md border border-border/50 px-2 py-1">{data?.source ?? 'NASA POWER'}</span>
            {data?.location && (
              <span className="inline-flex items-center gap-1 rounded-md border border-border/50 px-2 py-1">
                <MapPin className="h-3 w-3" />
                {data.location.label}
              </span>
            )}
            {data?.cache && (
              <span className="rounded-md border border-border/50 px-2 py-1">
                Cache {data.cache.status}
              </span>
            )}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="hidden p-2.5 rounded-xl bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-all active:scale-95 border border-border/40 md:inline-flex"
              title={isOpen ? 'Collapse Section' : 'Expand Section'}
              aria-expanded={isOpen}
            >
              <ChevronDown className={cn('w-5 h-5 transition-transform duration-500', !isOpen && 'rotate-180')} />
            </button>
          </div>
        </div>
      </CardHeader>

      {isOpen && (
        <CardContent className="p-6 space-y-5 animate-in fade-in slide-in-from-top-4 duration-500 ease-out">
          {isLoading ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : isError || !data ? (
          <div className="h-64 flex items-center justify-center">
            <div className="max-w-sm rounded-xl border border-warning/20 bg-warning/5 p-5 text-center">
              <AlertCircle className="mx-auto mb-3 h-6 w-6 text-warning" />
              <p className="text-sm font-bold text-foreground">NASA POWER data unavailable</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Environmental data could not be loaded for the current dashboard filter.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {metrics.map((metric) => {
                const Icon = metric.icon;
                return (
                  <div key={metric.label} className="rounded-xl border border-border/30 bg-muted/20 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] font-black tracking-normal text-muted-foreground">{metric.label}</span>
                      <Icon className={`h-4 w-4 ${metric.color}`} />
                    </div>
                    <p className="mt-2 text-lg font-black tracking-tight text-foreground">{metric.value}</p>
                  </div>
                );
              })}
            </div>

            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.points} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="temp" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="humidity" orientation="right" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid hsl(var(--border))',
                      background: 'hsl(var(--card))',
                    }}
                  />
                  <Line yAxisId="temp" type="monotone" dataKey="temperatureC" name="T2M C" stroke="#f43f5e" strokeWidth={2} dot={false} />
                  <Line yAxisId="humidity" type="monotone" dataKey="relativeHumidityPct" name="RH2M %" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                  <Line yAxisId="humidity" type="monotone" dataKey="precipitationMmHour" name="Rain mm/hour" stroke="#2563eb" strokeWidth={2} dot={false} />
                  <Line yAxisId="temp" type="monotone" dataKey="soilTemperatureC" name="TS C" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-3 text-[10px] font-bold text-muted-foreground">
              <span>
                Window {data.request.start} to {data.request.end}, capped at {data.request.maxDays} days
              </span>
              <span>Total rainfall equivalent: {formatValue(summary?.precipitationTotalMm, 'mm')}</span>
            </div>
          </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
