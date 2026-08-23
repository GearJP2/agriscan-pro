import { ArrowRight, ExternalLink, Mail, MapPin, Phone } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

type Card = { meta?: string; title: string; text: string; link?: string };

const projects: Card[] = [
  { meta: "Fiscal Year 2026–2030 · Funder: IAEA", title: "Detecting Fraud in the Global Tuna Markets", text: "PI: Assos. Prof. Dr. Awanwee Petchkongkaew. CoE-GFS has received IAEA support to advance reliable methods for global tuna-market authenticity." },
  { meta: "Fiscal Year 2026 · Funder: Program Management Unit for Human Resources & Institutional Development, Research and Innovation (PMU-B)", title: "Development of Precision Fermentation Technology for Algal Cultivation to Produce High-Value Biomass and Biomolecules at Industrial Scale", text: "PI: Assoc. Prof. Dr. Supenya Chittapun. A scalable precision-fermentation platform integrating biotechnology, bioprocess engineering, molecular biology, and RNA technologies." },
  { meta: "Fiscal Year 2024–2027 · Funder: European Research Executive Agency (Horizon Europe)", title: "MYCOBEANS — Exploring (Emerging) Mycotoxins Risk in Beans: A Global Alliance for Climate Change Resilience", text: "PI: International Consortium led by University of Parma. Horizon Europe project No. 101131125 studying emerging mycotoxin risk in beans driven by climate change." },
];

const news: Card[] = [
  { meta: "6 Aug 2026 · Visit", title: "CoE-GFS and Agilent Technologies Explore Collaboration in Advanced Analytical Technologies and Capacity Building", text: "CoE-GFS, the Food Science and Technology Program, and the Chemistry Program at Thammasat University discussed technical and academic collaboration with Agilent Technologies." },
  { meta: "30 Jul 2026 · Activity", title: "Thailand Selected to Join the IAEA Coordinated Research Project (CRP) on Seafood Authenticity", text: "CoE-GFS represented Thailand at the First Research Coordination Meeting in Vienna, Austria, from 27–30 July 2026." },
  { meta: "14 Jul 2026 · Event", title: "CoE-GFS Brings Together Global Experts to Advance Research Collaboration on Micro- and Nanoplastics in Food Systems", text: "The forum connected researchers, policymakers, industry professionals, and instrument specialists to discuss current challenges across food systems." },
];

const publications: Card[] = [
  { meta: "Journal of Food Protection · 2026", title: "Anti-biofilm properties of a plantaricin J-containing culture supernatant from Lactiplantibacillus plantarum AV3", text: "Pumpuang, L., Kingcha, Y., Chaipreecha, W., Petchkongkaew, A., & Woraprayote, W. DOI: 10.1016/j.jfp.2026.100815", link: "https://doi.org/10.1016/j.jfp.2026.100815" },
  { meta: "Toxins · 2026", title: "Efficacy of Acid-Treated Mangosteen Peel as a Broad-Spectrum Mycotoxin Binder", text: "Kasikonsunthonchai, W. et al. DOI: 10.3390/toxins18050215", link: "https://doi.org/10.3390/toxins18050215" },
  { meta: "Fermentation · 2026", title: "Valorizing Red Seaweed Spent Biomass into Reducing Sugars for β-Carotene Production by Rhodotorula paludigena", text: "Kongsinkaew, C. et al. DOI: 10.3390/fermentation12050210", link: "https://doi.org/10.3390/fermentation12050210" },
  { meta: "npj Science of Food · 2026", title: "Challenges and strategies for globally resilient shrimp aquaculture", text: "Campbell, E. et al. DOI: 10.1038/s41538-026-00787-7", link: "https://doi.org/10.1038/s41538-026-00787-7" },
  { meta: "npj Science of Food · 2025", title: "A novel LC-MS/MS multi-group method for simultaneous determination of antimicrobial residues in legume-based alternative proteins", text: "Boonkanon, C. et al. DOI: 10.1038/s41538-025-00678-3", link: "https://doi.org/10.1038/s41538-025-00678-3" },
];

