import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Activity, LineChart } from 'lucide-react';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';

const Homepage = () => {
    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Header />

            {/* Hero Section */}
            <main className="flex-1">
                <section className="container py-24 sm:py-32">
                    <div className="mx-auto flex max-w-[980px] flex-col items-center gap-4 text-center">
                        <h1 className="text-3xl font-bold leading-tight tracking-tighter md:text-5xl lg:text-6xl lg:leading-[1.1]">
                            Ensuring Food Safety Through <br className="hidden sm:inline" />
                            <span className="text-primary">Advanced Mycotoxin Tracking</span>
                        </h1>
                        <p className="max-w-[750px] text-lg text-muted-foreground sm:text-xl">
                            AgriScan Pro provides real-time monitoring, risk assessment, and predictive analysis for agricultural safety.
                            Protect consumers and optimize your supply chain with our comprehensive dashbaord.
                        </p>
                        <div className="flex gap-4 mt-4">
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
                </section>

                {/* Features Section */}
                <section className="container py-12 md:py-24 lg:py-32 bg-slate-50 dark:bg-slate-900/50 rounded-3xl">
                    <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="flex flex-col items-center text-center p-6 bg-background rounded-xl shadow-sm border">
                            <div className="p-3 rounded-full bg-primary/10 mb-4">
                                <ShieldCheck className="h-8 w-8 text-primary" />
                            </div>
                            <h3 className="text-xl font-bold mb-2">Safety Compliance</h3>
                            <p className="text-muted-foreground">
                                Automated risk assessment ensuring all products meet safety standards before distribution.
                            </p>
                        </div>
                        <div className="flex flex-col items-center text-center p-6 bg-background rounded-xl shadow-sm border">
                            <div className="p-3 rounded-full bg-primary/10 mb-4">
                                <Activity className="h-8 w-8 text-primary" />
                            </div>
                            <h3 className="text-xl font-bold mb-2">Real-time Monitoring</h3>
                            <p className="text-muted-foreground">
                                Track samples through every stage of the testing process with instant status updates.
                            </p>
                        </div>
                        <div className="flex flex-col items-center text-center p-6 bg-background rounded-xl shadow-sm border">
                            <div className="p-3 rounded-full bg-primary/10 mb-4">
                                <LineChart className="h-8 w-8 text-primary" />
                            </div>
                            <h3 className="text-xl font-bold mb-2">Predictive Analytics</h3>
                            <p className="text-muted-foreground">
                                Leverage historical data to predict contamination risks and prevent outbreaks.
                            </p>
                        </div>
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
        </div>
    );
};

export default Homepage;
