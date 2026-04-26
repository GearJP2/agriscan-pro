import { motion } from "framer-motion";
import { Link } from "react-router-dom";

export const ResearchAccessSection = () => {
  return (
    <section className="w-full py-16 bg-background relative overflow-hidden">
      <div className="max-w-container-max mx-auto px-gutter">
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="glass-panel p-8 lg:p-10 rounded-[40px] flex flex-col lg:flex-row lg:items-stretch gap-10 lg:gap-16 overflow-hidden relative shadow-2xl border-border"
        >
          {/* Decorative Background Blob */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 -z-10"></div>
          
          {/* Image content - Link to Height */}
          <div className="hidden lg:block flex-1 w-full max-w-[450px] shrink-0 relative">
            <div className="absolute inset-0 group overflow-hidden rounded-[24px] shadow-lg">
              <img
                alt="Laboratory Research Illustration"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                src="/assets/images/laboratory-research-premium.png"
              />
              <div className="absolute inset-0 ring-1 ring-black/5 rounded-[24px] pointer-events-none"></div>
              <div className="absolute inset-0 bg-gradient-to-tr from-emerald-950/20 to-transparent"></div>
            </div>
          </div>

          {/* Text content - Height Master */}
          <div className="flex-[1.2] text-left py-2">
            <span className="font-label-sm text-label-sm text-primary font-bold mb-3 block uppercase tracking-[0.3em]">RESEARCH ACCESS</span>
            <h2 className="font-headline-md text-headline-md text-foreground mb-4">Open to researchers and collaborators.</h2>
            <p className="text-lg text-muted-foreground leading-relaxed mb-6">
              AgriScan Pro is developed and maintained by the Faculty of Agriculture. Access is available to enrolled students, affiliated researchers, and partner institutions working in food safety and mycotoxin science.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 mb-8">
              <Link 
                to="/doc" 
                className="w-full sm:w-auto bg-primary text-primary-foreground font-bold text-[13px] px-10 py-4 rounded-full flex items-center justify-center gap-2 hover:opacity-90 transition-all group/btn shadow-lg"
              >
                Contact Us
                <span className="material-symbols-outlined text-[18px] transition-transform group-hover/btn:translate-x-1">arrow_forward</span>
              </Link>
              <Link 
                to="/doc" 
                className="w-full sm:w-auto border-2 border-border text-foreground font-bold text-[13px] px-10 py-4 rounded-full flex items-center justify-center gap-2 hover:bg-muted transition-all"
              >
                Documentation
              </Link>
            </div>

            {/* Integrated Statistics Grid */}
            <div className="pt-8 border-t border-border">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { val: "12,400+", label: "Samples" },
                  { val: "8", label: "Toxins" },
                  { val: "20+", label: "Varieties" },
                  { val: "4", label: "Teams" },
                ].map((s, i) => (
                  <motion.div 
                    key={s.label}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.1, duration: 0.5 }}
                    viewport={{ once: true }}
                    className="flex flex-col gap-1"
                  >
                    <p className="text-[20px] font-bold text-foreground leading-none">{s.val}</p>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{s.label}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
