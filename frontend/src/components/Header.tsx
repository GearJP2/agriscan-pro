import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import ThemeToggle from "./ThemeToggle";
import UserDropdown from "./UserDropdown";
import LoginModal from "./LoginModal";
import RoleSwitcher from "./RoleSwitcher";
import { useAuth } from "@/contexts/AuthContext";
import { USER_ROLE_WEIGHT } from "@/types/user";

const Header = () => {
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
    const isHomepage = location.pathname === "/";

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

export default Header;
