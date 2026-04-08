import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Activity, LineChart, Database, Cpu, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';

import foodPlateImg from '../assets/FoodPlate-removebg-preview.png';
import mycotoxinBlog1Img from '../assets/Mycotoxinblog1.jpg';
import mycotoxinBlog2Img from '../assets/Mycotoxinblog2.png';
import mycotoxinBlog3Img from '../assets/Mycotoxinblog3.jpeg';
import agricultureBannerImg from '../assets/ArgricultureBanner.jpg';
import detectionToPredictionImg from '../assets/DetectionToPrediction.png';
import labPicImg from '../assets/Labpic.jpg';

const blogs = [
  { image: mycotoxinBlog1Img, tag: 'Research', title: 'How are mycotoxins dangerous?', desc: 'As the food safety industry evolves, so do the risks. Here is what researchers and producers need to know.' },
  { image: mycotoxinBlog2Img, tag: 'Policy', title: 'How food policy affects your life', desc: 'Changing regulations shape supply chains worldwide. Understand what the latest standards mean for your operation.' },
  { image: mycotoxinBlog3Img, tag: 'Guide', title: 'How to keep your food safe?', desc: 'A practical look at the thresholds, testing methods, and best practices that define food safety today.' },
];

const steps = [
  { num: '01', icon: <Database className="h-4 w-4" />, title: 'Digitise', text: 'Import historical lab data. The system structures and validates it instantly, ready for analysis.' },
  { num: '02', icon: <ShieldCheck className="h-4 w-4" />, title: 'Flag Risks', text: 'Set safety thresholds. Contamination risks are automatically flagged and surfaced in real time.' },
  { num: '03', icon: <TrendingUp className="h-4 w-4" />, title: 'Find Trends', text: 'As your database grows, hidden patterns, seasonal spikes, and supplier issues become visible.' },
  { num: '04', icon: <Cpu className="h-4 w-4" />, title: 'Predict', text: 'Predictive models forecast contamination risk from historical patterns before testing begins.' },
];

