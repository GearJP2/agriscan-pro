import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import ThemeToggle from "./ThemeToggle";
import UserDropdown from "./UserDropdown";
import LoginModal from "./LoginModal";
import RoleSwitcher from "./RoleSwitcher";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { USER_ROLE_WEIGHT } from "@/types/user";
import { isPublicSitePath } from "@/lib/siteRoutes";

type NavLinkItem = {
    href: string;
    label: string;
    minWeight?: number;
    isExternal?: boolean;
};

const AppHeader = () => {
    const { isAuthenticated, isInitializing, user, role, canAccessMonitor } = useAuth();
    const location = useLocation();

    const canSwitchRole =
        !!user &&
        USER_ROLE_WEIGHT[user.role as keyof typeof USER_ROLE_WEIGHT] >=
        USER_ROLE_WEIGHT.research_assistant;

    const links = [
        { href: "/", label: "Homepage", minWeight: 0 },
        { href: "/dashboard", label: "Dashboard", minWeight: 0 },
        {
            href: "/samples",
            label: "Sample List",
            minWeight: USER_ROLE_WEIGHT.research_assistant,
        },
        { href: "/prediction", label: "Prediction", minWeight: 0 },
        { href: "/doc", label: "Documentation", minWeight: 0 },
        {
            href: "/users",
            label: "Users",
            minWeight: USER_ROLE_WEIGHT.researcher,
        },
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

    return (
        <nav className={cn(
            "fixed top-4 left-1/2 -translate-x-1/2 w-full z-50 transition-all duration-700 ease-in-out",
            isDashboard ? "max-w-[1920px] px-4 sm:px-6 lg:px-8" : "max-w-container-max px-gutter"
        )}>
            <div className="w-full rounded-2xl border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl flex justify-between items-center px-8 py-4">
                <Link to="/" className="text-xl font-bold tracking-tighter text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: '"FILL" 1' }}>biotech</span>
                    AgriScan Pro
                </Link>

                <div className="hidden md:flex items-center gap-6 font-sans text-[13px] font-bold tracking-tight nav-container">
                    {links.map((link: any) => {
                        const isActive = location.pathname === link.href;

                        if (link.isExternal) {
                            return (
                                <a
                                    key={link.href}
                                    href={link.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="nav-link transition-all duration-300 relative group font-bold flex items-center gap-1"
                                >
                                    {link.label}
                                    <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                                    <span className="underline-span" />
                                </a>
                            );
                        }

                        return (
                            <Link
                                key={link.href}
                                to={link.href}
                                className={cn(
                                    "nav-link transition-all duration-300 relative group font-bold",
                                    isActive && "nav-link-active"
                                )}
                            >
                                {link.label}
                                <span className="underline-span" />
                            </Link>
                        );
                    })}
                </div>

                <div className="flex items-center gap-4">
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
                </div>
            </div>
        </nav>
    );
};

const CoeHeader = () => {
    const location = useLocation();
    const { isAuthenticated, isInitializing, user, role, canAccessMonitor } = useAuth();
    const { language, setLanguage } = useLanguage();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [toolsOpen, setToolsOpen] = useState(false);

    const t = language === "th"
        ? {
            home: "หน้าแรก", about: "เกี่ยวกับเรา", dashboard: "แดชบอร์ด",
            projects: "โครงการวิจัย", publications: "ผลงานตีพิมพ์", news: "ข่าวสาร",
            partners: "พันธมิตรและเครือข่าย", contact: "ติดต่อ", tools: "เครื่องมือวิจัย",
            predictions: "การคาดการณ์", samples: "รายการตัวอย่าง", users: "ผู้ใช้",
            manage: "จัดการเนื้อหา", skip: "ข้ามไปยังเนื้อหา",
        }
        : {
            home: "Home", about: "About Us", dashboard: "Dashboard",
            projects: "Projects", publications: "Publications", news: "News",
            partners: "Partners & Networks", contact: "Contact", tools: "Research tools",
            predictions: "Predictions", samples: "Sample List", users: "Users",
            manage: "Manage content", skip: "Skip to content",
        };

    const currentWeight = isAuthenticated
        ? (USER_ROLE_WEIGHT[role as keyof typeof USER_ROLE_WEIGHT] ?? 0)
        : 0;

    const canSwitchRole =
        !!user &&
        USER_ROLE_WEIGHT[user.role as keyof typeof USER_ROLE_WEIGHT] >=
        USER_ROLE_WEIGHT.research_assistant;

    const publicLinks: NavLinkItem[] = [
        { href: "/", label: t.home },
        { href: "/about", label: t.about },
        { href: "/dashboard", label: t.dashboard },
        { href: "/projects", label: t.projects },
        { href: "/publications", label: t.publications },
        { href: "/news", label: t.news },
        { href: "/partners", label: t.partners },
        { href: "/contact", label: t.contact },
    ];

    const toolLinks: NavLinkItem[] = [
        { href: "/prediction", label: t.predictions, minWeight: USER_ROLE_WEIGHT.research_assistant },
        { href: "/samples", label: t.samples, minWeight: USER_ROLE_WEIGHT.research_assistant },
        { href: "/users", label: t.users, minWeight: USER_ROLE_WEIGHT.researcher },
        { href: "/manage", label: t.manage, minWeight: USER_ROLE_WEIGHT.admin },
    ].filter((link) => currentWeight >= (link.minWeight ?? 0));

    if (canAccessMonitor) {
        toolLinks.push({
            href: import.meta.env.VITE_MONITOR_URL as string,
            label: "Monitor",
            isExternal: true,
        });
    }

    const isActivePath = (href: string) =>
        href === "/" ? location.pathname === "/" : location.pathname.startsWith(href);

    const closeMobile = () => setMobileOpen(false);

    const navLinkClass = (href: string) =>
        cn(
            "border-b-2 pb-0.5 text-[1.02rem] font-semibold text-gfs-maroon transition-colors hover:text-gfs-maroon-hover",
            isActivePath(href) ? "border-gfs-gold" : "border-transparent hover:border-gfs-gold",
        );

    const renderLink = (link: NavLinkItem, extraClass?: string) => {
        if (link.isExternal) {
            return (
                <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className={extraClass}>
                    {link.label}
                </a>
            );
        }
        return (
            <Link key={link.href} to={link.href} className={extraClass}>
                {link.label}
            </Link>
        );
    };

    return (
        <nav className="coe-gfs fixed inset-x-0 top-0 z-[99999] border-b-4 border-gfs-gold bg-gfs-canvas shadow-gfs-header">
            <a href="#main-content" className="skip-link">{t.skip}</a>
            <div className="mx-auto flex h-[70px] max-w-[1280px] items-center justify-between gap-4 px-4 lg:h-[140px] lg:gap-8 lg:px-8">
                <Link to="/" onClick={closeMobile} className="flex shrink-0 items-center gap-3">
                    <img
                        src="/Emblem_of_Thammasat_University.svg.png"
                        alt="Thammasat University emblem"
                        className="h-[42px] w-auto lg:h-[96px]"
                    />
                    <span className="flex flex-col leading-tight">
                        <span className="text-base font-bold tracking-tight text-gfs-maroon lg:text-xl">CoE-GFS</span>
                        <span className="hidden text-xs font-semibold text-gfs-text-muted sm:block">
                            Thammasat University
                        </span>
                    </span>
                </Link>

                <div className="hidden items-center gap-6 xl:gap-7 lg:flex">
                    {publicLinks.map((link) =>
                        link.isExternal ? renderLink(link) : (
                            <Link key={link.href} to={link.href} className={navLinkClass(link.href)}>
                                {link.label}
                            </Link>
                        )
                    )}
                    {toolLinks.length > 0 && (
                        <div
                            className="relative"
                            onMouseEnter={() => setToolsOpen(true)}
                            onMouseLeave={() => setToolsOpen(false)}
                        >
                            <button
                                type="button"
                                onClick={() => setToolsOpen((open) => !open)}
                                aria-haspopup="menu"
                                aria-expanded={toolsOpen}
                                className={cn(
                                    "flex items-center gap-1 border-b-2 pb-0.5 text-[1.02rem] font-semibold text-gfs-maroon transition-colors hover:text-gfs-maroon-hover",
                                    toolsOpen ? "border-gfs-gold" : "border-transparent",
                                )}
                            >
                                {t.tools}
                                <ChevronDown className={cn("h-4 w-4 transition-transform", toolsOpen && "rotate-180")} />
                            </button>
                            {toolsOpen && (
                                <div className="absolute right-0 top-full w-52 rounded-gfs-card border border-gfs-maroon/10 bg-gfs-surface py-2 shadow-gfs-card">
                                    {toolLinks.map((link) =>
                                        link.isExternal ? (
                                            <a
                                                key={link.href}
                                                href={link.href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block px-4 py-2 text-sm font-semibold text-gfs-maroon transition-colors hover:bg-gfs-maroon/tint"
                                            >
                                                {link.label}
                                            </a>
                                        ) : (
                                            <Link
                                                key={link.href}
                                                to={link.href}
                                                onClick={() => setToolsOpen(false)}
                                                className="block px-4 py-2 text-sm font-semibold text-gfs-maroon transition-colors hover:bg-gfs-maroon/tint"
                                            >
                                                {link.label}
                                            </Link>
                                        )
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <div className="coe-lang-switch hidden sm:inline-flex">
                        <button type="button" data-active={language === "th"} onClick={() => setLanguage("th")}>TH</button>
                        <button type="button" data-active={language === "en"} onClick={() => setLanguage("en")}>EN</button>
                    </div>
                    {!isInitializing && (
                        isAuthenticated ? (
                            <div className="hidden items-center gap-2 lg:flex">
                                {canSwitchRole && <RoleSwitcher />}
                                <UserDropdown />
                            </div>
                        ) : (
                            <LoginModal />
                        )
                    )}
                    <button
                        type="button"
                        aria-label="Toggle menu"
                        aria-expanded={mobileOpen}
                        onClick={() => setMobileOpen((open) => !open)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-gfs-pill text-gfs-maroon transition-colors hover:bg-gfs-maroon/tint lg:hidden"
                    >
                        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </button>
                </div>
            </div>

            {mobileOpen && (
                <div className="border-t border-gfs-maroon/10 bg-gfs-canvas px-4 pb-6 pt-3 lg:hidden">
                    <div className="flex flex-col divide-y divide-gfs-maroon/10">
                        {publicLinks.map((link) => (
                            <div key={link.href} className="py-2">
                                {renderLink(
                                    link,
                                    cn(
                                        "block py-1.5 text-base font-semibold text-gfs-maroon",
                                        isActivePath(link.href) && "text-gfs-maroon-hover underline decoration-gfs-gold decoration-2 underline-offset-4",
                                    ),
                                )}
                            </div>
                        ))}
                        {toolLinks.length > 0 && (
                            <>
                                <p className="pt-3 text-xs font-bold uppercase tracking-[0.05em] text-gfs-maroon">{t.tools}</p>
                                {toolLinks.map((link) => (
                                    <div key={link.href} className="py-2">
                                        {renderLink(
                                            link,
                                            "block py-1.5 text-base font-semibold text-gfs-maroon",
                                        )}
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                        <div className="coe-lang-switch">
                            <button type="button" data-active={language === "th"} onClick={() => setLanguage("th")}>TH</button>
                            <button type="button" data-active={language === "en"} onClick={() => setLanguage("en")}>EN</button>
                        </div>
                        {!isInitializing && isAuthenticated && canSwitchRole && <RoleSwitcher />}
                        {!isInitializing && isAuthenticated && <UserDropdown />}
                        {!isInitializing && !isAuthenticated && <LoginModal />}
                    </div>
                </div>
            )}
        </nav>
    );
};

const Header = () => {
    const location = useLocation();
    return isPublicSitePath(location.pathname) ? <CoeHeader /> : <AppHeader />;
};

export default Header;