const partners = [
  ["🇹🇭 Thailand", "BIOTEC · MTEC · Prince of Songkla University · Mahidol University · Chulalongkorn University · Kasetsart University · Chiang Mai University · PTT Oil and Retail Business · Neogen Asia · MDPI Bangkok · FoSTAT"],
  ["🇺🇸 United States", "CRDF Global · University of British Columbia · Oregon State University · International Life Sciences Institute (ILSI)"],
  ["🇬🇧 United Kingdom", "Queen’s University Belfast · University of Liverpool · Bia Analytical"],
  ["🇮🇪 Ireland", "University College Dublin"],
  ["🇮🇹 Italy", "University of Parma · Barilla Group · ISPA"],
  ["🇦🇹 Austria", "University of Vienna · BOKU · International Atomic Energy Agency"],
  ["🇫🇷 France", "L’institut Agro Dijon"],
  ["🇧🇪 Belgium", "Ghent University"],
  ["🇨🇦 Canada", "International Union of Food Science and Technology"],
  ["🇳🇵 Nepal", "Nepal Development Research Institute"],
  ["🇵🇾 Paraguay", "Microbioticos Paraguay"],
  ["🇨🇳 China", "China National Center for Food Safety Risk Assessment · Pribolab · Shaanxi University of Science and Technology · Wuhan Polytechnic University · Shandong Agricultural University"],
  ["🇭🇰 Hong Kong", "Hong Kong Baptist University"],
  ["🇯🇵 Japan", "Frontier Laboratories · Teiko University · Shizuoka University"],
  ["🇰🇷 South Korea", "Yonsei University"],
  ["🇻🇳 Vietnam", "Phenikaa University · Nong Lam University · Hochiminh University"],
  ["🇸🇬 Singapore", "SCIEX Singapore · Agilent Technologies Singapore · A*STAR · Nanyang Technological University"],
  ["🇲🇾 Malaysia", "Universiti Putra Malaysia"],
  ["🇮🇩 Indonesia", "Atma Jaya Catholic University of Indonesia · Universitas Indonesia"],
  ["🇲🇲 Myanmar", "Myanmar Institute of Strategic and International Studies"],
];

const titleMap: Record<string, [string, string]> = {
  about: ["About Us", "About CoE-GFS"], projects: ["Research Projects", "Projects of the Center"], publications: ["Publications", "Journal papers, posters, and presentations"], news: ["News & Activities", "Latest updates from CoE-GFS"], partners: ["Partners & Networks", "International collaboration networks"], contact: ["Contact", "Get in touch with CoE-GFS"],
};
const thaiTitleMap: Record<string, [string, string]> = {
  about: ["เกี่ยวกับเรา", "เกี่ยวกับ CoE-GFS"], projects: ["โครงการวิจัย", "โครงการวิจัยของศูนย์"], publications: ["ผลงานตีพิมพ์", "บทความวิชาการ โปสเตอร์ และการนำเสนอ"], news: ["ข่าวสารและกิจกรรม", "อัปเดตล่าสุดของ CoE-GFS"], partners: ["พันธมิตรและเครือข่าย", "เครือข่ายความร่วมมือนานาชาติ"], contact: ["ติดต่อ", "ติดต่อ CoE-GFS"],
};