const Homepage = () => {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!api) return;
    const id = setInterval(() => api.scrollNext(), 4000);
    api.on('select', () => setCurrent(api.selectedScrollSnap() % blogs.length));
    return () => clearInterval(id);
  }, [api]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1">

        {/* Hero + How it works */}
        <section className="container py-24 md:py-32">
          {/* Hero row */}
          <div className="flex flex-col lg:flex-row items-center gap-12 mb-20">
            <div className="flex-1 flex flex-col gap-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                Mycotoxin Tracking System
              </p>
              <h1 className="font-serif text-5xl md:text-6xl font-medium tracking-tight text-foreground leading-tight">
                Is your food <span className="text-primary">safe?</span>
              </h1>
              <p className="max-w-md text-muted-foreground text-base leading-relaxed">
                AgriScan Pro delivers real-time monitoring, automated risk assessment, and predictive
                analysis for agricultural safety — protecting consumers at every step.
              </p>
              <div className="flex gap-3 mt-2">
                <Button asChild size="lg" className="rounded-full">
                  <Link to="/dashboard">Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="rounded-full">
                  <Link to="/doc">Documentation</Link>
                </Button>
              </div>
              <div className="flex gap-8 pt-6 border-t border-border/60">
                {[{ val: '12,400+', label: 'Samples analysed' }, { val: '48', label: 'Labs connected' }, { val: '94.7%', label: 'Prediction accuracy' }].map(s => (
                  <div key={s.label}>
                    <p className="text-xl font-bold text-foreground">{s.val}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 flex justify-center">
              <img src={foodPlateImg} alt="Healthy food" className="max-h-[440px] w-auto object-contain drop-shadow-xl" />
            </div>
          </div>

          {/* How it works — flush below hero */}
          <div className="pt-16">
            <div className="max-w-lg mb-10">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">How it works</p>
              <h2 className="font-serif text-3xl md:text-4xl font-medium">Three steps to safer food</h2>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {[
                { num: '01', Icon: ShieldCheck, title: 'Get Started', desc: 'Import your historical lab data. The system validates and structures it instantly, ready for analysis.' },
                { num: '02', Icon: Activity, title: 'Manage Risks', desc: 'Set safety thresholds. Contamination risks are flagged automatically and audit reports generated.' },
                { num: '03', Icon: LineChart, title: 'Grow & Predict', desc: 'Accumulated data trains AI models that forecast quality trends and prevent future issues.' },
              ].map(c => (
                <div key={c.num} className="flex flex-col gap-4 p-7 bg-card rounded-2xl border hover:border-primary/30 hover:shadow-md transition-all duration-300">
                  <span className="text-4xl font-serif font-medium text-muted-foreground/20 select-none">{c.num}</span>
                  <div className="p-2.5 w-fit rounded-xl bg-primary/10 text-primary">
                    <c.Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-foreground">{c.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Banner + Blogs */}
        <section className="border-t">
          <div className="container py-20 md:py-28">
            {/* Banner */}
            <div className="relative overflow-hidden rounded-3xl mb-16">
              <img src={agricultureBannerImg} alt="Agriculture" className="w-full object-cover max-h-[400px]" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/30 to-transparent" />
              <div className="absolute inset-0 flex items-end">
                <div className="container pb-10">
                  <p className="text-white/50 text-xs uppercase tracking-widest font-semibold mb-2">Field to lab</p>
                  <h3 className="font-serif text-3xl md:text-4xl font-medium text-white max-w-xs leading-tight">
                    Protecting harvests at every stage
                  </h3>
                </div>
              </div>
            </div>
            <div className="flex items-end justify-between mb-12">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Insights</p>
                <h2 className="font-serif text-3xl md:text-4xl font-medium">From the blog</h2>
              </div>
              <button
                onClick={() => api?.scrollNext()}
                className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Next <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <Carousel setApi={setApi} opts={{ align: 'start', loop: true }} className="w-full">
              <CarouselContent>
                {[...blogs, ...blogs].map((b, i) => (
                  <CarouselItem key={i} className="md:basis-1/3 pl-5">
                    <div className="group flex flex-col rounded-2xl border bg-card overflow-hidden hover:border-primary/30 hover:shadow-md transition-all duration-300 cursor-pointer">
                      <div className="overflow-hidden aspect-[4/3]">
                        <img src={b.image} alt={b.title} loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      </div>
                      <div className="p-5 flex flex-col gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">{b.tag}</span>
                        <h3 className="font-semibold text-sm text-foreground leading-snug">{b.title}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{b.desc}</p>
                      </div>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>

            <div className="flex justify-center gap-2 mt-8">
              {blogs.map((_, i) => (
                <button key={i} onClick={() => api?.scrollTo(i)}
                  className={`h-1 rounded-full transition-all duration-300 ${current === i ? 'w-8 bg-primary' : 'w-1 bg-muted-foreground/25'}`} />
              ))}
            </div>
          </div>
        </section>


        {/* Detection to Prediction */}
        <section className="border-t">
          <div className="container py-20 md:py-28">
            <div className="flex flex-col lg:flex-row items-start gap-16 lg:gap-24">
              <div className="flex-1 flex flex-col gap-10">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Our roadmap</p>
                  <h2 className="font-serif text-4xl md:text-5xl font-medium leading-tight">
                    From Detection to Prediction
                  </h2>
                  <p className="text-muted-foreground text-sm leading-relaxed mt-4 max-w-sm">
                    Every sample you import helps build the dataset that will power our upcoming AI prediction model.
                  </p>
                </div>

                {/* Timeline */}
                <div className="relative pl-6">
                  <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gradient-to-b from-primary/60 to-transparent" />
                  <div className="space-y-9">
                    {steps.map((s, i) => (
                      <div key={s.num} className="flex gap-5 items-start">
                        <div className={`absolute -left-0 flex items-center justify-center w-[22px] h-[22px] rounded-full border-2 shrink-0 mt-0.5
                                                    ${i === 0 ? 'bg-primary border-primary text-primary-foreground'
                            : i < 2 ? 'bg-primary/15 border-primary/40 text-primary'
                              : 'bg-background border-border text-muted-foreground/50'}`}>
                          <span className="text-[9px] font-bold">{i + 1}</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground mb-1">{s.title}</p>
                          <p className="text-sm text-muted-foreground leading-relaxed">{s.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex-1 flex justify-center lg:justify-end">
                <img src={detectionToPredictionImg} alt="AI Model" className="w-full max-w-md h-auto object-contain rounded-2xl shadow-lg" />
              </div>
            </div>
          </div>
        </section>

        {/* Contact / Access */}
        <section className="border-t">
          <div className="container py-20 md:py-28">
            <div className="flex flex-col lg:flex-row gap-6 lg:gap-16">

              {/* Left — lab image */}
              <div className="hidden lg:block lg:w-[480px] shrink-0">
                <div className="overflow-hidden rounded-2xl h-full min-h-[420px]">
                  <img src={labPicImg} alt="Research laboratory" className="w-full h-full object-cover" />
                </div>
              </div>

              {/* Middle — editorial headline */}
              <div className="flex-1 flex flex-col gap-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                  Research Access
                </p>
                <h2 className="font-serif text-4xl md:text-5xl font-medium text-foreground leading-tight max-w-sm">
                  Open to researchers <span className="text-primary">and collaborators.</span>
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
                  AgriScan Pro is developed and maintained by the Faculty of Agriculture.
                  Access is available to enrolled students, affiliated researchers, and
                  partner institutions working in food safety and mycotoxin science.
                </p>
                <div className="flex flex-wrap gap-3 mt-2">
                  <Button asChild size="lg" className="rounded-full">
                    <Link to="/dashboard">
                      Access Platform <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="rounded-full">
                    <Link to="/doc">Documentation</Link>
                  </Button>
                </div>
              </div>

              {/* Right — research stats + contact */}
              <div className="lg:w-[340px] shrink-0 flex flex-col gap-10">

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-px bg-border rounded-2xl overflow-hidden border border-border">
                  {[
                    { val: '12,400+', label: 'Samples in database' },
                    { val: '8', label: 'Mycotoxin types tracked' },
                    { val: '20+', label: 'Crop varieties covered' },
                    { val: '4', label: 'Active research teams' },
                  ].map(s => (
                    <div key={s.label} className="flex flex-col gap-1 bg-card px-6 py-5">
                      <span className="font-serif text-2xl font-medium text-foreground">{s.val}</span>
                      <span className="text-xs text-muted-foreground leading-snug">{s.label}</span>
                    </div>
                  ))}
                </div>

                {/* Contact info */}
                <div className="space-y-4 pt-2 border-t border-border">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Contact the research team
                  </p>
                  {[
                    { label: 'General enquiries', value: 'agriscan@tu.ac.th' },
                    { label: 'Data & methodology', value: 'research.lab@tu.ac.th' },
                    { label: 'Faculty of Agriculture', value: 'Thammasath University, Bangkok' },
                  ].map(item => (
                    <div key={item.label} className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">{item.label}</span>
                      <span className="text-sm font-medium text-foreground">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </section>

      </main>
    </div>
  );
};

export default Homepage;
