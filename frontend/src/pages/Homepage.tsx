import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  ChevronDown,
  Database,
  Edit3,
  FlaskConical,
  Leaf,
  RotateCcw,
  Save,
  ShieldCheck,
  X,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiClient, publicApiClient } from "@/lib/api";

type HomeContent = {
  eyebrow: string;
  title: string;
  intro: string;
  heroImage: string;
  primaryCta: string;
  secondaryCta: string;
  researcherCount: string;
  projectCount: string;
  publicationCount: string;
};

const defaultContent: HomeContent = {
  eyebrow: "Thammasat University · Food safety research platform",
  title: "Unleash Global Food Security",
  intro:
    "AgriScan Pro advances science, innovation, and partnerships for safe and sustainable food systems.",
  heroImage: "/assets/images/ArgricultureBanner.jpg",
  primaryCta: "View public dashboard",
  secondaryCta: "Discover more",
  researcherCount: "18",
  projectCount: "3",
  publicationCount: "11",
};

const news = [
  {
    date: "6 Aug 2026",
    title: "CoE-GFS and Agilent Technologies Explore Collaboration in Advanced Analytical Technologies and Capacity Building",
    body: "Strengthening university–industry collaboration in advanced analytical science.",
    image: "/assets/images/blog-safety-chart.png",
  },
  {
    date: "30 Jul 2026",
    title: "Thailand Selected to Join the IAEA Coordinated Research Project on Seafood Authenticity",
    body: "Building global research partnerships for trusted and sustainable food systems.",
    image: "/assets/images/DetectionToPrediction.png",
  },
  {
    date: "14 Jul 2026",
    title: "CoE-GFS Brings Together Global Experts to Advance Research Collaboration",
    body: "A strategic forum for research–industry collaboration on food systems.",
    image: "/assets/images/Labpic.jpg",
  },
];

const projects = [
  ["FISCAL YEAR 2026–2030", "Detecting Fraud in the Global Tuna Markets", "Funder: IAEA · Building reliable tools for seafood authenticity."],
  ["FISCAL YEAR 2026", "Precision Fermentation for Algal Cultivation", "Funder: PMU-B · High-value biomass and biomolecules at industrial scale."],
  ["FISCAL YEAR 2024–2027", "MYCOBEANS: Mycotoxin Risk in Beans", "Funder: Horizon Europe · A global alliance for climate resilience."],
];

const partners = [
  ["🇹🇭", "Thailand", "BIOTEC · Mahidol · PSU · Chulalongkorn · Kasetsart"],
  ["🇺🇸", "United States", "CRDF · UBC · Oregon State · ILSI"],
  ["🇬🇧", "United Kingdom", "Queen's Belfast · Liverpool · Bia Analytical"],
  ["🇮🇹", "Italy", "Parma · Barilla · ISPA"],
  ["🇦🇹", "Austria", "Vienna · BOKU · IAEA"],
  ["🇨🇳", "China", "CFSA · Pribolab · Shaanxi · Wuhan"],
  ["🇯🇵", "Japan", "Frontier · Teiko · Shizuoka"],
  ["🇸🇬", "Singapore", "SCIEX · Agilent · A*STAR · NTU"],
];

