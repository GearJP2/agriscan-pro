import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Database,
  Cpu,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

const blogs = [
  {
    image: "/assets/images/blog-1.jpg",
    tag: "FIELD TO LAB",
    category: "CROP PROTECTION",
    title: "Protecting harvests at every stage",
    desc: "How AI-driven bio-analytics are securing the future of global food supplies.",
  },
  {
    image: "/assets/images/blog-2.jpg",
    tag: "FEATURED CASE",
    category: "MOLECULAR ANALYSIS",
    title: "Molecular Integrity in Plant Science",
    desc: "Structural degradation analysis in conventions vs bio-optimized environments.",
  },
  {
    image: "/assets/images/blog-3.jpg",
    tag: "GLOBAL PROTOCOL",
    category: "FOOD SAFETY",
    title: "Global Food Safety Protocols 2024",
    desc: "Understanding evolving risks and upcoming regulations in international supply chains.",
  },
  {
    image: "/assets/images/blog-4.jpg",
    tag: "DATA SCIENCE",
    category: "OPTIMIZATION",
    title: "AI-Driven Predictive Harvesting",
    desc: "Leveraging bio-intelligence to determine optimal harvest windows for maximum nutrient density.",
  },
  {
    image: "/assets/images/blog-5.jpg",
    tag: "BIO-DIVERSITY",
    category: "SOIL HEALTH",
    title: "Soil Microbiome Analysis",
    desc: "Understanding cellular interactions within the rhizosphere to predict crop resilience.",
  },
  {
    image: "/assets/images/blog-6.jpg",
    tag: "LOGISTICS",
    category: "BIOSECURITY",
    title: "Supply Chain Biosecurity",
    desc: "End-to-end molecular tracking to prevent contamination from field to global markets.",
  },
];