function CardList({ items }: { items: Card[] }) { return <div className="grid gap-px overflow-hidden border border-[#17382d]/15 bg-[#17382d]/15">{items.map((item) => <article key={item.title} className="bg-[#fafaf7] p-7 md:p-9"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#9a6b37]">{item.meta}</p><h2 className="mt-3 max-w-4xl text-xl font-semibold leading-7 tracking-[-.02em] md:text-2xl">{item.title}</h2><p className="mt-4 max-w-4xl text-sm leading-7 text-[#496257]">{item.text}</p>{item.link && <a href={item.link} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-bold underline underline-offset-4">View publication <ExternalLink className="h-4 w-4" /></a>}</article>)}</div>; }

export default function CoEGfsPage() {
  const { page } = useParams();
  const { language } = useLanguage();
  if (!page || !titleMap[page]) return <Navigate to="/" replace />;
  const [eyebrow, title] = language === "th" ? thaiTitleMap[page] : titleMap[page];
  return <main className="coe-theme min-h-screen bg-[#fafaf7] px-6 py-16 text-[#17382d] lg:px-8"><div className="mx-auto max-w-7xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#9a6b37]">{eyebrow}</p><h1 className="mt-3 text-4xl font-semibold tracking-[-.04em] md:text-6xl">{title}</h1>
    {page === "about" && <section className="mt-12 max-w-4xl space-y-7 text-[15px] leading-8 text-[#496257]"><p>The Thammasat University Center of Excellence in Global Food Security (CoE-GFS) was established to address the complex and multifaceted challenges of food security in the 21st century. Thailand and the ASEAN region are experiencing rapid transformations across production, distribution, consumption, and food safety.</p><p>The Center advances knowledge and innovative technologies in Food Security, Food Safety, and Food Authenticity—from micro-level scientific investigations to macro-level system and policy considerations. It also works with Medicine and Public Health on human health, nutrition, consumer behaviour, and chemical and biological risk assessment through a One Health approach.</p><p>Guided by the Bio-Circular-Green Economy model, Thailand’s 20-Year National Strategy, and the UN Sustainable Development Goals, CoE-GFS combines food biotechnology, smart agriculture, omics technologies, and bioinformatics to support resilient food systems.</p><div className="mt-10 grid gap-px border border-[#17382d]/15 bg-[#17382d]/15 md:grid-cols-4">{["Knowledge & Technology Transfer", "Innovation through Interdisciplinary Technology", "Development of Early-career Researchers", "Global Reputation and Impact"].map((mission) => <div key={mission} className="bg-[#eff2e8] p-6"><p className="text-sm font-semibold text-[#17382d]">{mission}</p></div>)}</div><div className="border-l-2 border-[#9a6b37] pl-5"><p className="font-semibold text-[#17382d]">Vision</p><p>To be a global leader in advancing food security through Science, Innovation, and Collaborative impact.</p></div></section>}
    {page === "projects" && <section className="mt-12"><CardList items={projects} /></section>}
    {page === "publications" && <section className="mt-12"><CardList items={publications} /></section>}
    {page === "news" && <section className="mt-12"><CardList items={news} /></section>}
    {page === "partners" && <section className="mt-8"><p className="max-w-3xl text-[15px] leading-7 text-[#496257]">CoE-GFS works with leading research institutions, industry partners, and international organizations across more than 20 countries.</p><div className="mt-10 grid gap-px border border-[#17382d]/15 bg-[#17382d]/15 md:grid-cols-2">{partners.map(([country, names]) => <article key={country} className="bg-[#fafaf7] p-6"><h2 className="font-semibold">{country}</h2><p className="mt-2 text-sm leading-6 text-[#496257]">{names}</p></article>)}</div></section>}
    {page === "contact" && <section className="mt-12 grid max-w-4xl gap-px border border-[#17382d]/15 bg-[#17382d]/15 md:grid-cols-3"><div className="bg-[#eff2e8] p-7"><MapPin className="h-5 w-5 text-[#9a6b37]" /><h2 className="mt-5 font-semibold">Location</h2><p className="mt-2 text-sm leading-6 text-[#496257]">CoE-GFS Office<br />Lecture Building 2<br />Faculty of Science and Technology<br />Thammasat University, Rangsit Campus<br />Pathum Thani 12120, Thailand</p></div><div className="bg-[#fafaf7] p-7"><Mail className="h-5 w-5 text-[#9a6b37]" /><h2 className="mt-5 font-semibold">Email</h2><a className="mt-2 block text-sm text-[#496257] underline" href="mailto:coe.gfs@tu.ac.th">coe.gfs@tu.ac.th</a></div><div className="bg-[#fafaf7] p-7"><Phone className="h-5 w-5 text-[#9a6b37]" /><h2 className="mt-5 font-semibold">Phone</h2><p className="mt-2 text-sm text-[#496257]">095-223-9052<br />Fon — Project Manager</p></div></section>}
    <div className="mt-14 border-t border-[#17382d]/10 pt-6"><Link to="/" className="inline-flex items-center gap-2 text-sm font-bold underline underline-offset-4">Back to homepage <ArrowRight className="h-4 w-4" /></Link></div>
  </div></main>;
}
