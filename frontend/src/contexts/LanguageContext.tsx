import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type SiteLanguage = "en" | "th";

type LanguageContextValue = { language: SiteLanguage; setLanguage: (language: SiteLanguage) => void };
const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<SiteLanguage>(() => localStorage.getItem("agriscan-language") === "th" ? "th" : "en");

  useEffect(() => {
    localStorage.setItem("agriscan-language", language);
    document.documentElement.lang = language;
  }, [language]);

  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
