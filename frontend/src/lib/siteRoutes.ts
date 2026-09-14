/**
 * Public CoE-GFS site routes. These paths render the maroon/gold
 * Design.md presentation layer; everything else keeps the AgriScan app shell.
 */
export const COE_PUBLIC_PAGES = [
  "/",
  "/about",
  "/dashboard",
  "/projects",
  "/publications",
  "/news",
  "/partners",
  "/contact",
  "/doc",
  "/samples",
  "/users",
  "/prediction",
  "/manage",
] as const;

export type CoePublicPage = (typeof COE_PUBLIC_PAGES)[number];

export function isPublicSitePath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return (COE_PUBLIC_PAGES as readonly string[]).some(
    (route) => normalized === route || normalized.startsWith(`${route}/`),
  );
}
