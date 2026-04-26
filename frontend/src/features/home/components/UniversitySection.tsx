import { motion } from "framer-motion";

export const UniversitySection = () => {
  return (
    <motion.section 
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 1 }}
      viewport={{ once: true }}
      className="w-full py-20 border-t-2 border-blue-600/20 bg-muted/20 backdrop-blur-sm"
    >
      <div className="max-w-container-max mx-auto px-gutter flex flex-col md:flex-row items-center justify-center gap-12 text-center md:text-left">
        <motion.div 
          whileHover={{ scale: 1.05 }}
          className="relative group"
        >
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl group-hover:bg-primary/30 transition-colors"></div>
          <div className="w-32 h-32 relative z-10 bg-white rounded-full flex items-center justify-center p-4 shadow-xl border border-border overflow-hidden">
            <img src="/Emblem_of_Thammasat_University.svg.png" alt="Thammasat University" className="w-full h-full object-contain" />
          </div>
        </motion.div>
        <div className="max-w-xl">
          <span className="font-label-sm text-label-sm text-foreground font-bold uppercase tracking-[0.3em] block mb-3">DEVELOPED BY</span>
          <h2 className="text-3xl font-bold text-foreground mb-4">Thammasat University</h2>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-8 gap-y-4 text-muted-foreground">
            <div className="text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-emerald-600">biotech</span>
              Faculty of Food Science
            </div>
            <div className="text-sm border-l border-border pl-8 hidden md:flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-blue-600">terminal</span>
              Faculty of Computer Science
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
};
