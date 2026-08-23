import { Link, useLocation } from "react-router-dom";
import { ChevronDown, Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import ThemeToggle from "./ThemeToggle";
import UserDropdown from "./UserDropdown";
import LoginModal from "./LoginModal";
import RoleSwitcher from "./RoleSwitcher";
import { useAuth } from "@/contexts/AuthContext";
import { USER_ROLE_WEIGHT } from "@/types/user";
import { useLanguage } from "@/contexts/LanguageContext";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Header = () => {
    const { isAuthenticated, isInitializing, user, role, canAccessMonitor } = useAuth();
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);
    const { language, setLanguage } = useLanguage();

    const canSwitchRole =
        !!user &&
        USER_ROLE_WEIGHT[user.role as keyof typeof USER_ROLE_WEIGHT] >=
        USER_ROLE_WEIGHT.research_assistant;

    const labels = language === "th" ? ["หน้าแรก", "เกี่ยวกับเรา", "แดชบอร์ด", "โครงการ", "ผลงานตีพิมพ์", "ข่าวสาร", "พันธมิตรและเครือข่าย", "ติดต่อ", "การคาดการณ์", "รายการตัวอย่าง", "ผู้ใช้", "จัดการเนื้อหา", "เครื่องมือวิจัย"] : ["Home", "About Us", "Dashboard", "Projects", "Publications", "News", "Partners & Networks", "Contact", "Predictions", "Sample List", "Users", "Manage content", "Research tools"];
    const currentWeight = isAuthenticated ? (USER_ROLE_WEIGHT[role as keyof typeof USER_ROLE_WEIGHT] ?? 0) : 0;
    const publicLinks = [
        { href: "/", label: labels[0] }, { href: "/about", label: labels[1] }, { href: "/dashboard", label: labels[2] }, { href: "/projects", label: labels[3] }, { href: "/publications", label: labels[4] }, { href: "/news", label: labels[5] }, { href: "/partners", label: labels[6] }, { href: "/contact", label: labels[7] },
    ];
    const toolLinks: Array<{ href: string; label: string; minWeight: number; isExternal?: boolean }> = [
        { href: "/prediction", label: labels[8], minWeight: USER_ROLE_WEIGHT.research_assistant },
        { href: "/samples", label: labels[9], minWeight: USER_ROLE_WEIGHT.research_assistant },
        { href: "/users", label: labels[10], minWeight: USER_ROLE_WEIGHT.researcher },
        { href: "/manage", label: labels[11], minWeight: USER_ROLE_WEIGHT.admin },
    ].filter((link) => currentWeight >= link.minWeight);

    // Add external Monitor link if allowed
    if (canAccessMonitor) {
        toolLinks.push({
            href: import.meta.env.VITE_MONITOR_URL,
            label: "Monitor",
            minWeight: 0,
            isExternal: true
        });
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
                    {publicLinks.map((link: any) => {
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
                    {toolLinks.length > 0 && <DropdownMenu>
                        <DropdownMenuTrigger className="flex items-center gap-1 transition-colors hover:text-[#e5c987]">{labels[12]} <ChevronDown className="h-3.5 w-3.5" /></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-48 border-[#e5dfd2] bg-white p-1 text-[#2a3142] shadow-xl">
                            {toolLinks.map((link: any) => <DropdownMenuItem key={link.href} asChild className="cursor-pointer rounded-md focus:bg-[#faf5ec] focus:text-[#9F1D20]">
                                {link.isExternal ? <a href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a> : <Link to={link.href}>{link.label}</Link>}
                            </DropdownMenuItem>)}
                        </DropdownMenuContent>
                    </DropdownMenu>}
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
                <div className="grid gap-3 text-sm font-semibold text-[#365247] dark:text-slate-300">{publicLinks.map((link: any) => <Link key={link.href} to={link.href} onClick={() => setMobileOpen(false)}>{link.label}</Link>)}{toolLinks.length > 0 && <p className="mt-2 text-xs uppercase tracking-[.12em] text-[#e5c987]">{labels[12]}</p>}{toolLinks.map((link: any) => link.isExternal ? <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a> : <Link key={link.href} to={link.href} onClick={() => setMobileOpen(false)}>{link.label}</Link>)}</div>
            </div>}
        </nav>
    );
};

export default Header;
