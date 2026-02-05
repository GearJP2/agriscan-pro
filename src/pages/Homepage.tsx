import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Activity, LineChart } from 'lucide-react';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';

const Homepage = () => {
    const [api, setApi] = useState<CarouselApi>();

    useEffect(() => {
        if (!api) {
            return;
        }

        // Auto-scroll functionality as implied by "เลื่อนรูปไปเรื่อยๆ"
        const intervalId = setInterval(() => {
            api.scrollNext();
        }, 4000);

        return () => clearInterval(intervalId);
    }, [api]);

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Header />

            {/* Hero Section */}
            <main className="flex-1">
                <section className="container flex flex-col items-center gap-8 py-24 md:py-32 lg:flex-row lg:gap-16">
                    <div className="flex flex-1 flex-col items-start gap-6 text-left">
                        <h1 className="font-serif text-5xl font-medium tracking-tight sm:text-6xl md:text-7xl lg:text-6xl xl:text-7xl text-foreground whitespace-nowrap">
                            Is your food safe?
                        </h1>
                        <div className="space-y-4">
                            <h2 className="text-xl font-bold text-primary sm:text-2xl">
                                Ensuring Food Safety Through Advanced Mycotoxin Tracking
                            </h2>
                            <p className="max-w-[42rem] leading-normal text-muted-foreground sm:text-xl sm:leading-8">
                                AgriScan Pro provides real-time monitoring, risk assessment, and predictive analysis for agricultural safety.
                                Protect consumers and optimize your supply chain with our comprehensive dashbaord.
                            </p>
                        </div>
                        <div className="flex gap-4 mt-2">
                            <Button asChild size="lg">
                                <Link to="/dashboard">
                                    Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                            <Button asChild variant="outline" size="lg">
                                <Link to="/doc">
                                    Read Documentation
                                </Link>
                            </Button>
                        </div>
                    </div>
                    <div className="flex flex-1 items-center justify-center">
                        <img
                            src="/src/assets/FoodPlate-removebg-preview.png"
                            alt="Balanced healthy meal"
                            className="max-w-full h-auto object-contain max-h-[500px] drop-shadow-xl"
                        />
                    </div>
                </section>

                {/* Steps Section */}
                <section className="container py-12 md:py-24">
                    <div className="grid gap-8 md:grid-cols-3">
                        <div className="flex flex-col gap-4 items-center text-center p-6 bg-card rounded-xl shadow-lg border transition-all hover:scale-105 duration-300">
                            <span className="text-6xl font-normal text-muted-foreground/40">01</span>
                            <div className="flex items-center justify-center gap-4">
                                <div className="p-3 rounded-full bg-primary/10 w-fit">
                                    <ShieldCheck className="h-6 w-6 text-primary" />
                                </div>
                                <h3 className="text-xl font-bold">Get Started</h3>
                            </div>
                            <p className="text-muted-foreground">
                                "Simply import your historical lab data. Our system instantly structures and validates it, ready for analysis."
                            </p>
                        </div>
                        <div className="flex flex-col gap-4 items-center text-center p-6 bg-card rounded-xl shadow-lg border transition-all hover:scale-105 duration-300">
                            <span className="text-6xl font-normal text-muted-foreground/40">02</span>
                            <div className="flex items-center justify-center gap-4">
                                <div className="p-3 rounded-full bg-primary/10 w-fit">
                                    <Activity className="h-6 w-6 text-primary" />
                                </div>
                                <h3 className="text-xl font-bold">Manage Risks</h3>
                            </div>
                            <p className="text-muted-foreground">
                                "Set your safety thresholds. The platform automatically flags contamination risks and generates audit-ready reports."
                            </p>
                        </div>
                        <div className="flex flex-col gap-4 items-center text-center p-6 bg-card rounded-xl shadow-lg border transition-all hover:scale-105 duration-300">
                            <span className="text-6xl font-normal text-muted-foreground/40">03</span>
                            <div className="flex items-center justify-center gap-4">
                                <div className="p-3 rounded-full bg-primary/10 w-fit">
                                    <LineChart className="h-6 w-6 text-primary" />
                                </div>
                                <h3 className="text-xl font-bold">Growth & Predict</h3>
                            </div>
                            <p className="text-muted-foreground">
                                "Use your accumulated data to train AI models that forecast quality trends and prevent future issues."
                            </p>
                        </div>
                    </div>
                </section>

                {/* Blogs Section */}
                <section className="container py-12 md:py-24 border-t">
                    <div className="flex items-center justify-center mb-12">
                        <h2 className="text-3xl font-bold">Blogs</h2>
                    </div>

                    <Carousel
                        setApi={setApi}
                        opts={{
                            align: "start",
                            loop: true,
                        }}
                        className="w-full"
                    >
                        <CarouselContent>
                            {[
                                {
                                    image: "/src/assets/blog-fungi.png",
                                    title: "How are mycotoxins dangerous!",
                                    desc: "As industry of safety food growth, the policy might be developed along here is how...",
                                    alt: "Mycotoxins"
                                },
                                {
                                    image: "/src/assets/blog-justice.png",
                                    title: "How food policy affect your life",
                                    desc: "As industry of safety food growth, the policy might be developed along here is how...",
                                    alt: "Food Policy"
                                },
                                {
                                    image: "/src/assets/blog-safety-chart.png",
                                    title: "How to keep your food safe?",
                                    desc: "First we have to know the definition or the baseline of safe standard what actually is that?",
                                    alt: "Food Safety",
                                    isLast: true
                                }
                            ].concat([
                                {
                                    image: "/src/assets/blog-fungi.png",
                                    title: "How are mycotoxins dangerous!",
                                    desc: "As industry of safety food growth, the policy might be developed along here is how...",
                                    alt: "Mycotoxins"
                                },
                                {
                                    image: "/src/assets/blog-justice.png",
                                    title: "How food policy affect your life",
                                    desc: "As industry of safety food growth, the policy might be developed along here is how...",
                                    alt: "Food Policy"
                                },
                                {
                                    image: "/src/assets/blog-safety-chart.png",
                                    title: "How to keep your food safe?",
                                    desc: "First we have to know the definition or the baseline of safe standard what actually is that?",
                                    alt: "Food Safety",
                                    isLast: true
                                }
                            ]).map((blog, index) => (
                                <CarouselItem key={index} className="md:basis-1/3 pl-4">
                                    <div className="group flex flex-col gap-4 cursor-pointer h-full">
                                        <div className={`overflow-hidden rounded-lg ${blog.isLast ? 'bg-white border flex items-center justify-center aspect-video' : ''}`}>
                                            <img
                                                src={blog.image}
                                                alt={blog.alt}
                                                className={`${blog.isLast ? 'aspect-video object-contain w-full p-4' : 'aspect-video object-cover w-full'} transition-transform duration-300 group-hover:scale-105`}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <h3 className="text-lg font-bold">{blog.title}</h3>
                                            <p className="text-muted-foreground text-sm">
                                                {blog.desc}
                                            </p>
                                        </div>
                                    </div>
                                </CarouselItem>
                            ))}
                        </CarouselContent>
                    </Carousel>

                    <div className="flex justify-center mt-8">
                        <Button
                            variant="ghost"
                            className="text-sm font-medium flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
                            onClick={() => api?.scrollNext()}
                        >
                            Next <ArrowRight className="h-4 w-4" />
                        </Button>
                    </div>
                </section>

                {/* Agriculture Banner Section */}
                <section className="container pb-12 md:pb-24 pt-0">
                    <div className="overflow-hidden rounded-3xl shadow-2xl">
                        <img
                            src="/src/assets/ArgricultureBanner.jpg"
                            alt="Agriculture Ecosystem"
                            className="w-full h-auto object-cover max-h-[600px]"
                        />
                    </div>
                </section>

                {/* From Detection to Prediction Section */}
                <section className="container py-12 md:py-24">
                    <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-24">
                        <div className="flex flex-1 flex-col gap-8">
                            <div className="space-y-4">
                                <h2 className="font-serif text-4xl font-medium md:text-5xl">
                                    From Detection to Prediction
                                </h2>
                                <p className="text-muted-foreground text-lg">
                                    We are building more than just a database. Every sample you import helps train our upcoming AI Prediction Model.
                                </p>
                            </div>

                            <div className="space-y-8">
                                <div className="flex gap-4">
                                    <span className="text-sm font-bold text-muted-foreground pt-1">01</span>
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">
                                            Transform scattered raw data into a clean, unified digital format creating the essential "fuel" for future machine learning.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <span className="text-sm font-bold text-muted-foreground pt-1">02</span>
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">
                                            Applies strict threshold logic to instantly flag contamination risks, ensuring immediate safety compliance for every batch.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <span className="text-sm font-bold text-muted-foreground pt-1">03</span>
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">
                                            As database grows, the system begins to identify hidden trends, seasonal spikes, and recurring issues across different suppliers.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <span className="text-sm font-bold text-muted-foreground pt-1">04</span>
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">
                                            We deploy predictive models that analyze historical patterns to forecast potential contamination risks before testing begins.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-1 items-center justify-center">
                            <img
                                src="/src/assets/DetectionToPrediction.jpg"
                                alt="AI Prediction Model"
                                className="max-w-full h-auto object-contain"
                            />
                        </div>
                    </div>
                </section>



                {/* Connect with us Section */}
                <section className="container py-12 md:py-24">
                    <div className="bg-card rounded-3xl border shadow-2xl p-12 md:p-24 text-center">
                        <h2 className="font-serif text-5xl font-medium mb-6">Connect with us</h2>
                        <p className="text-muted-foreground mb-8 text-lg max-w-2xl mx-auto">
                            Schedule a quick call to learn how Area can turn your data into a powerful advantage.
                        </p>
                        <Button asChild className="rounded-full bg-[#4A5D23] hover:bg-[#3A4A1C] px-8 py-6 text-lg h-auto shadow-lg hover:shadow-xl transition-all">
                            <Link to="/doc">
                                Learn More <ArrowRight className="ml-2 h-5 w-5" />
                            </Link>
                        </Button>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="border-t py-8">
                <div className="container flex flex-col items-center justify-between gap-4 md:flex-row">
                    <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
                        © 2024 AgriScan Pro. All rights reserved.
                    </p>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                        <Link to="/doc" className="hover:underline">Terms</Link>
                        <Link to="/doc" className="hover:underline">Privacy</Link>
                        <Link to="/doc" className="hover:underline">Contact</Link>
                    </div>
                </div>
            </footer>
        </div >
    );
};

export default Homepage;
