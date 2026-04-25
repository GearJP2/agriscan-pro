import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { CloudRain, AlertCircle } from 'lucide-react';

export default function EnvironmentalKinetics() {
  return (
    <Card className="glass-card overflow-hidden relative border-2 border-border dark:border-border/50 bg-card dark:bg-card rounded-2xl shadow-none">
      <CardHeader className="pb-4 px-6 pt-5 bg-card dark:bg-card border-b border-border/5 shadow-none">
        <CardTitle className="text-xl flex items-center gap-2 font-black uppercase tracking-tighter text-slate-900 dark:text-white">
          <CloudRain className="w-5 h-5 text-primary" />
          Environmental Kinetics (TMD)
        </CardTitle>
      </CardHeader>
      
      <CardContent className="h-64 flex items-center justify-center relative">
        {/* Blueprint background grid */}
        <div 
          className="absolute inset-0 opacity-10 dark:opacity-20 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle at 100% 150%, var(--primary) 24%, white 25%, white 28%, var(--primary) 29%, var(--primary) 36%, white 36%, white 40%, transparent 40%, transparent), radial-gradient(circle at 0 150%, var(--primary) 24%, white 25%, white 28%, var(--primary) 29%, var(--primary) 36%, white 36%, white 40%, transparent 40%, transparent), radial-gradient(circle at 50% 100%, white 10%, var(--primary) 11%, var(--primary) 23%, white 24%, white 30%, var(--primary) 31%, var(--primary) 43%, white 44%, white 50%, var(--primary) 51%, var(--primary) 63%, white 64%, white 71%, transparent 71%, transparent)',
            backgroundSize: '100px 50px'
          }}
        />
 
        {/* Overlay Message */}
        <div className="z-10 bg-card dark:bg-slate-900/90 backdrop-blur-md border-2 border-border dark:border-white/10 p-6 rounded-2xl max-w-sm text-center space-y-3 mx-4 shadow-none">
          <div className="mx-auto bg-amber-500/10 text-amber-500 p-3 rounded-full w-12 h-12 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h4 className="font-black uppercase tracking-tighter text-slate-900 dark:text-white">API Connection Required</h4>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 font-bold leading-relaxed">
            This module requires connection to the Thai Meteorological Department (TMD) API to generate moisture vs. mycotoxin kinetic correlation plots.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
