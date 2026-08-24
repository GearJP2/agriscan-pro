import { Link } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { isPublicSitePath } from "@/lib/siteRoutes";

const AppFooter = () => (
    <footer className="w-full border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 py-8 mt-auto z-40 relative">
        <div className="max-w-7xl mx-auto px-6 flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="font-sans text-sm text-slate-500 dark:text-slate-400">© 2025 AgriScan Pro. All rights reserved.</p>
            <div className="flex gap-6 font-sans text-sm text-slate-500 dark:text-slate-400">
                <Link className="hover:text-primary transition-colors" to="/doc">Terms</Link>
                <Link className="hover:text-primary transition-colors" to="/doc">Privacy</Link>
                <Link className="hover:text-primary transition-colors" to="/doc">Contact</Link>
            </div>
        </div>
    </footer>
);

const CoeFooter = () => {
    const { language } = useLanguage();
    const t = language === "th"
        ? {
            tagline: "แพลตฟอร์มวิจัยเพื่อระบบอาหารที่ปลอดภัยและยั่งยืน",
            platform: "แพลตฟอร์ม", research: "งานวิจัย",
            dashboard: "แดชบอร์ด", predictions: "การคาดการณ์", samples: "รายการตัวอย่าง",
            documentation: "เอกสาร", contact: "ติดต่อ",
            rights: "สงวนลิขสิทธิ์",
        }
        : {
            tagline: "A research platform for safer food systems, stronger evidence, and earlier action.",
            platform: "Platform", research: "Research",
            dashboard: "Dashboard", predictions: "Predictions", samples: "Sample records",
            documentation: "Documentation", contact: "Contact",
            rights: "All rights reserved.",
        };

    return (
        <footer className="coe-gfs mt-auto bg-gfs-maroon px-6 py-12 text-white lg:px-8">
            <div className="mx-auto grid max-w-[1280px] gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
                <div>
                    <Link to="/" className="text-xl font-bold tracking-tight text-white">
                        CoE<span className="text-gfs-gold">-</span>GFS
                    </Link>
                    <p className="mt-4 max-w-sm text-sm leading-6 font-medium text-white/90">{t.tagline}</p>
                </div>
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-gfs-gold">{t.platform}</p>
                    <div className="mt-4 grid gap-2 text-sm font-medium text-white/85">
                        <Link to="/dashboard" className="transition-colors hover:text-gfs-gold">{t.dashboard}</Link>
                        <Link to="/prediction" className="transition-colors hover:text-gfs-gold">{t.predictions}</Link>
                        <Link to="/samples" className="transition-colors hover:text-gfs-gold">{t.samples}</Link>
                    </div>
                </div>
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-gfs-gold">{t.research}</p>
                    <div className="mt-4 grid gap-2 text-sm font-medium text-white/85">
                        <Link to="/doc" className="transition-colors hover:text-gfs-gold">{t.documentation}</Link>
                        <Link to="/contact" className="transition-colors hover:text-gfs-gold">{t.contact}</Link>
                    </div>
                </div>
            </div>
            <div className="mx-auto mt-10 max-w-[1280px] border-t border-white/25 pt-5 text-xs font-medium text-white/80">
                © 2026 Center of Excellence in Global Food Security, Thammasat University. {t.rights}
            </div>
        </footer>
    );
};

const Footer = () => {
    const location = useLocation();
    return isPublicSitePath(location.pathname) ? <CoeFooter /> : <AppFooter />;
};

export default Footer;
