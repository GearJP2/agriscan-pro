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
] as const;

export type CoePublicPage = (typeof COE_PUBLIC_PAGES)[number];

export function isPublicSitePath(pathname: string): boolean {
  return (COE_PUBLIC_PAGES as readonly string[]).includes(pathname);
}
