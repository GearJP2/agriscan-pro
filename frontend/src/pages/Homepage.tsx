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
    "CoE-GFS advances science, innovation, and partnerships for safe and sustainable food systems.",
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
  {
    date: "FY2026–2030",
    title: "Detecting Fraud in the Global Tuna Markets",
    body: "Funder: IAEA · Building reliable tools for seafood authenticity.",
    image: "/assets/images/blog-1.jpg",
  },
  {
    date: "FY2026",
    title: "Precision Fermentation for Algal Cultivation",
    body: "Funder: PMU-B · High-value biomass and biomolecules at industrial scale.",
    image: "/assets/images/blog-2.jpg",
  },
  {
    date: "FY2024–2027",
    title: "MYCOBEANS: Mycotoxin Risk in Beans",
    body: "Funder: Horizon Europe · A global alliance for climate resilience.",
    image: "/assets/images/blog-3.jpg",
  },
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
  const displayContent = isThai
    ? {
        ...content,
        eyebrow: "มหาวิทยาลัยธรรมศาสตร์ · แพลตฟอร์มวิจัยความปลอดภัยอาหาร",
        title: "ปลดล็อกความมั่นคงทางอาหารระดับโลก",
        intro:
          "CoE-GFS ขับเคลื่อนวิทยาศาสตร์ นวัตกรรม และเครือข่ายความร่วมมือ เพื่อระบบอาหารที่ปลอดภัยและยั่งยืน",
        secondaryCta: "ค้นพบเพิ่มเติม",
      }
    : content;
  const t = isThai
    ? {
        highlightsEyebrow: "จุดเริ่มต้นของทุกอย่าง",
        highlightsTitle: "CoE-GFS คือศูนย์กลางการวิจัยความมั่นคงทางอาหารของประเทศไทย",
        highlightsSubtitle: "เชื่อมโยงนักวิจัย หลักฐานเชิงประจักษ์ และพันธมิตรในกว่า 20 ประเทศทั่วโลก",
        featureUniversity: "มหาวิทยาลัย",
        featureUniversityText: "สังกัดคณะวิทยาศาสตร์และเทคโนโลยี มหาวิทยาลัยธรรมศาสตร์",
        featureResearch: "งานวิจัยสหวิชาชีพ",
        featureResearchText: "ครอบคลุมเกษตร เทคโนโลยีชีวภาพ ความปลอดภัยอาหาร การปลอมแปลงอาหาร โอมิกส์ และ One Health",
        featureInternational: "นานาชาติ",
        featureInternationalText: "พันธมิตรทั่วยุโรป เอเชีย อเมริกา และโอเชียเนีย",
        statResearchers: "นักวิจัยและนักศึกษา",
        statProjects: "โครงการวิจัยที่ดำเนินอยู่",
        statPublications: "ผลงานตีพิมพ์ / โปสเตอร์",
        statVisits: "การเข้าร่วมและภารกิจ",
        statPartners: "พันธมิตรระดับนานาชาติ",
        newsEyebrow: "ข่าวสารและบทความ",
        newsTitle: "ข่าวสารล่าสุดจาก CoE-GFS",
        projectsTitle: "งานวิจัยที่ทำให้ความปลอดภัยวัดได้",
        viewAll: "ดูทั้งหมด",
        readMore: "อ่านต่อ",
        explorePredictions: "สำรวจการคาดการณ์",
        partnersEyebrow: "พันธมิตรและเครือข่าย",
        partnersTitle: "เครือข่ายความร่วมมือระดับนานาชาติของ CoE-GFS",
        partnersSubtitle:
          "สถาบันวิจัยชั้นนำ ภาคีเครือข่ายอุตสาหกรรม และองค์กรระหว่างประเทศในกว่า 20 ประเทศ",
        aboutEyebrow: "เกี่ยวกับเรา",
        aboutTitle: "วิทยาศาสตร์อาหารเพื่ออนาคตที่ปลอดภัยและยั่งยืน",
        aboutText:
          "ศูนย์ความเป็นเลิศด้านความมั่นคงทางอาหารระดับโลก มหาวิทยาลัยธรรมศาสตร์ ขับเคลื่อนการวิจัยและความรู้ด้านวิทยาศาสตร์อาหาร ความปลอดภัยอาหาร และความมั่นคงทางอาหารในระดับภูมิภาคและนานาชาติ",
        secureAccess: "การเข้าถึงงานวิจัยที่ปลอดภัย",
        sharedData: "ออกแบบมาเพื่อข้อมูลส่วนรวม",
      }
    : {
        highlightsEyebrow: "It all starts here",
        highlightsTitle: "CoE-GFS is Thailand's hub for food security research.",
        highlightsSubtitle: "Connecting researchers, evidence, and partners in 20+ countries worldwide.",
        featureUniversity: "University",
        featureUniversityText: "Part of the Faculty of Science and Technology, Thammasat University.",
        featureResearch: "Interdisciplinary Research",
        featureResearchText: "Spanning agriculture, biotech, safety, authenticity, omics, and One Health.",
        featureInternational: "International",
        featureInternationalText: "Partners across Europe, Asia, the Americas, and Oceania.",
        statResearchers: "Researchers & students",
        statProjects: "Active projects",
        statPublications: "Publications / posters",
        statVisits: "Visits & engagement",
        statPartners: "International partners",
        newsEyebrow: "News & resources",
        newsTitle: "Latest from CoE-GFS",
        projectsTitle: "Research that makes safety measurable.",
        viewAll: "View all",
        readMore: "Read more",
        explorePredictions: "Explore predictions",
        partnersEyebrow: "Partners & networks",
        partnersTitle: "CoE-GFS international collaboration networks",
        partnersSubtitle:
          "Leading research institutions, industry partners, and international organizations across more than 20 countries.",
        aboutEyebrow: "About us",
        aboutTitle: "Food science for a safer, sustainable future.",
        aboutText:
          "The Thammasat University Center of Excellence in Global Food Security advances research and knowledge in Food Science, Food Safety and Food Security at regional and international levels.",
        secureAccess: "Secure research access",
        sharedData: "Built for shared data",
      };

  useEffect(() => {
    void publicApiClient
      .get("/homepage/")
      .then(({ data }) => {
        if (data.content) {
          const initial = { ...defaultContent, ...data.content };
          setContent(initial);
          setDraft(initial);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (location.pathname === "/manage" && isContentAdmin) {
      setEditing(true);
    }
  }, [isContentAdmin, location.pathname]);

  const save = async () => {
    await apiClient.put("/homepage/", { content: draft });
    setContent(draft);
    setEditing(false);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  const reset = async () => {
    await apiClient.put("/homepage/", { content: defaultContent });
    setContent(defaultContent);
    setDraft(defaultContent);
  };

  return (
    <main id="main-content" className="coe-gfs">
      {isContentAdmin && (
        <div className="fixed bottom-5 right-5 z-[70] flex items-center gap-2">
          {saved && (
            <span className="rounded-gfs-pill bg-gfs-maroon px-4 py-2 text-xs font-semibold text-white shadow-lg">
              Homepage saved
            </span>
          )}
          <button
            onClick={() => {
              setDraft(content);
              setEditing(true);
            }}
            className="inline-flex items-center gap-2 rounded-gfs-pill bg-gfs-maroon px-5 py-3 text-sm font-semibold text-white shadow-xl transition hover:bg-gfs-maroon-hover"
          >
            <Edit3 className="h-4 w-4" /> Edit homepage
          </button>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/60 p-4 backdrop-blur-sm md:p-8">
          <section className="mx-auto max-w-3xl rounded-gfs-card bg-white p-6 shadow-gfs-modal md:p-9">
            <div className="mb-7 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-gfs-maroon">Admin content editor</p>
                <h2 className="mt-2 text-2xl font-bold text-gfs-maroon">Edit the public homepage</h2>
              </div>
              <button onClick={() => setEditing(false)} aria-label="Close editor" className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
                <X />
              </button>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {(
                [
                  "eyebrow",
                  "title",
                  "heroImage",
                  "primaryCta",
                  "secondaryCta",
                  "researcherCount",
                  "projectCount",
                  "publicationCount",
                ] as const
              ).map((field) => (
                <label key={field} className={field === "title" || field === "heroImage" ? "md:col-span-2" : ""}>
                  <span className="mb-1.5 block text-xs font-bold capitalize text-slate-600">{field.replace(/([A-Z])/g, " $1")}</span>
                  <input
                    value={draft[field]}
                    onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-gfs-gold focus:ring-2"
                  />
                </label>
              ))}
              <label className="md:col-span-2">
                <span className="mb-1.5 block text-xs font-bold text-slate-600">Introduction</span>
                <textarea
                  rows={4}
                  value={draft.intro}
                  onChange={(e) => setDraft({ ...draft, intro: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-gfs-gold focus:ring-2"
                />
              </label>
            </div>
            <div className="mt-7 flex flex-wrap justify-between gap-3 border-t pt-5">
              <button onClick={reset} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-gfs-maroon">
                <RotateCcw className="h-4 w-4" /> Restore defaults
              </button>
              <div className="flex gap-3">
                <button onClick={() => setEditing(false)} className="rounded-gfs-pill px-5 py-2.5 text-sm font-semibold text-slate-600">
                  Cancel
                </button>
                <button
                  onClick={save}
                  className="inline-flex items-center gap-2 rounded-gfs-pill bg-gfs-maroon px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gfs-maroon-hover"
                >
                  <Save className="h-4 w-4" /> Save changes
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Hero banner with overlay card (Design.md §5.2) */}
      <section className="relative min-h-[420px] w-full overflow-hidden bg-black lg:aspect-[16/9] lg:max-h-[90vh]">
        <img
          src={content.heroImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover saturate-[1.15] contrast-[1.05]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/40 to-transparent" />
        <div className="absolute inset-0 flex items-center">
          <div className="mx-auto w-full max-w-[1280px] px-4 py-16 lg:px-8">
            <div className="max-w-xl rounded-gfs-card bg-gfs-canvas/95 p-7 shadow-gfs-modal backdrop-blur-sm md:p-9">
              <p className="text-[0.75rem] font-bold uppercase tracking-[0.05em] text-gfs-maroon">{displayContent.eyebrow}</p>
              <h1 className="mt-3 text-3xl font-bold leading-[1.2] tracking-[-0.02em] text-gfs-maroon md:text-[2.75rem]">
                {displayContent.title}
              </h1>
              <p className="mt-4 text-[0.95rem] leading-relaxed text-gfs-text-secondary">{displayContent.intro}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/dashboard" className="btn-pill btn-pill-primary">
                  {displayContent.primaryCta} <ArrowRight className="h-4 w-4" />
                </Link>
                <a href="#highlights" className="btn-pill btn-pill-outline">
                  {displayContent.secondaryCta} <ChevronDown className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Three-column highlights row (Design.md §5.3) */}
      <section id="highlights" className="mx-auto max-w-[1280px] scroll-mt-[80px] px-4 py-16 md:py-20 lg:scroll-mt-[150px] lg:px-8">
        <p className="text-center text-[0.75rem] font-bold uppercase tracking-[0.05em] text-gfs-maroon">{t.highlightsEyebrow}</p>
        <div className="mx-auto mt-3 max-w-2xl text-center">
          <h2 className="text-2xl font-bold leading-[1.3] tracking-[-0.01em] text-gfs-maroon md:text-[2rem]">{t.highlightsTitle}</h2>
          <p className="mt-4 leading-relaxed text-gfs-text-secondary">{t.highlightsSubtitle}</p>
        </div>
        <div className="mt-12 grid gap-10 border-y border-gfs-maroon/10 py-10 md:grid-cols-3">
          <Feature icon={<FlaskConical />} title={t.featureUniversity} text={t.featureUniversityText} />
          <Feature icon={<BarChart3 />} title={t.featureResearch} text={t.featureResearchText} />
          <Feature icon={<Leaf />} title={t.featureInternational} text={t.featureInternationalText} />
        </div>
      </section>

      {/* Institutional stats counter bar (Design.md §5.4) */}
      <section className="bg-gfs-maroon px-4 py-12 lg:px-8 lg:py-[52px]">
        <div className="mx-auto grid max-w-[1280px] grid-cols-2 gap-8 text-center sm:grid-cols-3 lg:grid-cols-5">
          <Metric number={content.researcherCount} label={t.statResearchers} />
          <Metric number={content.projectCount} label={t.statProjects} />
          <Metric number={content.publicationCount} label={t.statPublications} />
          <Metric number="3" label={t.statVisits} />
          <Metric number="20+" label={t.statPartners} />
        </div>
      </section>

      {/* News and research projects split section (Design.md §5.5) */}
      <section className="mx-auto max-w-[1280px] px-4 py-16 md:py-20 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-8 xl:gap-12">
          <div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[0.75rem] font-bold uppercase tracking-[0.05em] text-gfs-maroon">{t.newsEyebrow}</p>
                <h2 className="mt-2 text-xl font-bold leading-[1.3] text-gfs-maroon md:text-2xl">{t.newsTitle}</h2>
              </div>
              <Link to="/news" className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-gfs-maroon underline underline-offset-4 hover:text-gfs-maroon-hover">
                {t.viewAll} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 2xl:grid-cols-3">
              {news.map((item) => (
                <NewsCard key={item.title} to="/news" {...item} />
              ))}
            </div>
          </div>
          <div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="max-w-md text-xl font-bold leading-[1.3] text-gfs-maroon md:text-2xl">{t.projectsTitle}</h2>
              <Link to="/projects" className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-gfs-maroon underline underline-offset-4 hover:text-gfs-maroon-hover">
                {t.viewAll} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 2xl:grid-cols-3">
              {projects.map((item) => (
                <NewsCard key={item.title} to="/projects" {...item} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Global partnership grid (Design.md §5.6) */}
      <section className="border-y border-gfs-maroon/10 bg-white px-4 py-16 lg:px-8">
        <div className="mx-auto max-w-[1280px]">
          <div className="text-center">
            <p className="text-[0.75rem] font-bold uppercase tracking-[0.05em] text-gfs-maroon">{t.partnersEyebrow}</p>
            <h2 className="mt-2 text-2xl font-bold leading-[1.3] tracking-[-0.01em] text-gfs-maroon md:text-[2rem]">{t.partnersTitle}</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-gfs-text-secondary">{t.partnersSubtitle}</p>
          </div>
          <div className="mt-10 grid gap-px overflow-hidden rounded-gfs-card border border-gfs-maroon/10 bg-gfs-maroon/10 shadow-gfs-card sm:grid-cols-2 lg:grid-cols-4">
            {partners.map(([flag, country, names]) => (
              <article key={country} className="bg-gfs-canvas p-6 transition-colors hover:bg-gfs-thumb/50">
                <span className="text-2xl">{flag}</span>
                <h3 className="mt-4 font-bold text-gfs-maroon">{country}</h3>
                <p className="mt-2 text-xs leading-relaxed text-gfs-text-secondary">{names}</p>
              </article>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link to="/partners" className="inline-flex items-center gap-2 text-sm font-bold text-gfs-maroon underline underline-offset-4 hover:text-gfs-maroon-hover">
              {t.viewAll} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* About band */}
      <section className="mx-auto grid max-w-[1280px] items-center gap-10 px-4 py-16 md:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <div className="overflow-hidden rounded-gfs-card shadow-gfs-card">
          <img src="/assets/images/laboratory-research.png" alt="" className="h-full min-h-[320px] w-full object-cover" />
        </div>
        <div>
          <p className="text-[0.75rem] font-bold uppercase tracking-[0.05em] text-gfs-maroon">{t.aboutEyebrow}</p>
          <h2 className="mt-3 text-2xl font-bold leading-[1.3] tracking-[-0.01em] text-gfs-maroon md:text-[2rem]">{t.aboutTitle}</h2>
          <p className="mt-5 max-w-xl leading-relaxed text-gfs-text-secondary">{t.aboutText}</p>
          <div className="mt-6 flex flex-wrap gap-5 text-sm font-semibold text-gfs-text-primary">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-gfs-maroon" /> {t.secureAccess}
            </span>
            <span className="inline-flex items-center gap-2">
              <Database className="h-5 w-5 text-gfs-maroon" /> {t.sharedData}
            </span>
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/about" className="btn-pill btn-pill-outline">
              {isThai ? "เกี่ยวกับ CoE-GFS" : "About CoE-GFS"} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/prediction" className="btn-pill btn-pill-primary">
              {t.explorePredictions}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
};

function NewsCard({ date, title, body, image, to }: { date: string; title: string; body: string; image: string; to: string }) {
  return (
    <Link to={to} className="content-card">
      <div className="content-card-thumb">
        <img src={image} alt="" />
      </div>
      <div className="content-card-body">
        <span className="date-pill">{date}</span>
        <h3 className="card-title-clamp">{title}</h3>
        <p className="card-excerpt-clamp">{body}</p>
      </div>
    </Link>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gfs-maroon/tint text-gfs-maroon [&_svg]:h-6 [&_svg]:w-6">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-gfs-maroon">{title}</h3>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-gfs-text-secondary">{text}</p>
    </div>
  );
}

function Metric({ number, label }: { number: string; label: string }) {
  return (
    <div>
      <p className="text-[2.5rem] font-extrabold leading-none tracking-[-0.03em] text-gfs-gold">{number}</p>
      <p className="mt-2 text-[0.95rem] font-medium text-white">{label}</p>
    </div>
  );
}

export default Homepage;
