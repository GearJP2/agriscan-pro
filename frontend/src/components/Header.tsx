import { FlaskConical } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useLayoutEffect, useRef, useState } from "react";

import RoleSwitcher from "./RoleSwitcher";
import ThemeToggle from "./ThemeToggle";
import UserDropdown from "./UserDropdown";
import LoginModal from "./LoginModal";
import { useAuth } from "@/contexts/AuthContext";
import { USER_ROLE_WEIGHT } from "@/types/user";
import { cn } from "@/lib/utils";

const Header = () => {
  const { isAuthenticated, isInitializing, user, role } = useAuth();
  const location = useLocation();
  const navRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const [indicatorStyle, setIndicatorStyle] = useState({
    left: 0,
    width: 0,
    opacity: 0,
  });

  const canSwitchRole =
    !!user &&
    USER_ROLE_WEIGHT[user.role as keyof typeof USER_ROLE_WEIGHT] >=
      USER_ROLE_WEIGHT.research_assistant;

  const links = [
    { to: "/", label: "Homepage", minWeight: 0 },
    { to: "/dashboard", label: "Dashboard", minWeight: 0 },
    {
      to: "/samples",
      label: "Sample List",
      minWeight: USER_ROLE_WEIGHT.research_assistant,
    },
    { to: "/prediction", label: "Prediction", minWeight: 0 },
    { to: "/doc", label: "Documentation", minWeight: 0 },
    {
      to: "/users",
      label: "Users",
      minWeight: USER_ROLE_WEIGHT.researcher,
    },
  ].filter((link) => {
    const currentWeight = isAuthenticated
      ? (USER_ROLE_WEIGHT[role as keyof typeof USER_ROLE_WEIGHT] ?? 0)
      : 0;

    return currentWeight >= link.minWeight;
  });

  useLayoutEffect(() => {
    const activeLink = linkRefs.current.get(location.pathname);
    const nav = navRef.current;

    if (activeLink && nav) {
      const activeRect = activeLink.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();

      setIndicatorStyle({
        left: activeRect.left - navRect.left,
        width: activeRect.width,
        opacity: 1,
      });
    } else {
      setIndicatorStyle((prev) => ({ ...prev, opacity: 0 }));
    }
  }, [location.pathname, isAuthenticated, role]);

  return (
    <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-sm pt-4 pb-2">
      <div className="container flex h-16 items-center">
        <div className="flex items-center gap-3 shrink-0 mr-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-primary">
            <FlaskConical className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="hidden lg:block">
            <h1 className="text-lg font-bold text-foreground">SafeFood</h1>
            <p className="text-xs text-muted-foreground">
              Mycotoxin Tracking System
            </p>
          </div>
        </div>

        <nav className="flex-1 hidden md:flex items-center justify-center">
          <div
            ref={navRef}
            className="flex items-center gap-1 rounded-full bg-secondary/30 backdrop-blur-md px-2 py-1.5 shadow-sm border border-border/50 relative"
          >
            <motion.div
              initial={false}
              animate={{
                left: indicatorStyle.left,
                width: indicatorStyle.width,
                opacity: indicatorStyle.opacity,
              }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 38,
                mass: 1,
              }}
              className="absolute h-[calc(100%-12px)] top-[6px] bg-primary rounded-full shadow-md z-0"
              style={{ pointerEvents: "none" }}
            />

            {links.map((link) => {
              const isActive = location.pathname === link.to;

              return (
                <Link
                  key={link.to}
                  to={link.to}
                  ref={(el) => {
                    if (el) {
                      linkRefs.current.set(link.to, el);
                    } else {
                      linkRefs.current.delete(link.to);
                    }
                  }}
                  className={cn(
                    "relative px-4 py-2 rounded-full text-sm font-medium transition-colors duration-300 z-10",
                    isActive
                      ? "text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="flex items-center gap-2 shrink-0 ml-8">
          <ThemeToggle />
          {!isInitializing &&
            (isAuthenticated ? (
              <>
                {canSwitchRole && <RoleSwitcher />}
                <UserDropdown />
              </>
            ) : (
              <LoginModal />
            ))}
        </div>
      </div>
    </header>
  );
};

export default Header;
