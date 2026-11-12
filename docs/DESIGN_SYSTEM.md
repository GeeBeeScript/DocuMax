# Design System

DocuMax's UI takes its visual language from **Miro** (miro.com): bright yellow, deep ink, lots of white, rounded
friendly type, a dotted "infinite board" canvas, sticky notes, and calm, confident motion. Where a Miro page has a
direct equivalent (landing page, pricing, dashboard), we **mirror its layout and section structure closely** and
swap in DocuMax's own content.

> **Guardrail.** We reproduce layout, spacing, component patterns and interactions. We do **not** copy Miro's logo,
> illustrations, screenshots, product imagery, marketing copy, or trademarks. All copy and visuals are DocuMax's own.

Tokens live in [app/globals.css](../app/globals.css). **Never use raw hex values in components.**

## Color

| Token                               | Value                  | Use                                                            |
| ----------------------------------- | ---------------------- | -------------------------------------------------------------- |
| `yellow`                            | `#FFD02F`              | Brand highlight: marker bands, CTA band, active nav, selection |
| `yellow-hover`                      | `#FFC800`              | Hover of yellow surfaces                                       |
| `yellow-soft`                       | `#FFF6D5`              | Subtle highlight backgrounds, active sidebar item              |
| `ink`                               | `#050038`              | Text, primary buttons, dark sections (Miro's near-black)       |
| `ink-soft`                          | `#3A3760`              | Secondary text on light, hover of ink                          |
| `paper`                             | `#FFFFFF`              | Page background, cards                                         |
| `canvas` + `dot`                    | `#F7F7F5` / `#D9D8E3`  | Board backgrounds (`bg-board` utility)                         |
| `gray-50…700`                       | cool grays             | Borders, muted text, table stripes                             |
| `note-*`                            | yellow/blue/pink/green | Sticky notes, illustrations, category chips                    |
| `success/warning/danger` (+`-soft`) |                        | Data states only (status badges, issues). Never decorative.    |

Rules: **Yellow is a highlight, not a primary button fill** on white pages; the default CTA is the **ink pill**. Use
a yellow pill only on ink/neutral backgrounds or once per view. Want pure black instead of ink? Change `--color-ink`.

shadcn semantic mapping: `primary` = ink, `secondary` = yellow, `accent/muted` = gray-100, `ring` = ink.

## Typography

| Role    | Font                                   | Notes                                                                         |
| ------- | -------------------------------------- | ----------------------------------------------------------------------------- |
| Display | **Plus Jakarta Sans** (`font-heading`) | Stand-in for Miro's Roobert PRO (commercial). Bold/ExtraBold, tight tracking. |
| Body    | **Noto Sans** (`font-sans`)            | Same family Miro uses for body copy.                                          |
| Mono    | system mono                            | Amounts in tables use `tabular-nums` instead of mono.                         |

Swap path: with a Roobert license, load it via `next/font/local` in `app/layout.tsx` under `--font-plus-jakarta`.

Scale: `text-display-xl` (72) hero · `text-display-lg` (56) section · `text-display-md` (40) mobile/section ·
Tailwind `text-xl…text-sm` for UI. Headlines use `text-balance`; paragraphs `text-pretty`; max ~70ch.

## Shape, elevation, spacing

- Buttons: **pills** (`rounded-full`), heights 36/44/56. Dense app controls use `components/ui/button` (8px radius).
- Cards: `rounded-2xl`–`rounded-3xl`, 1px `gray-200` border, `shadow-card`; hover → `shadow-lift`.
- Sticky notes: `rounded-sm`, `shadow-note`, optional ±2° tilt.
- Section rhythm (marketing): `py-24 md:py-32`; container `max-w-6xl px-6` (wide sections `max-w-7xl`).
- App density: 8px grid; tables 44px rows.

## Motion (Motion.dev, `motion/react`)

- All scroll reveals go through `components/motion/Reveal` (fade + 24px rise, 0.6s, ease `[0.22,1,0.36,1]`, once).
- Stagger children by 60–100ms. Hover lift: `y: -4`, shadow to `shadow-lift`, 200ms.
- Tabs/showcases crossfade (`FadeSwap`), ≤ 300ms.
- Respect `prefers-reduced-motion` (handled inside motion wrappers + the `[data-reveal]` rule in `globals.css` —
  never re-implement per component; see ADR-009).
- Never scroll-reveal above-the-fold LCP content (hero / page headlines) — it must paint without JS.
- No motion on data-dense app screens beyond 150ms state transitions.

## Component layers

See [CONVENTIONS.md](CONVENTIONS.md#componentization) for rules. Inventory:

| Layer                  | Components (✓ = exists)                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/ui`        | ✓ button, input, card, badge, dialog, dropdown-menu, sonner (+ add via `npx shadcn add`)                                                                                                                                                                                                                                                                                                                                                                          |
| `components/brand`     | ✓ PillButton, ✓ StickyNote, ✓ BoardCanvas, ✓ YellowMarker, ✓ Logo, ✓ SectionHeading/Eyebrow, ✓ Section/Container, ✓ SegmentedToggle, ✓ CollabCursor                                                                                                                                                                                                                                                                                                               |
| `components/motion`    | ✓ Reveal, ✓ Stagger, ✓ HoverLift, ✓ FadeSwap, ✓ Float, ✓ MotionProvider                                                                                                                                                                                                                                                                                                                                                                                           |
| `components/marketing` | ✓ SiteHeader (HeaderShell, DesktopNav mega-menu, MobileNav), ✓ Hero, ✓ LogoStrip, ✓ UseCaseTabs, ✓ FeatureGrid, ✓ AlternatingFeature, ✓ CheckList, ✓ Testimonial, ✓ StatsRow, ✓ PersonaCards, ✓ WorkflowSteps, ✓ PricingCards, ✓ PricingTable, ✓ Faq, ✓ TrustGrid, ✓ CalloutBand, ✓ ResourceLinks, ✓ CtaBand, ✓ AnnouncementBar, ✓ SiteFooter, ✓ MarketingSection, ✓ IndustryPage, ✓ EmailCtaForm, ✓ AuthAside, ✓ LegalPage, `visuals/*` board mockups            |
| `components/app`       | ✓ AppSidebar, ✓ AppNav, ✓ TopBar, ✓ OrgSwitcher, ✓ UserMenu, ✓ PageHeader, ✓ EmptyState, ✓ QuickStartCard, ✓ StepHeading, ✓ TextField, ✓ SelectField, ✓ FormAlert, ✓ DataTable, ✓ ViewToggle, ✓ StatusBadge, ✓ ConfidencePill, ✓ FileDropzone, ✓ UploadTray, ✓ DocumentPreview (+ PdfViewer, ImageViewer), ✓ PageSourceBadge, ✓ LiveRegion, ✓ Money, ✓ IssueBanner, ✓ Kbd, ✓ ReasonDialog, ✓ StatTile, ✓ ToneBadge, ✓ RealtimeRefresh, ✓ UsageMeter, EntityPicker |
| `pdf/components`       | ✓ ReportHeader, ✓ ReportTable, ✓ TotalsBlock, ✓ PageFooter, ✓ BrandBar, ✓ ReportTiles                                                                                                                                                                                                                                                                                                                                                                             |

## Page mapping (Miro reference → DocuMax)

| Miro page / pattern                                                                                                                                                                                                                 | DocuMax page                                   | Mirror closely                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Home: sticky nav with mega-menus, hero with email field + "Sign up free", trusted-by logo strip, tabbed use-case showcase on a board canvas, feature blocks alternating image/text, testimonials, big CTA band, multi-column footer | `/` landing                                    | Section order, spacing, nav behavior (sticky, shadow on scroll), hero layout, tabbed showcase interaction |
| Solutions / use-case pages                                                                                                                                                                                                          | `/property-managers`, `/contractors`           | Same block components with persona-specific content from `content/industries.ts`                          |
| Pricing: plan cards with monthly/annual toggle, highlighted plan, full comparison table, FAQ accordion                                                                                                                              | `/pricing`                                     | Card layout, toggle, sticky comparison header, FAQ                                                        |
| Sign-up / login: split screen, minimal form                                                                                                                                                                                         | `/signup`, `/login`                            | Layout and form density                                                                                   |
| Dashboard: left sidebar (workspace switcher, nav), top search bar, "Create new" button, recent boards grid                                                                                                                          | `/app`                                         | Sidebar structure, top bar, card grid of entities/recent documents                                        |
| Board canvas with sticky notes                                                                                                                                                                                                      | Hero mockup, empty states, review "board" view | Dotted background, sticky-note cards                                                                      |

App-specific screens without a Miro equivalent (review queue, statement builder, settings, billing) use the same
tokens, the app shell, and `components/app` building blocks.

## Accessibility

WCAG 2.2 AA: ink on white and ink on yellow both pass AAA; **never white text on yellow**. Visible focus rings
(`ring-3 ring-ink/30`), 44px minimum touch targets, semantic headings, and `aria-live` for processing status.
