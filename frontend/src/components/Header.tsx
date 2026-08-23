import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import ThemeToggle from "./ThemeToggle";
import UserDropdown from "./UserDropdown";
import LoginModal from "./LoginModal";
import RoleSwitcher from "./RoleSwitcher";
import { useAuth } from "@/contexts/AuthContext";
import { USER_ROLE_WEIGHT } from "@/types/user";
import { useLanguage } from "@/contexts/LanguageContext";

const Header = () => {
    const { isAuthenticated, isInitializing, user, role, canAccessMonitor } = useAuth();
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);
    const { language, setLanguage } = useLanguage();

    const canSwitchRole =
        !!user &&
        USER_ROLE_WEIGHT[user.role as keyof typeof USER_ROLE_WEIGHT] >=
        USER_ROLE_WEIGHT.research_assistant;

    const labels = language === "th" ? ["หน้าแรก", "เกี่ยวกับเรา", "แดชบอร์ด", "โครงการ", "ผลงานตีพิมพ์", "ข่าวสาร", "พันธมิตรและเครือข่าย", "ติดต่อ", "รายการตัวอย่าง", "ผู้ใช้", "จัดการเนื้อหา"] : ["Home", "About Us", "Dashboard", "Projects", "Publications", "News", "Partners & Networks", "Contact", "Sample List", "Users", "Manage content"];
    const links = [
        { href: "/", label: labels[0], minWeight: 0 }, { href: "/about", label: labels[1], minWeight: 0 }, { href: "/dashboard", label: labels[2], minWeight: 0 }, { href: "/projects", label: labels[3], minWeight: 0 }, { href: "/publications", label: labels[4], minWeight: 0 }, { href: "/news", label: labels[5], minWeight: 0 }, { href: "/partners", label: labels[6], minWeight: 0 }, { href: "/contact", label: labels[7], minWeight: 0 }, { href: "/samples", label: labels[8], minWeight: USER_ROLE_WEIGHT.research_assistant }, { href: "/users", label: labels[9], minWeight: USER_ROLE_WEIGHT.researcher }, { href: "/manage", label: labels[10], minWeight: USER_ROLE_WEIGHT.admin },
    ].filter((link) => {
        const currentWeight = isAuthenticated
            ? (USER_ROLE_WEIGHT[role as keyof typeof USER_ROLE_WEIGHT] ?? 0)
            : 0;

        return currentWeight >= link.minWeight;
    });

    // Add external Monitor link if allowed
    if (canAccessMonitor) {
        links.push({
            href: import.meta.env.VITE_MONITOR_URL,
            label: "Monitor",
            minWeight: 0,
            isExternal: true
        } as any);
    }

    const isDashboard = location.pathname === "/dashboard";
    const isHomepage = location.pathname === "/";

    return (
        <nav className={cn(
            "coe-header",
            "fixed top-0 left-0 w-full z-50 border-b border-[#17382d]/10 bg-[#fafaf7]/95 backdrop-blur-md",
            isDashboard && "dark:border-slate-800"
        )}>
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
                <Link to="/" className="flex items-center gap-3 text-[#17382d] dark:text-white">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#17382d] text-xs font-bold text-[#e5c987]">A</span>
                    <span className="text-lg font-semibold tracking-[-0.04em]">Website <span className="text-[#9a6b37]">CoE-GFS</span></span>
                </Link>

                <div className="hidden xl:flex items-center gap-5 text-[12px] font-semibold text-[#365247] dark:text-slate-300">
                    {links.map((link: any) => {
                        const isActive = location.pathname === link.href;

                        if (link.isExternal) {
                            return (
                                <a
                                    key={link.href}
                                    href={link.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="transition-colors hover:text-[#9a6b37] flex items-center gap-1"
                                >
                                    {link.label}
                                    <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                                </a>
                            );
                        }

                        return (
                            <Link
                                key={link.href}
                                to={link.href}
                                className={cn(
                                    "transition-colors hover:text-[#9a6b37]",
                                    isActive && "text-[#17382d] dark:text-white"
                                )}
                            >
                                {link.label}
                            </Link>
                        );
                    })}
                </div>

                <div className="flex items-center gap-2">
                    <ThemeToggle />
                    {!isInitializing && (
                        isAuthenticated ? (
                            <div className="flex items-center gap-2">
                                {canSwitchRole && <RoleSwitcher />}
                                <UserDropdown />
                            </div>
                        ) : (
                            <LoginModal />
                        )
                    )}
                    <div className="hidden items-center gap-1 text-xs font-semibold sm:flex"><button onClick={() => setLanguage("en")} className={language === "en" ? "text-[#e5c987]" : "text-white/65 hover:text-white"}>EN</button><span className="text-white/35">|</span><button onClick={() => setLanguage("th")} className={language === "th" ? "text-[#e5c987]" : "text-white/65 hover:text-white"}>TH</button></div>
                    <button onClick={() => setMobileOpen(!mobileOpen)} className="rounded-full p-2 text-[#17382d] xl:hidden dark:text-white" aria-label="Toggle navigation">
                        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </button>
                </div>
            </div>
            {mobileOpen && <div className="border-t border-[#17382d]/10 bg-[#fafaf7] px-6 py-4 xl:hidden dark:bg-slate-950">
                <div className="grid gap-3 text-sm font-semibold text-[#365247] dark:text-slate-300">{links.map((link: any) => link.isExternal ? <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a> : <Link key={link.href} to={link.href} onClick={() => setMobileOpen(false)}>{link.label}</Link>)}</div>
            </div>}
        </nav>
    );
};

export default Header;