const Homepage = () => {
  const { isContentAdmin } = useAuth();
  const { language } = useLanguage();
  const location = useLocation();
  const [content, setContent] = useState<HomeContent>(defaultContent);
  const [draft, setDraft] = useState<HomeContent>(defaultContent);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const isThai = language === "th";
  const displayContent = isThai ? { ...content, eyebrow: "มหาวิทยาลัยธรรมศาสตร์ · แพลตฟอร์มวิจัยความปลอดภัยอาหาร", title: "ปลดล็อกความมั่นคงทางอาหารระดับโลก", intro: "AgriScan Pro ขับเคลื่อนวิทยาศาสตร์ นวัตกรรม และเครือข่ายความร่วมมือ เพื่อระบบอาหารที่ปลอดภัยและยั่งยืน", secondaryCta: "ค้นพบเพิ่มเติม" } : content;

  useEffect(() => {
    void publicApiClient.get("/homepage/").then(({ data }) => {
      if (data.content) {
        const initial = { ...defaultContent, ...data.content };
        setContent(initial);
        setDraft(initial);
      }
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (location.pathname === "/manage" && isContentAdmin) {
      setEditing(true);
    }
  }, [isContentAdmin, location.pathname]);

  const save = async () => {
    await apiClient.put("/homepage/", { content: draft });
    setContent(draft); setEditing(false); setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  const reset = async () => {
    await apiClient.put("/homepage/", { content: defaultContent });
    setContent(defaultContent); setDraft(defaultContent);
  };

  return (
    <main className="coe-theme bg-[#fafaf7] text-[#17382d]">
      {isContentAdmin && (
        <div className="fixed bottom-5 right-5 z-[70] flex items-center gap-2">
          {saved && <span className="rounded-full bg-[#17382d] px-4 py-2 text-xs font-semibold text-white shadow-lg">Homepage saved</span>}
          <button onClick={() => { setDraft(content); setEditing(true); }} className="inline-flex items-center gap-2 rounded-full bg-[#17382d] px-5 py-3 text-sm font-semibold text-white shadow-xl transition hover:bg-[#245640]">
            <Edit3 className="h-4 w-4" /> Edit homepage
          </button>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#17382d]/45 p-4 backdrop-blur-sm md:p-8">
          <section className="mx-auto max-w-3xl rounded-[2rem] bg-white p-6 shadow-2xl md:p-9">
            <div className="mb-7 flex items-start justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#9a6b37]">Admin content editor</p><h2 className="mt-2 text-2xl font-semibold text-[#17382d]">Edit the public homepage</h2></div>
              <button onClick={() => setEditing(false)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100"><X /></button>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {(["eyebrow", "title", "heroImage", "primaryCta", "secondaryCta", "researcherCount", "projectCount", "publicationCount"] as const).map((field) => (
                <label key={field} className={field === "title" || field === "heroImage" ? "md:col-span-2" : ""}>
                  <span className="mb-1.5 block text-xs font-bold capitalize text-slate-600">{field.replace(/([A-Z])/g, " $1")}</span>
                  <input value={draft[field]} onChange={(e) => setDraft({ ...draft, [field]: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-[#9a6b37] focus:ring-2" />
                </label>
              ))}
              <label className="md:col-span-2"><span className="mb-1.5 block text-xs font-bold text-slate-600">Introduction</span><textarea rows={4} value={draft.intro} onChange={(e) => setDraft({ ...draft, intro: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-[#9a6b37] focus:ring-2" /></label>
            </div>
            <div className="mt-7 flex flex-wrap justify-between gap-3 border-t pt-5"><button onClick={reset} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#17382d]"><RotateCcw className="h-4 w-4" /> Restore defaults</button><div className="flex gap-3"><button onClick={() => setEditing(false)} className="rounded-full px-5 py-2.5 text-sm font-semibold text-slate-600">Cancel</button><button onClick={save} className="inline-flex items-center gap-2 rounded-full bg-[#17382d] px-5 py-2.5 text-sm font-semibold text-white"><Save className="h-4 w-4" /> Save changes</button></div></div>
          </section>
        </div>
      )}

      <section className="border-b border-[#17382d]/10 bg-[#eff2e8]">
        <div className="mx-auto grid max-w-7xl items-stretch px-6 lg:grid-cols-[1.05fr_.95fr] lg:px-8">
          <div className="py-16 lg:py-28 lg:pr-16">
            <p className="mb-5 text-xs font-bold uppercase tracking-[.18em] text-[#9a6b37]">{displayContent.eyebrow}</p>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[1.04] tracking-[-.045em] text-[#17382d] md:text-6xl xl:text-7xl">{displayContent.title}</h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-[#496257] md:text-lg">{displayContent.intro}</p>
            <div className="mt-9 flex flex-wrap gap-4"><Link to="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-[#17382d] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#245640]">{isThai ? "ดูแดชบอร์ดสาธารณะ" : "View public dashboard"} <ArrowRight className="h-4 w-4" /></Link><a href="#approach" className="inline-flex items-center gap-2 rounded-full border border-[#17382d]/25 px-6 py-3.5 text-sm font-semibold transition hover:bg-white">{displayContent.secondaryCta} <ChevronDown className="h-4 w-4" /></a></div>
          </div>
          <div className="relative min-h-[360px] overflow-hidden lg:min-h-full"><img src={content.heroImage} alt="Agricultural field research" className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-[#17382d]/40 via-transparent to-transparent" /><div className="absolute bottom-6 left-6 right-6 border-l-2 border-[#d8bc80] pl-4 text-sm leading-6 text-white">Evidence-led tools for resilient, trusted food systems.</div></div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8"><p className="text-center text-xs font-bold uppercase tracking-[.2em] text-[#9a6b37]">It all starts here</p><div className="mx-auto mt-4 max-w-2xl text-center"><h2 className="text-3xl font-semibold tracking-[-.03em] md:text-4xl">CoE-GFS is Thailand's hub for food security research.</h2><p className="mt-4 leading-7 text-[#496257]">Connecting researchers, evidence, and partners in 20+ countries worldwide.</p></div><div className="mt-12 grid gap-8 border-y border-[#17382d]/10 py-9 md:grid-cols-3"><Feature icon={<FlaskConical />} title="University" text="Part of the Faculty of Science and Technology, Thammasat University." /><Feature icon={<BarChart3 />} title="Interdisciplinary Research" text="Spanning agriculture, biotech, safety, authenticity, omics, and One Health." /><Feature icon={<Leaf />} title="International" text="Partners across Europe, Asia, the Americas, and Oceania." /></div></section>

      <section className="bg-[#17382d] px-6 py-12 text-white lg:px-8"><div className="mx-auto grid max-w-7xl gap-8 text-center sm:grid-cols-5"><Metric number={content.researcherCount} label="Researchers & students" /><Metric number={content.projectCount} label="Active projects" /><Metric number={content.publicationCount} label="Publications / posters" /><Metric number="3" label="Visits & engagement" /><Metric number="20+" label="International partners" /></div></section>

      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#9a6b37]">News & resources</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.03em] md:text-4xl">Latest from AgriScan Pro</h2></div><Link to="/doc" className="inline-flex items-center gap-2 text-sm font-bold text-[#17382d] underline underline-offset-4">View documentation <ArrowRight className="h-4 w-4" /></Link></div><div className="mt-10 grid gap-7 md:grid-cols-3">{news.map((item) => <article key={item.title} className="group"><div className="aspect-[1.35] overflow-hidden bg-[#e7ece1]"><img src={item.image} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /></div><p className="mt-5 text-xs font-bold uppercase tracking-[.14em] text-[#9a6b37]">{item.date}</p><h3 className="mt-2 text-xl font-semibold leading-7 tracking-[-.02em]">{item.title}</h3><p className="mt-3 text-sm leading-6 text-[#496257]">{item.body}</p><Link to="/doc" className="mt-4 inline-flex items-center gap-1 text-sm font-bold">Read more <ArrowRight className="h-4 w-4" /></Link></article>)}</div></section>

      <section id="approach" className="border-y border-[#17382d]/10 bg-[#f0f1ea] px-6 py-20 lg:px-8"><div className="mx-auto max-w-7xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#9a6b37]">Research projects</p><div className="mt-4 flex flex-wrap items-end justify-between gap-5"><h2 className="max-w-xl text-3xl font-semibold tracking-[-.03em] md:text-4xl">Research that makes safety measurable.</h2><Link to="/prediction" className="inline-flex items-center gap-2 rounded-full border border-[#17382d]/25 px-5 py-3 text-sm font-bold hover:bg-white">Explore predictions <ArrowRight className="h-4 w-4" /></Link></div><div className="mt-11 grid gap-px overflow-hidden border border-[#17382d]/15 bg-[#17382d]/15 md:grid-cols-3">{projects.map(([tag, title, body]) => <Link to="/dashboard" key={title} className="bg-[#f0f1ea] p-7 transition hover:bg-white"><p className="text-xs font-bold tracking-[.15em] text-[#9a6b37]">{tag}</p><h3 className="mt-10 text-2xl font-semibold leading-8 tracking-[-.025em]">{title}</h3><p className="mt-4 text-sm leading-6 text-[#496257]">{body}</p><ArrowRight className="mt-7 h-5 w-5" /></Link>)}</div></div></section>

      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <div className="text-center"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#9a6b37]">Partners & networks</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.03em] md:text-4xl">CoE-GFS international collaboration networks</h2><p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-[#496257]">Leading research institutions, industry partners, and international organizations across more than 20 countries.</p></div>
        <div className="mt-11 grid gap-px overflow-hidden rounded-sm border border-[#17382d]/15 bg-[#17382d]/15 sm:grid-cols-2 lg:grid-cols-4">{partners.map(([flag, country, names]) => <article key={country} className="bg-[#fafaf7] p-6"><span className="text-2xl">{flag}</span><h3 className="mt-5 font-semibold">{country}</h3><p className="mt-2 text-xs leading-5 text-[#496257]">{names}</p></article>)}</div>
        <div className="mt-8 text-center"><Link to="/doc" className="inline-flex items-center gap-2 text-sm font-bold underline underline-offset-4">See all partners <ArrowRight className="h-4 w-4" /></Link></div>
      </section>

      <section className="bg-[#dfe7d5] px-6 py-14 lg:px-8"><div className="mx-auto grid max-w-7xl items-center gap-8 md:grid-cols-[1fr_auto]"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#9a6b37]">CoE-GFS brochure</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.03em]">Explore our people, research, and global partnerships.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-[#496257]">Discover the work and researchers advancing safe, sustainable food systems at regional and international levels.</p></div><Link to="/doc" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#17382d] px-6 py-3.5 text-sm font-semibold text-white">Read brochure <ArrowRight className="h-4 w-4" /></Link></div></section>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[.9fr_1.1fr] lg:px-8"><div className="overflow-hidden bg-[#dfe7d5]"><img src="/assets/images/laboratory-research.png" alt="Researchers at work" className="h-full min-h-[320px] w-full object-cover" /></div><div className="flex flex-col justify-center"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#9a6b37]">Discovering and designing the future</p><h2 className="mt-4 text-4xl font-semibold leading-tight tracking-[-.04em] md:text-5xl">Food science for a safer, sustainable future.</h2><p className="mt-6 max-w-xl leading-7 text-[#496257]">The Thammasat University Center of Excellence in Global Food Security advances research and knowledge in Food Science, Food Safety and Food Security at regional and international levels.</p><p className="mt-4 max-w-xl leading-7 text-[#496257]">We are committed to creating food innovations that are safe, sustainable, and accessible, while training the next generation of researchers to compete on the global stage.</p><div className="mt-8 flex flex-wrap gap-5 text-sm font-semibold"><span className="inline-flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[#9a6b37]" /> Secure research access</span><span className="inline-flex items-center gap-2"><Database className="h-5 w-5 text-[#9a6b37]" /> Built for shared data</span></div></div></section>
    </main>
  );
};

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#e1e8db] text-[#17382d]">{icon}</div><h3 className="mt-4 font-semibold">{title}</h3><p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-[#496257]">{text}</p></div>; }
function Metric({ number, label }: { number: string; label: string }) { return <div><p className="text-4xl font-semibold tracking-[-.04em] text-[#e8d3a2]">{number}</p><p className="mt-2 text-xs font-semibold uppercase tracking-[.12em] text-white/65">{label}</p></div>; }

export default Homepage;
