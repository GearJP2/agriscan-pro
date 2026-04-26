import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
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

export const InsightsSection = () => {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!api) return;
    const id = setInterval(() => api.scrollNext(), 5000);
    api.on("select", () => setCurrent(api.selectedScrollSnap() % blogs.length));
    return () => clearInterval(id);
  }, [api]);

  return (
    <section className="relative w-full max-w-container-max mx-auto px-gutter pt-24 pb-0 overflow-hidden font-['Plus_Jakarta_Sans']">
      <div className="mb-10 text-left">
        <p className="font-label-sm text-label-sm text-foreground mb-2 uppercase tracking-widest">Insights</p>
        <div className="flex justify-between items-end border-b border-border pb-4">
          <h2 className="font-headline-lg text-headline-lg text-foreground">From our latest blog</h2>
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
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="relative z-20"
                  >
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
                  </motion.div>
                </article>
              </CarouselItem>
            ))}
          </CarouselContent>
          <button
            onClick={() => api?.scrollPrev()}
            className="absolute left-6 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full flex items-center justify-center text-white bg-black/30 backdrop-blur-md transition-all hover:bg-black/90 shadow-lg border border-white/5 opacity-0 group-hover/carousel:opacity-100"
            aria-label="Previous slide"
          >
            <span className="material-symbols-outlined text-[24px]">chevron_left</span>
          </button>
          <button
            onClick={() => api?.scrollNext()}
            className="absolute right-6 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full flex items-center justify-center text-white bg-black/30 backdrop-blur-md transition-all hover:bg-black/90 shadow-lg border border-white/5 opacity-0 group-hover/carousel:opacity-100"
            aria-label="Next slide"
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
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {blogs.map((b, i) => (
          <motion.article
            key={i}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: (i % 3) * 0.1 }}
            whileHover={{ y: -8, transition: { duration: 0.2 } }}
            onClick={() => api?.scrollTo(i)}
            className={cn(
              "glass-panel rounded-2xl overflow-hidden group cursor-pointer flex flex-col",
              current === i ? "border-blue-600 bg-accent/20 dark:bg-card/40 shadow-xl" : "hover:shadow-2xl"
            )}
          >
            <div className="h-[220px] overflow-hidden relative">
              <img alt={b.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" src={b.image} />
              {current === i && (
                <div className="absolute inset-0 bg-blue-600/5 backdrop-blur-[2px] transition-all"></div>
              )}
            </div>
            <div className="p-6 flex flex-col flex-grow text-left">
              <span className={cn("font-label-sm text-[10px] font-bold mb-3 block uppercase tracking-widest", current === i ? "text-blue-600" : "text-muted-foreground")}>
                {b.category}
              </span>
              <h3 className={cn("font-semibold mb-2 transition-all duration-300", 
                current === i 
                  ? "text-[16px] underline underline-offset-4 text-foreground" 
                  : "text-[14px] text-foreground"
              )}>
                {b.title}
              </h3>
              <p className="font-body-md text-[13px] text-muted-foreground leading-relaxed mt-auto">
                {b.desc}
              </p>
            </div>
          </motion.article>
        ))}
      </div>

      <div className="mt-12 flex justify-center">
        <Link 
          to="/doc"
          className="inline-flex items-center gap-3 px-8 py-4 rounded-xl glass-panel !border-2 !border-blue-600 text-blue-600 font-bold text-sm tracking-wider hover:bg-foreground hover:text-background hover:border-foreground transition-all duration-300 group/btn shadow-sm"
        >
          ACCESS RESEARCH PORTAL
          <span className="material-symbols-outlined text-[20px] transition-transform group-hover/btn:translate-x-1.5">chevron_right</span>
        </Link>
      </div>
    </section>
  );
};
