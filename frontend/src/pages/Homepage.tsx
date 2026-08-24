import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  ChevronDown,
  ChevronUp,
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
import { partnerDirectory } from "@/constants/partners";

const PartnerMap = lazy(() => import("@/components/PartnerMap"));

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
    date: "Fiscal Year 2026–2030",
    title: "Detecting Fraud in the Global Tuna Markets",
    funder: "IAEA",
    body: "Building reliable tools for seafood authenticity and traceability.",
    image: "/assets/images/blog-1.jpg",
  },
  {
    date: "Fiscal Year 2026",
    title: "Precision Fermentation for Algal Cultivation",
    funder: "PMU-B",
    body: "High-value biomass and biomolecules at industrial scale.",
    image: "/assets/images/blog-2.jpg",
  },
  {
    date: "Fiscal Year 2024–2027",
    title: "MYCOBEANS: Mycotoxin Risk in Beans",
    funder: "Horizon Europe",
    body: "A global alliance for climate resilience.",
    image: "/assets/images/blog-3.jpg",
  },
];

const Homepage = () => {
  const { isContentAdmin } = useAuth();
  const { language } = useLanguage();
  const location = useLocation();
  const [content, setContent] = useState<HomeContent>(defaultContent);
  const [draft, setDraft] = useState<HomeContent>(defaultContent);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [partnersOpen, setPartnersOpen] = useState(false);
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
        highlightsMetricsLabel: "ภาพรวมโดยย่อ",
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
        newsViewAll: "ดูข่าวทั้งหมด",
        projectsEyebrow: "โครงการวิจัย",
        projectsSubtitle: "โครงการวิจัยเด่นของ CoE-GFS",
        projectsViewAll: "ดูโครงการทั้งหมด",
        projectsFunder: "แหล่งทุน",
        partnersViewAll: "View all partners",
        partnersViewLess: "ย่อรายการพันธมิตร",
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
        highlightsMetricsLabel: "At a glance",
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
        newsViewAll: "View all news",
        projectsEyebrow: "Research projects",
        projectsSubtitle: "Featured research projects from CoE-GFS",
        projectsViewAll: "View all projects",
        projectsFunder: "Funder",
        partnersViewAll: "View all partners",
        partnersViewLess: "Show fewer partners",
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

      {/* Institutional hub overview (Design.md §5.3–5.4) */}
      <section id="highlights" className="hub-section scroll-mt-[100px] px-4 py-20 md:py-24 lg:px-8">
        <div className="hub-section-inner mx-auto max-w-[1280px]">
          <div className="hub-section-header">
            <div className="text-center">
              <p className="hub-section-eyebrow">{t.highlightsEyebrow}</p>
              <h2 className="hub-section-title mt-4 w-full max-w-none">{t.highlightsTitle}</h2>
            </div>
          </div>

          <div className="hub-feature-grid mt-14">
            <Feature index="01" icon={<FlaskConical />} title={t.featureUniversity} text={t.featureUniversityText} />
            <Feature index="02" icon={<BarChart3 />} title={t.featureResearch} text={t.featureResearchText} />
            <Feature index="03" icon={<Leaf />} title={t.featureInternational} text={t.featureInternationalText} />
          </div>

          <div className="hub-metrics mt-12">
            <div className="hub-metrics-header">
              <p>{t.highlightsMetricsLabel}</p>
              <span aria-hidden="true" />
            </div>
            <div className="hub-metrics-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
              <Metric number={content.researcherCount} label={t.statResearchers} />
              <Metric number={content.projectCount} label={t.statProjects} />
              <Metric number={content.publicationCount} label={t.statPublications} />
              <Metric number="3" label={t.statVisits} />
              <Metric number="20+" label={t.statPartners} />
            </div>
          </div>
        </div>
      </section>

      {/* News and research projects (Design.md §5.5) */}
      <section className="news-section border-y border-gfs-maroon/10 px-4 py-16 md:py-20 lg:px-8">
        <div className="mx-auto max-w-[1280px]">
          <div className="text-center">
            <h2 className="news-section-title text-3xl font-bold leading-[1.25] tracking-[-0.02em] md:text-[2.2rem]">{t.newsEyebrow}</h2>
            <div className="news-section-rule mx-auto mt-3" aria-hidden="true" />
            <p className="news-section-subtitle mx-auto mt-4 max-w-2xl text-sm leading-relaxed">{t.newsTitle}</p>
          </div>
          <div className="news-card-grid mt-9 grid gap-5 md:grid-cols-3">
            {news.map((item) => (
              <NewsCard key={item.title} to="/news" {...item} />
            ))}
          </div>
          <div className="mt-8 flex justify-center">
            <Link to="/news" className="view-all-pill">
              {t.newsViewAll} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-20 border-t border-gfs-maroon/10 pt-16">
            <div className="text-center">
              <h2 className="news-section-title text-3xl font-bold leading-[1.25] tracking-[-0.02em] md:text-[2.2rem]">{t.projectsEyebrow}</h2>
              <div className="news-section-rule mx-auto mt-3" aria-hidden="true" />
              <p className="news-section-subtitle mx-auto mt-4 max-w-2xl text-sm leading-relaxed">{t.projectsSubtitle}</p>
            </div>
            <div className="mt-9 grid gap-5 md:grid-cols-3">
              {projects.map((item) => (
                <NewsCard
                  key={item.title}
                  to="/projects"
                  date={item.date}
                  title={item.title}
                  body={`${t.projectsFunder}: ${item.funder} · ${item.body}`}
                  image={item.image}
                />
              ))}
            </div>
            <div className="mt-8 flex justify-center">
              <Link to="/projects" className="view-all-pill">
                {t.projectsViewAll} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Global partnership grid (Design.md §5.6) */}
      <section className="partners-section border-y border-gfs-maroon/10 px-4 py-16 lg:px-8">
        <div className="mx-auto max-w-[1280px]">
          <div className="text-center">
            <p className="text-[0.75rem] font-bold uppercase tracking-[0.05em] text-gfs-maroon">{t.partnersEyebrow}</p>
            <h2 className="mt-2 text-2xl font-bold leading-[1.3] tracking-[-0.01em] text-gfs-maroon md:text-[2rem]">{t.partnersTitle}</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-gfs-text-secondary">{t.partnersSubtitle}</p>
          </div>
          {/* Sliding-window marquee: two copies, translateX(-50%) loops seamlessly.
              Typographic items — no card chrome, just a hairline band. */}
          <div className="group relative left-1/2 mt-10 w-[100vw] -translate-x-1/2 overflow-hidden">
            <div
              aria-hidden="true"
              className="partner-edge partner-edge-left pointer-events-none absolute inset-y-0 left-0 z-10 w-16"
            />
            <div
              aria-hidden="true"
              className="partner-edge partner-edge-right pointer-events-none absolute inset-y-0 right-0 z-10 w-16"
            />
            <div className="border-y border-gfs-maroon/10 py-7">
              <div className="flex w-max gap-12 animate-[gfs-marquee_55s_linear_infinite] group-hover:[animation-play-state:paused] motion-reduce:[animation:none]">
                {[0, 1].map((copy) => (
                  <div key={copy} className="flex gap-12" aria-hidden={copy === 1}>
                    {partnerDirectory.map(([flag, country, names]) => (
                      <article key={`${copy}-${country}`} className="w-[230px] shrink-0">
                        <span className="text-lg leading-none">{flag}</span>
                        <h3 className="mt-2 text-sm font-bold text-gfs-maroon">{country}</h3>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gfs-text-muted">{names.join(" · ")}</p>
                      </article>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-8 flex flex-col items-center">
            <button
              type="button"
              onClick={() => setPartnersOpen((open) => !open)}
              aria-expanded={partnersOpen}
              className="view-all-pill"
            >
              {partnersOpen ? t.partnersViewLess : t.partnersViewAll}
              {partnersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {partnersOpen && (
              <div className="mt-4 w-full animate-[fadeIn_0.3s_ease-out]">
                <p className="mb-3 text-center text-xs font-medium text-gfs-text-muted">
                  {isThai
                    ? "กดที่ประเทศเพื่อเปิดตำแหน่งสถาบันพันธมิตรใน Google Maps"
                    : "Click a country to open its partner institution in Google Maps"}
                </p>
                <div className="overflow-hidden rounded-gfs-card border border-gfs-maroon/10 shadow-gfs-card">
                  <Suspense fallback={<div className="flex min-h-[360px] items-center justify-center text-sm text-gfs-text-muted">Loading partner map…</div>}>
                    <PartnerMap />
                  </Suspense>
                </div>
              </div>
            )}
            {partnersOpen && (
              <div className="mt-6 w-full animate-[fadeIn_0.3s_ease-out] border-t border-gfs-maroon/10 pt-2">
                <div className="grid sm:grid-cols-2 lg:grid-cols-3">
                  {partnerDirectory.map(([flag, country, names]) => (
                    <div key={country} className="flex gap-3 border-b border-gfs-maroon/10 py-4 sm:pr-8">
                      <span aria-hidden="true">{flag}</span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-gfs-maroon">{country}</h3>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 marker:text-gfs-maroon">
                          {names.map((name) => (
                            <li key={name} className="text-xs leading-relaxed text-gfs-text-secondary">
                              {name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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

function Feature({ index, icon, title, text }: { index: string; icon: React.ReactNode; title: string; text: string }) {
  return (
    <article className="hub-feature">
      <div className="hub-feature-meta">
        <span className="hub-feature-index">{index}</span>
        <div className="hub-feature-icon" aria-hidden="true">
          {icon}
        </div>
      </div>
      <h3 className="hub-feature-title">{title}</h3>
      <p className="hub-feature-text">{text}</p>
    </article>
  );
}

function Metric({ number, label }: { number: string; label: string }) {
  return (
    <div className="hub-metric">
      <p className="hub-metric-number">{number}</p>
      <p className="hub-metric-label">{label}</p>
    </div>
  );
}

export default Homepage;
