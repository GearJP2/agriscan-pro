import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const steps = [
  {
    id: "01",
    label: "Collection",
    title: "Import Data",
    desc: "Seamlessly integrate sample logs from your existing LIMS or upload raw sequencing files securely through our encrypted portal. Scalable ingestion for high-throughput labs.",
    gradient: "from-emerald-400 to-emerald-600",
    blob: "from-emerald-500/10",
    iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
    iconBorder: "border-emerald-200 dark:border-emerald-800",
    svg: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-14 h-14 text-foreground">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
      </svg>
    )
  },
  {
    id: "02",
    label: "Calibration",
    title: "Set Thresholds",
    desc: "Define critical boundaries for Aflatoxins and DON based on global compliance standards. Automated alerts trigger if any sample breaches your safety indices.",
    gradient: "from-sky-400 to-sky-600",
    blob: "from-sky-500/10",
    iconBg: "bg-sky-50 dark:bg-sky-950/30",
    iconBorder: "border-sky-200 dark:border-sky-800",
    svg: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-14 h-14 text-foreground">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 18H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 12h9.75" />
      </svg>
    )
  },
  {
    id: "03",
    label: "Intelligence",
    title: "AI Trend Analysis",
    desc: "Our bioinformatics engine models historical data against real-time climate inputs to predict fungal bloom likelihood weeks in advance. Proactive intervention at scale.",
    gradient: "from-blue-500 to-blue-700",
    blob: "from-blue-500/10",
    iconBg: "bg-blue-50 dark:bg-blue-950/30",
    iconBorder: "border-blue-200 dark:border-blue-800",
    svg: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-14 h-14 text-foreground">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    )
  }
];

export const WorkflowSection = () => {
  return (
    <section className="relative w-full max-w-container-max mx-auto px-gutter py-24 font-['Plus_Jakarta_Sans']">
      <div className="text-center mb-16">
        <h2 className="font-headline-lg text-headline-lg text-foreground mb-4">Three steps to safer food</h2>
        <p className="font-body-md text-muted-foreground max-w-2xl mx-auto">A streamlined, bio-intelligence workflow designed for high-throughput, clinical laboratory environments.</p>
      </div>
      <div className="grid grid-cols-1 gap-8">
        {steps.map((step, idx) => (
          <motion.div 
            key={step.id}
            initial={{ opacity: 0, x: idx % 2 === 0 ? -30 : 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: idx * 0.1 }}
            viewport={{ once: true, margin: "-100px" }}
            className="bg-card rounded-2xl border border-blue-600/20 p-10 flex flex-col md:flex-row justify-between items-center relative overflow-hidden group shadow-sm hover:shadow-md transition-shadow"
          >
            <div className={cn("absolute left-0 top-0 w-full h-1 bg-gradient-to-r", step.gradient)}></div>
            <div className={cn("absolute right-0 bottom-0 w-[400px] h-[400px] bg-gradient-to-br to-transparent rounded-tl-full blur-3xl -z-10 transition-colors group-hover:opacity-80", step.blob)}></div>
            <div className="max-w-2xl text-left">
              <span className="font-label-sm text-label-sm text-foreground mb-4 block uppercase tracking-widest">{step.id} {step.label}</span>
              <h3 className="font-headline-md text-headline-md text-foreground mb-2">{step.title}</h3>
              <p className="font-body-md text-body-md text-muted-foreground leading-relaxed">{step.desc}</p>
            </div>
            <motion.div 
              whileHover={{ rotate: 5, scale: 1.1 }}
              className="mt-8 md:mt-0 relative group"
            >
              <div className={cn("w-32 h-32 rounded-full flex items-center justify-center border shadow-sm relative z-10 transition-colors", step.iconBg, step.iconBorder)}>
                {step.svg}
              </div>
              <div className="absolute inset-0 bg-slate-500/5 rounded-full blur-xl scale-125 -z-10"></div>
            </motion.div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};
