import { motion } from "framer-motion";
import { Link } from "react-router-dom";

export const HeroSection = () => {
  return (
    <section className="relative w-full max-w-container-max mx-auto px-gutter pt-[60px] pb-[80px] flex flex-col lg:flex-row items-center lg:gap-32">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full lg:w-1/2 flex flex-col gap-[32px] z-10 text-left"
      >
        <h1 className="font-display-xl text-display-xl text-foreground">
          Is your food{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-info">
            safe?
          </span>
        </h1>
        <p className="font-body-lg text-body-lg text-muted-foreground max-w-xl">
          Advanced bio-intelligence and predictive analytics for the modern agricultural supply chain. We analyze molecular integrity to ensure safety at scale.
        </p>
        <div className="flex items-center gap-[16px]">
          <Link 
            to="/dashboard" 
            className="bg-primary text-primary-foreground font-label-sm text-label-sm px-[32px] py-[16px] h-auto rounded-full hover:opacity-90 transition-colors inline-block"
          >
            START ANALYSIS
          </Link>
          <Link 
            to="/doc" 
            className="glass-panel text-foreground font-label-sm text-label-sm px-[32px] py-[16px] h-auto rounded-full hover:bg-muted transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">science</span>
            VIEW METHODOLOGY
          </Link>
        </div>
        {/* Data Preview */}
        <div className="mt-[24px] grid grid-cols-2 gap-[16px]">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="glass-panel p-[16px] rounded-xl text-left"
          >
            <p className="font-label-sm text-label-sm text-muted-foreground uppercase mb-1">ACCURACY RATE</p>
            <p className="font-headline-md text-headline-md text-primary">99.9%</p>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="glass-panel p-[16px] rounded-xl text-left"
          >
            <p className="font-label-sm text-label-sm text-muted-foreground uppercase mb-1">DATAPOINTS ANALYZED</p>
            <p className="font-headline-md text-headline-md text-info">4.2B+</p>
          </motion.div>
        </div>
      </motion.div>
      <motion.div 
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
        className="w-full lg:w-1/2 relative min-h-[500px] flex items-center justify-center"
      >
        {/* Abstract Data Graphic */}
        <motion.div 
          animate={{ 
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-secondary/20 rounded-full blur-3xl opacity-50"
        ></motion.div>
        <motion.img
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          alt="Bio-intelligence visualization"
          className="w-full h-auto object-cover rounded-2xl glass-panel relative z-10 mix-blend-multiply dark:mix-blend-normal opacity-90 transition-all duration-500 lg:ml-12"
          src="/assets/images/hero-visualization.png"
        />
        {/* Floating Data Cards */}
        <motion.div 
          animate={{ y: [0, 15, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[10%] -left-[10%] glass-panel p-[16px] rounded-xl z-20 shadow-lg border border-border/40 hidden md:block text-left"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            <span className="font-label-sm text-label-sm text-muted-foreground">LIVE SCAN</span>
          </div>
          <p className="font-body-md text-body-md text-foreground font-medium">Pathogen detection active</p>
        </motion.div>
      </motion.div>
    </section>
  );
};
