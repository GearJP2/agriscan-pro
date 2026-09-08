# Design System Specification: Center of Excellence in Global Food Security (CoE-GFS)

This document provides a comprehensive, production-grade design system specification extracted from the official web portal of the Center of Excellence in Global Food Security (CoE-GFS), Faculty of Science and Technology, Thammasat University (https://gfs.sci.tu.ac.th/).

---

## 1. Design Principles & Brand Architecture

The visual identity combines academic authority, institutional heritage, and modern scientific clarity.

* Institutional Authority: Utilizes the official Thammasat University dual-color identity (Crimson Maroon and Gold Yellow) to convey academic credibility and national leadership.
* Scientific Clarity: Employs a warm cream background canvas and pure white content surfaces to maximize readability and distinguish data-dense sections without visual fatigue.
* Structural Balance: Employs symmetrical split layouts (50/50 grid systems), strict content-clamp boundaries, and pill-shaped interactive components to achieve modern ergonomics.
* Responsive Hierarchy: Adheres to a mobile-first responsive breakdown with explicit viewport transitions at 1200px, 1024px, 900px, and 600px.

---

## 2. Color System & Design Tokens

### 2.1 Primary & Accent Palette

| Token Name | Hex Code | RGB / HSL Equivalent | Usage Context |
| :--- | :--- | :--- | :--- |
| `color-primary-maroon` | `#7a1f1f` | `rgb(122, 31, 31)` | Primary brand color, header navigation links, section titles, stats background bar, primary solid buttons |
| `color-primary-dark` | `#a51931` | `rgb(165, 25, 49)` | Deep crimson tone used in secondary brand accents and active national badge states |
| `color-primary-hover` | `#a52a2a` | `rgb(165, 42, 42)` | Interactive hover state for links and navigation items |
| `color-primary-active` | `#b71c1c` | `rgb(183, 28, 28)` | Modal close hover, high-intensity call-to-action state |
| `color-accent-gold` | `#FFC72C` | `rgb(255, 199, 44)` | Primary accent: 4px header bottom line, KPI counters, active language badge, date pills |

### 2.2 Surface & Canvas Palette

| Token Name | Hex Code | Usage Context |
| :--- | :--- | :--- |
| `color-bg-canvas` | `#fdf7ef` | Global warm canvas background, header background, alternating content sections, mobile drawer |
| `color-bg-surface` | `#ffffff` | Primary card surfaces, white section alternates, input backgrounds |
| `color-bg-thumbnail` | `#f0e8dc` | Placeholder and bounding background for image thumbnails |
| `color-bg-tint-maroon` | `rgba(122, 31, 31, 0.08)` | Language switcher pill container background, subtle callout surfaces |
| `color-bg-tint-hover` | `rgba(122, 31, 31, 0.12)` | Subtle hover background for pill components |
| `color-overlay-dark` | `rgba(0, 0, 0, 0.78)` | Fullscreen modal overlay backdrop, video overlay mask |

### 2.3 Typography & Foreground Palette

| Token Name | Hex Code | Usage Context |
| :--- | :--- | :--- |
| `color-text-brand` | `#7a1f1f` | High-emphasis headings (H1, H2, H3), card titles, navigation items |
| `color-text-primary` | `#313131` | High-contrast standard body headings and dark text |
| `color-text-secondary` | `#444444` | Paragraph text, article excerpts, general descriptions |
| `color-text-muted` | `#666666` | Metadata, secondary labels, auxiliary timestamps |
| `color-text-inverse` | `#ffffff` | Text rendered on dark maroon backgrounds, active buttons, stats labels |

### 2.4 Border & Elevation Tokens

| Token Name | Value | Usage Context |
| :--- | :--- | :--- |
| `border-header-bottom` | `4px solid #FFC72C` | Defining bottom border for fixed site header |
| `border-subtle-maroon` | `1.5px solid rgba(122, 31, 31, 0.25)` | Pill button borders, language switcher boundary |
| `border-divider` | `1px solid rgba(122, 31, 31, 0.12)` | Mobile drawer list item dividers, column separators |
| `radius-card` | `14px` | Standard content card corner radius |
| `radius-pill` | `9999px` | Buttons, badges, language switchers, date indicators |
| `radius-modal` | `8px` | Announcement modal image corner radius |
| `shadow-header` | `0 2px 12px rgba(0, 0, 0, 0.08)` | Header elevation |
| `shadow-card` | `0 4px 14px rgba(0, 0, 0, 0.08)` | Default card elevation |
| `shadow-modal` | `0 12px 50px rgba(0, 0, 0, 0.45)` | Modal container elevation |

---

## 3. Typography Hierarchy

### 3.1 Font Stack
* Latin / English: Inter, Plus Jakarta Sans, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif.
* Thai Script: Sarabun, Kanit, Prompt, "Noto Sans Thai", sans-serif.

### 3.2 Type Scale Specifications

| Level | Size | Weight | Line Height | Letter Spacing | Color |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Hero Display H1 | `2.25rem - 3.00rem` | 700 (Bold) | 1.20 | `-0.02em` | `#7a1f1f` / `#313131` |
| Section Heading H2 | `1.60rem - 2.00rem` | 700 (Bold) | 1.30 | `-0.01em` | `#7a1f1f` |
| Subsection Title H3 | `1.20rem - 1.40rem` | 600 (SemiBold) | 1.35 | `0` | `#7a1f1f` |
| Card Title | `0.92rem` | 700 (Bold) | 1.35 | `0` | `#7a1f1f` |
| Header Nav Link | `1.08rem` | 600 (SemiBold) | 1.00 | `0` | `#7a1f1f` |
| Body Text | `0.90rem - 1.00rem` | 400 (Regular) | 1.60 | `0` | `#444444` |
| Card Excerpt | `0.78rem` | 400 (Regular) | 1.45 | `0` | `#444444` |
| Stat Number | `2.50rem - 3.50rem` | 800 (ExtraBold) | 1.00 | `-0.03em` | `#FFC72C` |
| Metadata / Date Pill | `0.72rem` | 700 (Bold) | 1.00 | `0.02em` | `#7a1f1f` |
| Eyebrow / Overline | `0.75rem - 0.85rem` | 700 (Bold) | 1.00 | `0.05em` | `#7a1f1f` / `#a52a2a` |

---

## 4. Layout & Grid Architecture

### 4.1 Page Shell Dimensions
* Desktop Header Height: `140px` (Body top padding: `140px` to prevent layout shift).
* Mobile Header Height: `70px` (Body top padding: `70px`).
* Content Container Max Width: `1280px` standard (with `100%` width utility on fluid sections).
* Container Horizontal Padding: `24px - 32px` on desktop, `16px` on mobile.

### 4.2 Grid Breakpoints

| Breakpoint Name | Viewport Range | Grid / Layout Adaptation |
| :--- | :--- | :--- |
| `desktop-xl` | `>= 1201px` | Full dual 50/50 section, 3-card columns per side |
| `desktop-lg` | `1025px - 1200px` | Dual section active, 2-card columns per side |
| `tablet-md` | `901px - 1024px` | Header converts to hamburger drawer, navigation collapes |
| `mobile-sm` | `601px - 900px` | 50/50 dual sections stack vertically (100% width each), 1-card column |
| `mobile-xs` | `<= 600px` | Header flex-wraps, language pill moves to secondary line, compact modals |

---

## 5. Structural Components & Wireframes

### 5.1 Fixed Site Header
* Placement: `position: fixed; top: 0; left: 0; right: 0; z-index: 99999;`
* Background: `#fdf7ef`
* Bottom Border: `4px solid #FFC72C`
* Layout: Flexbox with `space-between` alignment:
  * Left: Organization Logo (max-height `120px` desktop, `54px` mobile).
  * Center/Right: Primary navigation list (`gap: 24px`). Links feature a `2px solid transparent` bottom border that transitions to `#FFC72C` on hover/active states.
  * Far Right: TH/EN Language Pill Switcher (`.coe-lang-switch`).

### 5.2 Hero Banner with Overlay Card
* Background Container: `aspect-ratio: 16 / 9; max-height: 90vh; background: #000; overflow: hidden; position: relative;`
* Video Element: Autoplay, loop, muted, `object-fit: contain; object-position: center; filter: brightness(1) saturate(1.15) contrast(1.05);`
* Overlay Card: Left-aligned floating panel containing:
  * Eyebrow: Institutional origin indicator.
  * Title: Primary H1 in brand typography.
  * Description: Multi-line mission statement.
  * Action Bar: Dual CTA button group (`.btn-pill-primary` and `.btn-pill-outline`).

### 5.3 3-Column Highlights Row
* Layout: 3-column CSS Grid (`grid-template-columns: repeat(3, 1fr)`).
* Items: Minimalist icon containers (`24x24` SVG stroke icons in `#7a1f1f`), followed by H3 title and concise structural description.

### 5.4 High-Impact Institutional Stats Counter Bar
* Background: Full-width solid `#7a1f1f`.
* Padding: `48px 0`.
* Grid: 5-column symmetrical layout.
* Metrics:
  * Number: Font size `2.5rem - 3.5rem`, color `#FFC72C`, font weight `800`.
  * Label: Font size `0.95rem`, color `#ffffff`, text-align `center`.

### 5.5 News and Research Projects Split Section
* Layout: Two parallel columns (50% News / 50% Projects), `gap: 32px`.
* Carousel / Multi-item Grid: 3 cards per view on wide desktop (`repeat(3, 1fr)`).
* Card Component Specs:
  * Height: Fixed `480px` (`max-height: 480px`).
  * Radius: `14px`.
  * Background: `#ffffff`.
  * Shadow: `0 4px 14px rgba(0, 0, 0, 0.08)`.
  * Thumbnail: Fixed `200px` height, `overflow: hidden`, image with `object-fit: cover`.
  * Date Pill: Inset badge with background `#FFC72C`, text `#7a1f1f`, padding `4px 10px`, radius `9999px`.
  * Title: Restricted to 2 lines (`-webkit-line-clamp: 2; overflow: hidden; min-height: 2.5em;`).
  * Excerpt: Restricted to 3 lines (`-webkit-line-clamp: 3; overflow: hidden; color: #444444;`).

### 5.6 Global Partnership & Network Module
* Partner Wall: Clean banner image containing international funding agency and consortium insignias.
* International Grid: 8-box grid showcasing partner nations (Thailand, USA, UK, Italy, Austria, China, Japan, Singapore) with national indicators and affiliated universities/laboratories.

### 5.7 Fullscreen Announcement Modal
* Backdrop: `position: fixed; inset: 0; background: rgba(0, 0, 0, 0.78); z-index: 9999998;`
* Dialog Box: Max width `min(92vw, 900px)`, max height `92vh`, centered flex.
* Close Button: Positioned absolute top-right (`top: -14px; right: -14px`), circular (`44x44px`), background `#b71c1c` with hover transition to `#7a1f1f`, white border `3px solid #fff`.

---

## 6. CSS Reference Implementation

```css
:root {
  --color-primary-maroon: #7a1f1f;
  --color-primary-dark: #a51931;
  --color-primary-hover: #a52a2a;
  --color-primary-active: #b71c1c;
  --color-accent-gold: #FFC72C;

  --color-bg-canvas: #fdf7ef;
  --color-bg-surface: #ffffff;
  --color-bg-thumb: #f0e8dc;
  --color-bg-tint-maroon: rgba(122, 31, 31, 0.08);

  --color-text-brand: #7a1f1f;
  --color-text-primary: #313131;
  --color-text-secondary: #444444;
  --color-text-muted: #666666;
  --color-text-inverse: #ffffff;

  --radius-card: 14px;
  --radius-pill: 9999px;
  --radius-modal: 8px;

  --shadow-header: 0 2px 12px rgba(0, 0, 0, 0.08);
  --shadow-card: 0 4px 14px rgba(0, 0, 0, 0.08);
  --shadow-modal: 0 12px 50px rgba(0, 0, 0, 0.45);
}

/* Header Specification */
.site-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  height: 140px;
  background-color: var(--color-bg-canvas);
  border-bottom: 4px solid var(--color-accent-gold);
  box-shadow: var(--shadow-header);
  z-index: 99999;
  box-sizing: border-box;
}

/* Pill Button Patterns */
.btn-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 24px;
  border-radius: var(--radius-pill);
  font-size: 0.95rem;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.2s ease, color 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease;
  cursor: pointer;
}

.btn-pill-primary {
  background-color: var(--color-primary-maroon);
  color: var(--color-text-inverse);
  border: 1.5px solid transparent;
}

.btn-pill-primary:hover {
  background-color: var(--color-primary-hover);
  box-shadow: 0 4px 12px rgba(122, 31, 31, 0.3);
  transform: translateY(-1px);
}

.btn-pill-outline {
  background-color: transparent;
  color: var(--color-primary-maroon);
  border: 1.5px solid var(--color-primary-maroon);
}

.btn-pill-outline:hover {
  background-color: var(--color-primary-maroon);
  color: var(--color-text-inverse);
  transform: translateY(-1px);
}

/* Standardized Content Card */
.content-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 480px;
  background-color: var(--color-bg-surface);
  border-radius: var(--radius-card);
  overflow: hidden;
  box-shadow: var(--shadow-card);
  text-decoration: none;
  color: inherit;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.content-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.content-card-thumb {
  width: 100%;
  height: 200px;
  flex-shrink: 0;
  background-color: var(--color-bg-thumb);
  overflow: hidden;
}

.content-card-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.content-card-body {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  padding: 14px 16px 16px;
  overflow: hidden;
}

.date-pill {
  display: inline-block;
  align-self: flex-start;
  background-color: var(--color-accent-gold);
  color: var(--color-primary-maroon);
  font-size: 0.72rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  margin-bottom: 8px;
}

.card-title-clamp {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  color: var(--color-text-brand);
  font-size: 0.92rem;
  font-weight: 700;
  line-height: 1.35;
  margin: 0 0 6px 0;
}

.card-excerpt-clamp {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: 0.78rem;
  line-height: 1.45;
  margin: 0;
}
```

---

## 7. Tailwind CSS Configuration Mapping

To integrate this design system into the AgriScan Pro frontend (`frontend/tailwind.config.ts`), add the following token extensions:

```typescript
// tailwind.config.ts extension
export default {
  theme: {
    extend: {
      colors: {
        gfs: {
          maroon: {
            DEFAULT: '#7a1f1f',
            dark: '#a51931',
            hover: '#a52a2a',
            active: '#b71c1c',
            tint: 'rgba(122, 31, 31, 0.08)',
          },
          gold: {
            DEFAULT: '#FFC72C',
            light: '#ffe17d',
          },
          canvas: '#fdf7ef',
          surface: '#ffffff',
          thumb: '#f0e8dc',
          text: {
            brand: '#7a1f1f',
            primary: '#313131',
            secondary: '#444444',
            muted: '#666666',
          }
        }
      },
      borderRadius: {
        'gfs-card': '14px',
        'gfs-pill': '9999px',
      },
      boxShadow: {
        'gfs-header': '0 2px 12px rgba(0, 0, 0, 0.08)',
        'gfs-card': '0 4px 14px rgba(0, 0, 0, 0.08)',
        'gfs-modal': '0 12px 50px rgba(0, 0, 0, 0.45)',
      }
    }
  }
}
```

---

## 8. Accessibility & Engineering Quality Standards

1. Color Contrast: Text rendered in `#7a1f1f` over `#fdf7ef` satisfies WCAG AAA contrast requirements (> 7.5:1). Gold badge text (`#7a1f1f` on `#FFC72C`) delivers compliant high-contrast readability.
2. Focus Indicators: All interactive links, buttons, and navigation elements require distinct focus-visible rings using `outline: 2px solid #FFC72C; outline-offset: 2px;`.
3. Screen Reader Conformance: Skip-to-content links (`.skip-link`) must remain functional with `clip` property positioning until focused.
4. Layout Shift Prevention: Explicit height declarations and image aspect ratio reservation prevent layout shifts during asset streaming.
