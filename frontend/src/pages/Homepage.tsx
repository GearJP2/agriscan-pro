import { HeroSection } from "@/features/home/components/HeroSection";
import { InsightsSection } from "@/features/home/components/InsightsSection";
import { WorkflowSection } from "@/features/home/components/WorkflowSection";
import { ResearchAccessSection } from "@/features/home/components/ResearchAccessSection";
import { UniversitySection } from "@/features/home/components/UniversitySection";

const Homepage = () => {
  return (
    <div className="min-h-screen bg-white dark:bg-background flex flex-col">
      <main className="flex-grow flex flex-col">
        <HeroSection />
        <InsightsSection />
        <WorkflowSection />
        <ResearchAccessSection />
        <UniversitySection />
      </main>
    </div>
  );
};

export default Homepage;
