import { useState } from 'react';
import {
  FileText,
  LayoutDashboard,
  FlaskConical,
  TrendingUp,
  UserCog,
  Code2,
  BookOpen,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Hourglass,
  Flag,
  MapPin,
  Download,
  Upload,
  Search,
  Key,
  Shield,
  Mail,
  Lock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Lang = 'en' | 'th';

/* ── types ─────────────────────────────────────────────── */
type SectionId =
  | 'overview'
  | 'dashboard'
  | 'samplelist'
  | 'prediction'
  | 'account'
  | 'api';

interface NavItem {
  id: SectionId;
  labelEn: string;
  labelTh: string;
  icon: React.ReactNode;
  children?: { id: string; labelEn: string; labelTh: string }[];
}

/* ── nav config ─────────────────────────────────────────── */
const NAV_ITEMS: NavItem[] = [
  {
    id: 'overview',
    labelEn: 'Overview',
    labelTh: 'ภาพรวม',
    icon: <BookOpen className="h-4 w-4" />,
  },
  {
    id: 'dashboard',
    labelEn: 'Dashboard',
    labelTh: 'แดชบอร์ด',
    icon: <LayoutDashboard className="h-4 w-4" />,
    children: [
      { id: 'dashboard-system', labelEn: 'System Overview', labelTh: 'ภาพรวมระบบ' },
      { id: 'dashboard-risk', labelEn: 'Risk Overview', labelTh: 'ภาพรวมความเสี่ยง' },
      { id: 'dashboard-action', labelEn: 'Action Items', labelTh: 'รายการที่ต้องดำเนินการ' },
    ],
  },
  {
    id: 'samplelist',
    labelEn: 'Sample List',
    labelTh: 'รายการตัวอย่าง',
    icon: <FlaskConical className="h-4 w-4" />,
  },
  {
    id: 'prediction',
    labelEn: 'Prediction',
    labelTh: 'การทำนาย',
    icon: <TrendingUp className="h-4 w-4" />,
  },
  {
    id: 'account',
    labelEn: 'Account & Privacy',
    labelTh: 'บัญชีและความเป็นส่วนตัว',
    icon: <UserCog className="h-4 w-4" />,
  },
  {
    id: 'api',
    labelEn: 'API',
    labelTh: 'API',
    icon: <Code2 className="h-4 w-4" />,
  },
];

/* ── helpers ────────────────────────────────────────────── */
function SectionTitle({
  en,
  th,
  icon,
  lang,
}: {
  en: string;
  th: string;
  icon?: React.ReactNode;
  lang: Lang;
}) {
  return (
    <div className="flex items-center gap-3 mb-1">
      {icon && <span className="text-primary">{icon}</span>}
      <h2 className="text-2xl font-bold text-foreground">{lang === 'en' ? en : th}</h2>
    </div>
  );
}

function SubTitle({ en, th, lang }: { en: string; th: string; lang: Lang }) {
  return (
    <div className="mb-3">
      <h3 className="text-lg font-semibold text-foreground">{lang === 'en' ? en : th}</h3>
    </div>
  );
}

function Txt({ en, th, lang, className }: { en: string; th: string; lang: Lang; className?: string }) {
  return <p className={cn('text-sm text-foreground', className)}>{lang === 'en' ? en : th}</p>;
}

function FeatureCard({
  icon,
  en,
  th,
  lang,
  badge,
  badgeTh,
}: {
  icon: React.ReactNode;
  en: string;
  th: string;
  lang: Lang;
  badge?: string;
  badgeTh?: string;
}) {
  const badgeLabel = lang === 'en' ? badge : (badgeTh ?? badge);
  return (
    <div className="flex gap-3 p-4 rounded-lg border border-border/50 bg-background/30">
      <div className="mt-0.5 flex-shrink-0 rounded-lg bg-primary/10 p-2 text-primary h-fit">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-foreground text-sm">{lang === 'en' ? en : th}</p>
          {badgeLabel && (
            <Badge variant="secondary" className="text-[10px]">
              {badgeLabel}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="bg-muted/60 border border-border/50 rounded-lg p-4 text-xs text-foreground overflow-x-auto font-mono">
      {code}
    </pre>
  );
}

function Divider() {
  return <hr className="border-border/40 my-8" />;
}

/* ── main component ──────────────────────────────────────── */
const Doc = () => {
  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const [lang, setLang] = useState<Lang>('th');

  const t = (en: string, th: string) => (lang === 'en' ? en : th);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    const section = NAV_ITEMS.find((n) => n.id === id || n.children?.some((c) => c.id === id));
    if (section) setActiveSection(section.id as SectionId);
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container py-8">
        {/* Page Title + Lang Toggle */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-foreground" />
            <h1 className="text-2xl font-bold text-foreground">
              {t('Documentation', 'คู่มือการใช้งาน')}
            </h1>
          </div>

          {/* Language Toggle */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
            <button
              onClick={() => setLang('th')}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                lang === 'th'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              ภาษาไทย
            </button>
            <button
              onClick={() => setLang('en')}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                lang === 'en'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              English
            </button>
          </div>
        </div>

        <div className="flex gap-8 items-start">
          {/* ── Sidebar ── */}
          <aside className="hidden lg:block w-56 flex-shrink-0 sticky top-8">
            <Card className="glass-card">
              <CardContent className="p-3">
                <nav className="space-y-0.5">
                  {NAV_ITEMS.map((item) => (
                    <div key={item.id}>
                      <button
                        onClick={() => scrollToSection(item.id)}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors text-left',
                          activeSection === item.id
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                        )}
                      >
                        {item.icon}
                        <span className="flex-1 truncate">
                          {lang === 'en' ? item.labelEn : item.labelTh}
                        </span>
                        {item.children && <ChevronRight className="h-3 w-3 opacity-50" />}
                      </button>
                      {item.children && activeSection === item.id && (
                        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border/50 pl-3">
                          {item.children.map((child) => (
                            <button
                              key={child.id}
                              onClick={() => scrollToSection(child.id)}
                              className="w-full text-left px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded transition-colors"
                            >
                              {lang === 'en' ? child.labelEn : child.labelTh}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </nav>
              </CardContent>
            </Card>
          </aside>

          {/* ── Content ── */}
          <div className="flex-1 min-w-0 space-y-12">

            {/* ══ OVERVIEW ══ */}
            <section id="overview">
              <SectionTitle
                en="Overview"
                th="ภาพรวมของระบบ"
                icon={<BookOpen className="h-6 w-6" />}
                lang={lang}
              />
              <Divider />

              <div className="space-y-6">
                <Card className="glass-card">
                  <CardContent className="p-6 space-y-4">
                    <Txt
                      lang={lang}
                      en="AgriScan Pro is a comprehensive agricultural research platform designed for lab sample management and mycotoxin contamination detection. It provides end-to-end tracking from sample collection through laboratory analysis to risk assessment."
                      th="AgriScan Pro คือแพลตฟอร์มวิจัยทางการเกษตรที่ครบวงจร ออกแบบมาเพื่อการจัดการตัวอย่างในห้องปฏิบัติการและตรวจจับการปนเปื้อนของไมโคทอกซิน ครอบคลุมตั้งแต่การเก็บตัวอย่างไปจนถึงการวิเคราะห์ในห้องแล็บและการประเมินความเสี่ยง"
                    />
                    <Txt
                      lang={lang}
                      en="The system supports multiple user roles — Administrator, Head Researcher, Researcher, and Research Assistant — each with appropriate permissions for managing samples and viewing results."
                      th="ระบบรองรับบทบาทผู้ใช้หลายระดับ ได้แก่ ผู้ดูแลระบบ (Admin), นักวิจัยอาวุโส (Head Researcher), นักวิจัย (Researcher) และผู้ช่วยวิจัย (Research Assistant) โดยแต่ละบทบาทมีสิทธิ์การเข้าถึงที่เหมาะสม"
                    />
                  </CardContent>
                </Card>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FeatureCard lang={lang} icon={<FlaskConical className="h-4 w-4" />} en="Sample Tracking" th="ติดตามสถานะตัวอย่างแบบ Real-time" />
                  <FeatureCard lang={lang} icon={<AlertTriangle className="h-4 w-4" />} en="Mycotoxin Risk Detection" th="ตรวจจับและประเมินความเสี่ยงไมโคทอกซิน" />
                  <FeatureCard lang={lang} icon={<Download className="h-4 w-4" />} en="Data Export (CSV / XLSX)" th="ส่งออกข้อมูลในรูปแบบ CSV และ XLSX" />
                  <FeatureCard lang={lang} icon={<Upload className="h-4 w-4" />} en="Bulk Import" th="นำเข้าตัวอย่างจำนวนมากพร้อมกัน" />
                </div>

                <Card className="glass-card border-primary/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{t('User Roles', 'บทบาทผู้ใช้')}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border/50 text-left">
                            <th className="pb-2 pr-4 font-medium text-muted-foreground">{t('Role', 'บทบาท')}</th>
                            <th className="pb-2 font-medium text-muted-foreground">{t('Permissions', 'สิทธิ์การใช้งาน')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { role: 'Administrator', th: 'ผู้ดูแลระบบ', permEn: 'Full access to all features', permTh: 'เข้าถึงทุกฟีเจอร์' },
                            { role: 'Head Researcher', th: 'นักวิจัยอาวุโส', permEn: 'Manage samples, approve results', permTh: 'จัดการตัวอย่าง, อนุมัติผล' },
                            { role: 'Researcher', th: 'นักวิจัย', permEn: 'Add & update samples', permTh: 'เพิ่มและอัปเดตตัวอย่าง' },
                            { role: 'Research Assistant', th: 'ผู้ช่วยวิจัย', permEn: 'View & record results', permTh: 'ดูและบันทึกผล' },
                          ].map((r) => (
                            <tr key={r.role} className="border-b border-border/30 last:border-0">
                              <td className="py-2 pr-4 font-medium text-foreground">{lang === 'en' ? r.role : r.th}</td>
                              <td className="py-2 text-muted-foreground text-xs">{lang === 'en' ? r.permEn : r.permTh}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* ══ DASHBOARD ══ */}
            <section id="dashboard">
              <SectionTitle en="Dashboard" th="แดชบอร์ด" icon={<LayoutDashboard className="h-6 w-6" />} lang={lang} />
              <Divider />

              <div className="space-y-4 mb-8">
                <Txt
                  lang={lang}
                  en="The Dashboard provides a real-time snapshot of the system's state, team workload, and risk status. It is the first page you see after logging in."
                  th="แดชบอร์ดแสดงสถานะของระบบแบบ Real-time รวมถึงภาระงานของทีมและสถานะความเสี่ยง เป็นหน้าแรกที่แสดงหลังจากเข้าสู่ระบบ"
                />
              </div>

              {/* Feature 1 */}
              <div id="dashboard-system" className="space-y-4 mb-10">
                <SubTitle en="1. System Overview (Admin only)" th="1. ภาพรวมระบบ (เฉพาะผู้ดูแลระบบ)" lang={lang} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <FeatureCard lang={lang} icon={<FlaskConical className="h-4 w-4" />} en="Total Registered" th="ตัวอย่างทั้งหมดในระบบ" badge="All" />
                  <FeatureCard lang={lang} icon={<Clock className="h-4 w-4" />} en="In Progress" th="กำลังวิเคราะห์อยู่" badge="Live" />
                  <FeatureCard lang={lang} icon={<CheckCircle2 className="h-4 w-4" />} en="Completed" th="ทำการทดสอบเสร็จแล้ว" />
                  <FeatureCard lang={lang} icon={<Hourglass className="h-4 w-4" />} en="Awaiting Processing" th="รออยู่ในคิว (Pending)" />
                </div>
                <Card className="glass-card">
                  <CardContent className="p-4">
                    <Txt
                      lang={lang}
                      en="The Team Workload section shows this week's completed samples, currently processing, and in-queue counts. A trend indicator compares this week against last week."
                      th="ส่วน Team Workload แสดงจำนวนตัวอย่างที่ดำเนินการเสร็จในสัปดาห์นี้, กำลังดำเนินการ และรอคิว พร้อมตัวบ่งชี้แนวโน้มเปรียบเทียบกับสัปดาห์ที่แล้ว"
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Feature 2 */}
              <div id="dashboard-risk" className="space-y-4 mb-10">
                <SubTitle en="2. Risk Overview" th="2. ภาพรวมความเสี่ยง" lang={lang} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="p-4 rounded-lg border border-danger/30 bg-danger/5 text-center">
                    <AlertTriangle className="h-5 w-5 text-danger mx-auto mb-1" />
                    <p className="font-semibold text-danger text-sm">High Risk</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('Requires immediate action', 'ความเสี่ยงสูง — ต้องดำเนินการด่วน')}</p>
                  </div>
                  <div className="p-4 rounded-lg border border-warning/30 bg-warning/5 text-center">
                    <AlertTriangle className="h-5 w-5 text-warning mx-auto mb-1" />
                    <p className="font-semibold text-warning text-sm">Medium Risk</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('Monitor closely', 'ความเสี่ยงปานกลาง — ต้องติดตาม')}</p>
                  </div>
                  <div className="p-4 rounded-lg border border-success/30 bg-success/5 text-center">
                    <CheckCircle2 className="h-5 w-5 text-success mx-auto mb-1" />
                    <p className="font-semibold text-success text-sm">Safe</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('Below threshold', 'ปลอดภัย — ค่าต่ำกว่าเกณฑ์')}</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FeatureCard lang={lang} icon={<MapPin className="h-4 w-4" />} en="Top 3 High-Risk Regions" th="พื้นที่ที่มีความเสี่ยงสูงสุด 3 อันดับแรก" />
                  <FeatureCard lang={lang} icon={<FlaskConical className="h-4 w-4" />} en="Top 3 High-Risk Vegetation" th="พืชพรรณที่มีความเสี่ยงสูงสุด 3 อันดับแรก" />
                </div>
                <Card className="glass-card">
                  <CardContent className="p-4">
                    <Txt
                      lang={lang}
                      en="Risk levels are determined by mycotoxin intensity: High (dangerous flag set), Medium (intensity ≥ 7), Low (intensity ≥ 4), Safe (below threshold). The monthly trend compares this month's high-risk count against last month."
                      th="ระดับความเสี่ยงถูกกำหนดโดยค่าความเข้มไมโคทอกซิน: สูง (มีการตั้งค่า Dangerous), ปานกลาง (ค่า ≥ 7), ต่ำ (ค่า ≥ 4), ปลอดภัย (ต่ำกว่าเกณฑ์) แนวโน้มรายเดือนเปรียบเทียบจำนวนความเสี่ยงสูงในเดือนนี้กับเดือนที่แล้ว"
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Feature 3 */}
              <div id="dashboard-action" className="space-y-4">
                <SubTitle en="3. Action Items" th="3. รายการที่ต้องดำเนินการ" lang={lang} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <FeatureCard lang={lang} icon={<Flag className="h-4 w-4" />} en="Recently Flagged High Risk" th="ตัวอย่างความเสี่ยงสูงใน 7 วันล่าสุด" />
                  <FeatureCard lang={lang} icon={<AlertTriangle className="h-4 w-4" />} en="Urgent Attention Required" th="ตัวอย่างที่ถูก Flag หรือความเสี่ยงสูงยังไม่เสร็จ" />
                  <FeatureCard lang={lang} icon={<Clock className="h-4 w-4" />} en="Samples Stuck in Processing" th="ค้างสถานะ Pending/In Progress เกิน 3 วัน" />
                </div>
              </div>
            </section>

            {/* ══ SAMPLE LIST ══ */}
            <section id="samplelist">
              <SectionTitle en="Sample List" th="รายการตัวอย่าง" icon={<FlaskConical className="h-6 w-6" />} lang={lang} />
              <Divider />

              <div className="space-y-6">
                <Card className="glass-card">
                  <CardContent className="p-6">
                    <Txt
                      lang={lang}
                      en="The Sample List page is the central hub for managing all agricultural samples. You can search, filter, import, export, and drill down into individual sample details and mycotoxin results."
                      th="หน้า Sample List เป็นศูนย์กลางการจัดการตัวอย่างทางการเกษตรทั้งหมด คุณสามารถค้นหา กรอง นำเข้า ส่งออก และดูรายละเอียดตัวอย่างรวมถึงผลไมโคทอกซินแต่ละรายการได้"
                    />
                  </CardContent>
                </Card>

                <div className="grid gap-3 sm:grid-cols-2">
                  <FeatureCard lang={lang} icon={<Search className="h-4 w-4" />} en="Search & Filter" th="ค้นหาและกรองตามสถานะ, พื้นที่, พืช, ความเสี่ยง, วันที่" />
                  <FeatureCard lang={lang} icon={<Upload className="h-4 w-4" />} en="Bulk Import" th="นำเข้าตัวอย่างจำนวนมากจากไฟล์ CSV พร้อมรายงานข้อผิดพลาด" />
                  <FeatureCard lang={lang} icon={<Download className="h-4 w-4" />} en="Export (CSV / XLSX / IDs)" th="ส่งออกทั้งหมด, เฉพาะที่เลือก หรือเฉพาะ ID" />
                  <FeatureCard lang={lang} icon={<FlaskConical className="h-4 w-4" />} en="Mycotoxin Results" th="บันทึกและดูผลไมโคทอกซิน พร้อมสถานะ Detected / <LOD" />
                </div>

                <Card className="glass-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{t('Sample ID Format', 'รูปแบบรหัสตัวอย่าง')}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-3">
                    <Txt
                      lang={lang}
                      en="Sample IDs are auto-generated in the format: {first_letter}-{YYYYMMDD}-{seq}"
                      th="รหัสตัวอย่างถูกสร้างอัตโนมัติในรูปแบบ: {อักษรแรก}-{YYYYMMDD}-{ลำดับ}"
                    />
                    <CodeBlock code={`r-20250424-001   → Rice collected on 2025-04-24, sequence 001\nm-20250424-002   → Maize collected on 2025-04-24, sequence 002`} />
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{t('Sample Status Flow', 'สถานะตัวอย่าง')}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      {[
                        { en: 'Pending', th: 'รอดำเนินการ', color: 'bg-muted text-foreground' },
                        { en: '→', th: '→', color: '' },
                        { en: 'In Progress', th: 'กำลังวิเคราะห์', color: 'bg-warning/10 text-warning' },
                        { en: '→', th: '→', color: '' },
                        { en: 'Completed', th: 'เสร็จสิ้น', color: 'bg-success/10 text-success' },
                        { en: '/', th: '/', color: '' },
                        { en: 'Flagged', th: 'ถูกแจ้งเตือน', color: 'bg-danger/10 text-danger' },
                      ].map((s, i) =>
                        s.color === '' ? (
                          <span key={i} className="text-muted-foreground">{lang === 'en' ? s.en : s.th}</span>
                        ) : (
                          <span key={i} className={cn('px-2 py-1 rounded text-xs font-medium', s.color)}>
                            {lang === 'en' ? s.en : s.th}
                          </span>
                        ),
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* ══ PREDICTION ══ */}
            <section id="prediction">
              <SectionTitle en="Prediction" th="การทำนาย" icon={<TrendingUp className="h-6 w-6" />} lang={lang} />
              <Divider />

              <div className="space-y-4">
                <Card className="glass-card border-dashed">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Coming Soon</Badge>
                      <span className="text-xs text-muted-foreground">{t('Under development', 'กำลังพัฒนา')}</span>
                    </div>
                    <Txt
                      lang={lang}
                      en="The Prediction module will provide AI-powered mycotoxin risk forecasting based on historical sample data, regional patterns, weather correlations, and vegetation variety profiles."
                      th="โมดูล Prediction จะให้การพยากรณ์ความเสี่ยงไมโคทอกซินด้วย AI โดยอิงจากข้อมูลตัวอย่างในอดีต รูปแบบตามภูมิภาค ความสัมพันธ์กับสภาพอากาศ และโปรไฟล์ตามพันธุ์พืช"
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <FeatureCard lang={lang} icon={<TrendingUp className="h-4 w-4" />} en="Risk Forecast by Region" th="พยากรณ์ความเสี่ยงตามพื้นที่" badge="Planned" badgeTh="วางแผนไว้" />
                      <FeatureCard lang={lang} icon={<FlaskConical className="h-4 w-4" />} en="Contamination Trend Analysis" th="วิเคราะห์แนวโน้มการปนเปื้อน" badge="Planned" badgeTh="วางแผนไว้" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* ══ ACCOUNT & PRIVACY ══ */}
            <section id="account">
              <SectionTitle en="Account & Privacy" th="บัญชีและความเป็นส่วนตัว" icon={<UserCog className="h-6 w-6" />} lang={lang} />
              <Divider />

              <div className="space-y-6">
                <Card className="glass-card">
                  <CardContent className="p-6">
                    <Txt
                      lang={lang}
                      en="Each user has a personal profile page where they can update their display name, change email address (with OTP verification), and change their password securely."
                      th="ผู้ใช้แต่ละคนมีหน้าโปรไฟล์ส่วนตัวสำหรับอัปเดตชื่อที่แสดง, เปลี่ยนอีเมล (พร้อมการยืนยัน OTP) และเปลี่ยนรหัสผ่านอย่างปลอดภัย"
                    />
                  </CardContent>
                </Card>

                <div className="grid gap-3 sm:grid-cols-2">
                  <FeatureCard lang={lang} icon={<Mail className="h-4 w-4" />} en="Email Change with OTP" th="เปลี่ยนอีเมลพร้อมยืนยันผ่าน OTP" />
                  <FeatureCard lang={lang} icon={<Lock className="h-4 w-4" />} en="Password Change" th="เปลี่ยนรหัสผ่านโดยต้องยืนยันรหัสผ่านเดิม" />
                  <FeatureCard lang={lang} icon={<Shield className="h-4 w-4" />} en="Google OAuth Login" th="เข้าสู่ระบบด้วย Google Account" />
                  <FeatureCard lang={lang} icon={<UserCog className="h-4 w-4" />} en="Role-based Access" th="สิทธิ์การเข้าถึงตามบทบาทของผู้ใช้" />
                </div>

                <Card className="glass-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{t('Password Reset', 'รีเซ็ตรหัสผ่าน')}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-2">
                    {[
                      { step: '1', en: 'Request OTP via email', th: 'ขอรหัส OTP ผ่านอีเมล' },
                      { step: '2', en: 'Enter the 6-digit OTP code', th: 'กรอกรหัส OTP 6 หลัก' },
                      { step: '3', en: 'Set a new password', th: 'ตั้งรหัสผ่านใหม่' },
                    ].map((s) => (
                      <div key={s.step} className="flex gap-3 items-center text-sm">
                        <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">
                          {s.step}
                        </span>
                        <span className="text-foreground">{lang === 'en' ? s.en : s.th}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" />
                      {t('Privacy', 'ความเป็นส่วนตัว')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <Txt
                      lang={lang}
                      en="AgriScan Pro uses JWT authentication with short-lived access tokens and refresh token rotation. All API calls require a valid token. Passwords are stored using Django's PBKDF2 hashing. Email addresses are verified before changes take effect."
                      th="AgriScan Pro ใช้การยืนยันตัวตนด้วย JWT โดยมี Access Token อายุสั้นและการหมุนเวียน Refresh Token คำขอ API ทั้งหมดต้องใช้ Token ที่ถูกต้อง รหัสผ่านจัดเก็บด้วยการแฮช PBKDF2 ของ Django และต้องยืนยันอีเมลก่อนการเปลี่ยนแปลงจะมีผล"
                    />
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* ══ API ══ */}
            <section id="api">
              <SectionTitle en="API Reference" th="เอกสาร API" icon={<Code2 className="h-6 w-6" />} lang={lang} />
              <Divider />

              <div className="space-y-6">
                <Card className="glass-card">
                  <CardContent className="p-6 space-y-3">
                    <Txt
                      lang={lang}
                      en="All API endpoints are prefixed with /api/. Requests must include a valid Bearer token in the Authorization header (except login and refresh endpoints)."
                      th="Endpoint ของ API ทั้งหมดขึ้นต้นด้วย /api/ คำขอต้องมี Bearer token ที่ถูกต้องในส่วน Authorization header (ยกเว้น endpoint สำหรับล็อกอินและรีเฟรช)"
                    />
                    <CodeBlock code={`Authorization: Bearer <access_token>`} />
                  </CardContent>
                </Card>

                {/* Auth */}
                <Card className="glass-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Key className="h-4 w-4 text-primary" />
                      {t('Authentication', 'การยืนยันตัวตน')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-3">
                    {[
                      { method: 'POST', path: '/api/accounts/login/', en: 'Login', th: 'เข้าสู่ระบบ' },
                      { method: 'POST', path: '/api/accounts/login/refresh/', en: 'Refresh access token', th: 'รีเฟรช token' },
                      { method: 'POST', path: '/api/accounts/logout/', en: 'Logout', th: 'ออกจากระบบ' },
                      { method: 'PATCH', path: '/api/accounts/profile/', en: 'Update profile', th: 'อัปเดตโปรไฟล์' },
                      { method: 'POST', path: '/api/accounts/password-reset/request/', en: 'Request password reset OTP', th: 'ขอรหัส OTP รีเซ็ตรหัสผ่าน' },
                      { method: 'POST', path: '/api/accounts/password-reset/confirm/', en: 'Confirm new password', th: 'ยืนยันรหัสผ่านใหม่' },
                    ].map((e) => (
                      <div key={`${e.method}-${e.path}`} className="flex items-start gap-3 text-xs">
                        <Badge variant={e.method === 'POST' ? 'default' : 'secondary'} className="flex-shrink-0 font-mono text-[10px]">
                          {e.method}
                        </Badge>
                        <code className="text-primary font-mono flex-shrink-0">{e.path}</code>
                        <span className="text-muted-foreground">{lang === 'en' ? e.en : e.th}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Samples */}
                <Card className="glass-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FlaskConical className="h-4 w-4 text-primary" />
                      {t('Samples', 'ตัวอย่าง')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-3">
                    {[
                      { method: 'GET', path: '/api/samples/', en: 'List samples (paginated)', th: 'ดูรายการตัวอย่าง (แบ่งหน้า)' },
                      { method: 'POST', path: '/api/samples/', en: 'Create sample', th: 'สร้างตัวอย่าง' },
                      { method: 'GET', path: '/api/samples/{id}/', en: 'Get sample detail', th: 'ดูรายละเอียดตัวอย่าง' },
                      { method: 'PATCH', path: '/api/samples/{id}/', en: 'Update sample', th: 'อัปเดตตัวอย่าง' },
                      { method: 'DELETE', path: '/api/samples/{id}/', en: 'Delete sample', th: 'ลบตัวอย่าง' },
                      { method: 'POST', path: '/api/samples/bulk_create/', en: 'Bulk create samples', th: 'สร้างตัวอย่างจำนวนมาก' },
                      { method: 'POST', path: '/api/samples/bulk_delete/', en: 'Bulk delete samples', th: 'ลบตัวอย่างจำนวนมาก' },
                      { method: 'POST', path: '/api/samples/bulk_import_results/', en: 'Import results from file', th: 'นำเข้าผลจากไฟล์' },
                      { method: 'GET', path: '/api/samples/statistics/', en: 'System statistics', th: 'สถิติระบบ' },
                      { method: 'GET', path: '/api/samples/recent_alerts/', en: 'Recent risk alerts', th: 'การแจ้งเตือนความเสี่ยงล่าสุด' },
                      { method: 'POST', path: '/api/samples/{id}/add_process_log/', en: 'Add process log', th: 'เพิ่ม log กระบวนการ' },
                      { method: 'POST', path: '/api/samples/{id}/add_mycotoxin_result/', en: 'Add mycotoxin result', th: 'เพิ่มผลไมโคทอกซิน' },
                    ].map((e) => (
                      <div key={`${e.method}-${e.path}`} className="flex items-start gap-3 text-xs">
                        <Badge
                          variant={e.method === 'GET' ? 'secondary' : e.method === 'DELETE' ? 'destructive' : 'default'}
                          className="flex-shrink-0 font-mono text-[10px]"
                        >
                          {e.method}
                        </Badge>
                        <code className="text-primary font-mono flex-shrink-0 break-all">{e.path}</code>
                        <span className="text-muted-foreground">{lang === 'en' ? e.en : e.th}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Export */}
                <Card className="glass-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Download className="h-4 w-4 text-primary" />
                      {t('Export', 'ส่งออกข้อมูล')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-3">
                    {[
                      { method: 'GET', path: '/api/samples/export_samples/', en: 'Export full sample list (CSV/XLSX)', th: 'ส่งออกรายการตัวอย่างทั้งหมด' },
                      { method: 'GET', path: '/api/samples/export_pending_samples/', en: 'Export pending samples only', th: 'ส่งออกเฉพาะตัวอย่างที่รอ' },
                    ].map((e) => (
                      <div key={`${e.method}-${e.path}`} className="flex items-start gap-3 text-xs">
                        <Badge variant="secondary" className="flex-shrink-0 font-mono text-[10px]">{e.method}</Badge>
                        <code className="text-primary font-mono flex-shrink-0 break-all">{e.path}</code>
                        <span className="text-muted-foreground">{lang === 'en' ? e.en : e.th}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Query params */}
                <Card className="glass-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{t('Query Parameters', 'พารามิเตอร์การค้นหา')}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-3">
                    <CodeBlock code={`GET /api/samples/?search=r-2025&status=pending,in_progress&region=North&vegetation=rice&risk_level=high&date_from=2025-01-01&date_to=2025-12-31&page=1&page_size=50`} />
                    <div className="grid gap-2 sm:grid-cols-2 text-xs text-muted-foreground">
                      {[
                        { param: 'search', en: 'Search by sample_id or keyword', th: 'ค้นหาตาม sample_id หรือ keyword' },
                        { param: 'status', en: 'pending, in_progress, completed, flagged', th: 'pending, in_progress, completed, flagged' },
                        { param: 'region', en: 'Filter by region', th: 'กรองตามภูมิภาค' },
                        { param: 'vegetation', en: 'Filter by vegetation variety', th: 'กรองตามพันธุ์พืช' },
                        { param: 'risk_level', en: 'safe, low, medium, high', th: 'safe, low, medium, high' },
                        { param: 'page / page_size', en: 'Pagination', th: 'การแบ่งหน้า' },
                      ].map((p) => (
                        <div key={p.param} className="flex gap-2">
                          <code className="text-primary font-mono flex-shrink-0">{p.param}</code>
                          <span>{lang === 'en' ? p.en : p.th}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>

          </div>
        </div>
      </main>
    </div>
  );
};

export default Doc;