const Homepage = () => {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!api) return;
    const id = setInterval(() => api.scrollNext(), 5000);
    api.on("select", () => setCurrent(api.selectedScrollSnap() % blogs.length));
    return () => clearInterval(id);
  }, [api]);

  return (
    <div className="min-h-screen bg-white dark:bg-background flex flex-col pt-[50px]">
      <main className="flex-grow flex flex-col">
        {/* Hero Section */}
        <section className="relative w-full max-w-container-max mx-auto px-gutter pt-[60px] pb-[80px] flex flex-col lg:flex-row items-center lg:gap-32">
          <div className="w-full lg:w-1/2 flex flex-col gap-[32px] z-10 text-left">
            <h1 className="font-display-xl text-display-xl text-slate-900 dark:text-white">
              Is your food{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-blue-600">
                safe?
              </span>
            </h1>
            <p className="font-body-lg text-body-lg text-slate-600 dark:text-slate-400 max-w-xl">
              Advanced bio-intelligence and predictive analytics for the modern agricultural supply chain. We analyze molecular integrity to ensure safety at scale.
            </p>
            <div className="flex items-center gap-[16px]">
              <Link 
                to="/dashboard" 
                className="bg-slate-950 dark:bg-white text-white dark:text-slate-950 font-label-sm text-label-sm px-[32px] py-[16px] h-auto rounded-full hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors inline-block"
              >
                START ANALYSIS
              </Link>
              <Link 
                to="/doc" 
                className="glass-panel text-slate-900 dark:text-white font-label-sm text-label-sm px-[32px] py-[16px] h-auto rounded-full hover:bg-surface-bright transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">science</span>
                VIEW METHODOLOGY
              </Link>
            </div>
            {/* Data Preview */}
            <div className="mt-[24px] grid grid-cols-2 gap-[16px]">
              <div className="glass-panel p-[16px] rounded-xl text-left">
                <p className="font-label-sm text-label-sm text-slate-500 uppercase mb-1">ACCURACY RATE</p>
                <p className="font-headline-md text-headline-md text-primary">99.9%</p>
              </div>
              <div className="glass-panel p-[16px] rounded-xl text-left">
                <p className="font-label-sm text-label-sm text-slate-500 uppercase mb-1">DATAPOINTS ANALYZED</p>
                <p className="font-headline-md text-headline-md text-blue-600">4.2B+</p>
              </div>
            </div>
          </div>
          <div className="w-full lg:w-1/2 relative min-h-[500px] flex items-center justify-center">
            {/* Abstract Data Graphic */}
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-secondary/20 rounded-full blur-3xl opacity-50"></div>
            <img
              alt="Bio-intelligence visualization"
              className="w-full h-auto object-cover rounded-2xl glass-panel relative z-10 mix-blend-multiply dark:mix-blend-normal opacity-90 transition-all duration-500 lg:ml-12"
              src="/assets/images/hero-visualization.png"
            />
            {/* Floating Data Cards */}
            <div className="absolute top-[10%] -left-[10%] glass-panel p-[16px] rounded-xl z-20 shadow-lg border border-white/40 hidden md:block text-left">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                <span className="font-label-sm text-label-sm text-slate-500">LIVE SCAN</span>
              </div>
              <p className="font-body-md text-body-md text-slate-900 dark:text-white font-medium">Pathogen detection active</p>
            </div>
          </div>
        </section>

        {/* Insights / Blog Section */}
        <section className="relative w-full max-w-container-max mx-auto px-gutter pt-24 pb-0 overflow-hidden font-['Plus_Jakarta_Sans']">
          <div className="mb-10 text-left">
            <p className="font-label-sm text-label-sm text-slate-900 dark:text-white mb-2 uppercase tracking-widest">Insights</p>
            <div className="flex justify-between items-end border-b border-slate-100 dark:border-slate-800 pb-4">
              <h2 className="font-headline-lg text-headline-lg text-slate-900 dark:text-white">From our latest blog</h2>
            </div>
          </div>

          <div className="relative mb-16 rounded-3xl overflow-hidden shadow-2xl border-2 border-blue-600/20 group/carousel">
            <Carousel setApi={setApi} opts={{ align: "start", loop: true }} className="w-full">
              <CarouselContent className="-ml-0">
                {blogs.map((b, i) => (
                  <CarouselItem key={i} className="basis-full pl-0">
                    <article className="relative min-h-[480px] flex flex-col justify-end p-12 md:p-16 text-left">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10"></div>
                      <img alt={b.title} className="absolute inset-0 w-full h-full object-cover" src={b.image} />
                      <div className="relative z-20">
                        <h2 className="font-display-xl text-3xl text-white font-bold leading-tight mb-8 max-w-3xl">
                          {b.title}
                        </h2>
                        <Link 
                          to="/doc"
                          className="bg-white text-slate-950 font-bold text-sm tracking-tight px-8 py-4 rounded-full hover:bg-slate-100 transition-all flex items-center gap-2 group/btn shadow-lg w-fit"
                        >
                          READ FULL REPORT
                          <span className="material-symbols-outlined text-[20px] transition-transform group-hover/btn:translate-x-1">description</span>
                        </Link>
                      </div>
                    </article>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <button
                onClick={() => api?.scrollPrev()}
                className="absolute left-6 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full flex items-center justify-center text-white bg-black/30 backdrop-blur-md transition-all hover:bg-black/90 shadow-lg border border-white/5 opacity-0 group-hover/carousel:opacity-100"
              >
                <span className="material-symbols-outlined text-[24px]">chevron_left</span>
              </button>
              <button
                onClick={() => api?.scrollNext()}
                className="absolute right-6 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full flex items-center justify-center text-white bg-black/30 backdrop-blur-md transition-all hover:bg-black/90 shadow-lg border border-white/5 opacity-0 group-hover/carousel:opacity-100"
              >
                <span className="material-symbols-outlined text-[24px]">chevron_right</span>
              </button>
            </Carousel>
            
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-3 z-30">
              {blogs.map((_, i) => (
                <button
                  key={i}
                  onClick={() => api?.scrollTo(i)}
                  className={cn("h-2.5 rounded-full transition-all duration-400", current === i ? "w-8 bg-blue-600" : "w-2.5 bg-blue-600/30")}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {blogs.map((b, i) => (
              <article
                key={i}
                onClick={() => api?.scrollTo(i)}
                className={cn(
                  "glass-panel rounded-2xl overflow-hidden group cursor-pointer flex flex-col hover:shadow-xl transition-all duration-500",
                  current === i && "border-blue-600 bg-slate-50 dark:bg-card/40 shadow-md"
                )}
              >
                <div className="h-[220px] overflow-hidden relative">
                  <img alt={b.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" src={b.image} />
                </div>
                <div className="p-6 flex flex-col flex-grow text-left">
                  <span className={cn("font-label-sm text-[10px] font-bold mb-3 block uppercase tracking-widest", current === i ? "text-slate-900 dark:text-white" : "text-slate-400")}>
                    {b.category}
                  </span>
                  <h3 className={cn("font-semibold mb-2 transition-all duration-300", 
                    current === i 
                      ? "text-[16px] underline underline-offset-4 text-slate-900 dark:text-white" 
                      : "text-[14px] text-slate-900 dark:text-white"
                  )}>
                    {b.title}
                  </h3>
                  <p className="font-body-md text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed mt-auto">
                    {b.desc}
                  </p>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-12 flex justify-center">
            <Link 
              to="/doc"
              className="inline-flex items-center gap-3 px-8 py-4 rounded-xl glass-panel !border-2 !border-blue-600 text-blue-600 font-bold text-sm tracking-wider hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all duration-300 group/btn shadow-sm"
            >
              ACCESS RESEARCH PORTAL
              <span className="material-symbols-outlined text-[20px] transition-transform group-hover/btn:translate-x-1.5">chevron_right</span>
            </Link>
          </div>
        </section>

        {/* Workflow Section */}
        <section className="relative w-full max-w-container-max mx-auto px-gutter py-24 font-['Plus_Jakarta_Sans']">
          <div className="text-center mb-16">
            <h2 className="font-headline-lg text-headline-lg text-slate-900 dark:text-white mb-4">Three steps to safer food</h2>
            <p className="font-body-md text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">A streamlined, bio-intelligence workflow designed for high-throughput, clinical laboratory environments.</p>
          </div>
          <div className="grid grid-cols-1 gap-8">
            <div className="bg-white dark:bg-card rounded-2xl border border-blue-600/20 p-10 flex flex-col md:flex-row justify-between items-center relative overflow-hidden group">
              <div className="absolute left-0 top-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-emerald-600"></div>
              <div className="absolute right-0 bottom-0 w-[400px] h-[400px] bg-gradient-to-br from-emerald-500/10 to-transparent rounded-tl-full blur-3xl -z-10 transition-colors group-hover:from-emerald-500/20"></div>
              <div className="max-w-2xl text-left">
                <span className="font-label-sm text-label-sm text-slate-900 dark:text-white mb-4 block uppercase tracking-widest">01 Collection</span>
                <h3 className="font-headline-md text-headline-md text-slate-900 dark:text-white mb-2">Import Data</h3>
                <p className="font-body-md text-body-md text-slate-500 dark:text-slate-400 leading-relaxed">Seamlessly integrate sample logs from your existing LIMS or upload raw sequencing files securely through our encrypted portal. Scalable ingestion for high-throughput labs.</p>
              </div>
              <div className="mt-8 md:mt-0 relative group">
                <div className="w-32 h-32 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center border border-emerald-200 dark:border-emerald-800 shadow-sm relative z-10 transition-transform group-hover:scale-105">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-14 h-14 text-slate-900 dark:text-white">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                  </svg>
                </div>
                <div className="absolute inset-0 bg-emerald-500/5 rounded-full blur-xl scale-125 -z-10"></div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-blue-600/20 p-10 flex flex-col md:flex-row justify-between items-center relative overflow-hidden group">
              <div className="absolute left-0 top-0 w-full h-1 bg-gradient-to-r from-sky-400 to-sky-600"></div>
              <div className="absolute left-0 bottom-0 w-[400px] h-[400px] bg-gradient-to-tr from-sky-500/10 to-transparent rounded-tr-full blur-3xl -z-10 transition-colors group-hover:from-sky-500/20"></div>
              <div className="max-w-2xl text-left">
                <span className="font-label-sm text-label-sm text-slate-900 dark:text-white mb-4 block uppercase tracking-widest">02 Calibration</span>
                <h3 className="font-headline-md text-headline-md text-slate-900 dark:text-white mb-2">Set Thresholds</h3>
                <p className="font-body-md text-body-md text-slate-500 dark:text-slate-400 leading-relaxed">Define critical boundaries for Aflatoxins and DON based on global compliance standards. Automated alerts trigger if any sample breaches your safety indices.</p>
              </div>
              <div className="mt-8 md:mt-0 relative group">
                <div className="w-32 h-32 rounded-full bg-sky-50 dark:bg-sky-950/30 flex items-center justify-center border border-sky-200 dark:border-sky-800 shadow-sm relative z-10 transition-transform group-hover:scale-105">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-14 h-14 text-slate-900 dark:text-white">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 18H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 12h9.75" />
                  </svg>
                </div>
                <div className="absolute inset-0 bg-sky-500/5 rounded-full blur-xl scale-125 -z-10"></div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-blue-600/20 p-10 flex flex-col md:flex-row items-center justify-between relative overflow-hidden group">
              <div className="absolute left-0 top-0 w-full h-1 bg-gradient-to-r from-blue-500 to-blue-700"></div>
              <div className="absolute right-0 bottom-0 w-[400px] h-[400px] bg-gradient-to-tl from-blue-500/10 to-transparent rounded-tr-full blur-3xl -z-10 transition-colors group-hover:from-blue-500/20"></div>
              <div className="max-w-2xl text-left">
                <span className="font-label-sm text-label-sm text-slate-900 dark:text-white mb-4 block uppercase tracking-widest">03 Intelligence</span>
                <h3 className="font-headline-md text-headline-md text-slate-900 dark:text-white mb-2">AI Trend Analysis</h3>
                <p className="font-body-md text-body-md text-slate-500 dark:text-slate-400 leading-relaxed">Our bioinformatics engine models historical data against real-time climate inputs to predict fungal bloom likelihood weeks in advance. Proactive intervention at scale.</p>
              </div>
              <div className="mt-8 md:mt-0 relative group">
                <div className="w-32 h-32 rounded-full bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center border border-blue-200 dark:border-blue-800 shadow-sm relative z-10 transition-transform group-hover:scale-105">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-14 h-14 text-slate-900 dark:text-white">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                </div>
                <div className="absolute inset-0 bg-blue-500/5 rounded-full blur-xl scale-125 -z-10"></div>
              </div>
            </div>
          </div>
        </section>

        {/* Research Access Section */}
        <section className="w-full py-24 bg-white dark:bg-background relative overflow-hidden border-t border-slate-100 dark:border-slate-800">
          <div className="max-w-container-max mx-auto px-gutter">
            <div className="flex flex-col lg:flex-row items-center gap-16 mb-16">
              <div className="w-full lg:w-1/2">
                <div className="relative group">
                  <img
                    alt="Laboratory Research Illustration"
                    className="w-full h-auto rounded-3xl shadow-xl transition-transform duration-500 group-hover:scale-[1.02]"
                    src="/assets/images/laboratory-research.png"
                  />
                  <div className="absolute inset-0 ring-1 ring-black/5 rounded-3xl"></div>
                </div>
              </div>
              <div className="w-full lg:w-1/2 text-left">
                <span className="font-label-sm text-label-sm text-slate-900 dark:text-white font-bold mb-4 block uppercase tracking-[0.3em]">RESEARCH ACCESS</span>
                <h2 className="font-headline-md text-headline-md text-slate-900 dark:text-white mb-6">Open to researchers and collaborators.</h2>
                <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-8">
                  AgriScan Pro is developed and maintained by the Faculty of Agriculture. Access is available to enrolled students, affiliated researchers, and partner institutions working in food safety and mycotoxin science.
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <Link 
                    to="/doc" 
                    className="w-full sm:w-auto bg-emerald-950 text-white font-bold text-[13px] px-8 py-4 rounded-full flex items-center justify-center gap-2 hover:bg-emerald-900 transition-all group/btn shadow-lg"
                  >
                    Contact Us
                    <span className="material-symbols-outlined text-[18px] transition-transform group-hover/btn:translate-x-1">arrow_forward</span>
                  </Link>
                  <Link 
                    to="/doc" 
                    className="w-full sm:w-auto border-2 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold text-[13px] px-8 py-4 rounded-full flex items-center justify-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all"
                  >
                    Documentation
                  </Link>
                </div>
              </div>
            </div>

            <div className="pt-12 border-t border-slate-100 dark:border-slate-800">
              <div className="grid grid-cols-2 md:grid-cols-4 bg-slate-50/50 dark:bg-card/50 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                {[
                  { val: "12,400+", label: "Samples in database" },
                  { val: "8", label: "Mycotoxin types tracked" },
                  { val: "20+", label: "Crop varieties covered" },
                  { val: "4", label: "Active research teams" },
                ].map((s, i) => (
                  <div key={s.label} className={cn("p-6 flex flex-col gap-1 text-left", i < 3 && "border-r border-slate-100 dark:border-slate-800")}>
                    <p className="text-[28px] font-bold text-slate-900 dark:text-white leading-none mb-1">{s.val}</p>
                    <p className="text-[11px] text-slate-500 font-medium uppercase tracking-tight">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="w-full py-20 border-t-2 border-blue-600/20 bg-slate-50/20 dark:bg-background/40 backdrop-blur-sm">
          <div className="max-w-container-max mx-auto px-gutter flex flex-col md:flex-row items-center justify-center gap-12 text-center md:text-left">
            <div className="relative group">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl group-hover:bg-primary/30 transition-colors"></div>
              <div className="w-32 h-32 relative z-10 bg-white rounded-full flex items-center justify-center p-4 shadow-xl border border-slate-100 overflow-hidden">
                <img src="/Emblem_of_Thammasat_University.svg.png" alt="Thammasat University" className="w-full h-full object-contain" />
              </div>
            </div>
            <div className="max-w-xl">
              <span className="font-label-sm text-label-sm text-slate-900 dark:text-white font-bold uppercase tracking-[0.3em] block mb-3">DEVELOPED BY</span>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Thammasat University</h2>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-8 gap-y-4 text-slate-500">
                <p className="text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-emerald-600">biotech</span>
                  Faculty of Food Science
                </p>
                <p className="text-sm border-l border-slate-200 dark:border-slate-800 pl-8 hidden md:flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-blue-600">terminal</span>
                  Faculty of Computer Science
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Homepage;
