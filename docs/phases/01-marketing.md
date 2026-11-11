# Phase 1 — Design system & marketing site ✅

**Goal:** a Miro-faithful marketing site for both personas, built entirely from reusable section components.

## Scope

- Motion wrappers: `Stagger`, `HoverLift`, `FadeSwap` (+ tests).
- Marketing blocks (`components/marketing`): `SiteHeader` (sticky, shadow on scroll, mega-menu for Product /
  Solutions / Resources, mobile drawer), `Hero` (headline with YellowMarker, email field + CTA, board-canvas product
  mockup with sticky notes animating an invoice → statement flow), `LogoStrip` (placeholder customer wordmarks —
  generic, not real brands), `UseCaseTabs` (tabs: Upload · Extract · Review · Report, crossfading board mockups),
  `FeatureGrid`, `AlternatingFeature`, `Testimonial` (fictional, clearly placeholder until real quotes),
  `PricingCards` (monthly/annual toggle), `PricingTable` (sticky header comparison), `FAQ` (accordion), `CtaBand`
  (big yellow band), `SiteFooter` (multi-column).
- Pages: `/` landing, `/property-managers`, `/contractors`, `/pricing`, `/login` + `/signup` shells (UI only;
  wired in Phase 2). `(marketing)` route group with shared layout.
- Content objects: `content/marketing.ts`, `content/industries.ts` (persona variants), `content/pricing.ts`
  (plans mirror `lib/billing/plans.ts` caps), `content/nav.ts`.
- Optional `/design` internal style guide listing every brand/marketing component.
- SEO: metadata per page, OG image route, sitemap, robots.

## Acceptance criteria

- Landing page section order and interactions match the Miro home page pattern (see DESIGN_SYSTEM.md page mapping).
- Persona pages are the **same components** with different content objects (no duplicated markup).
- Lighthouse (mobile): Performance ≥ 90, Accessibility ≥ 95, SEO ≥ 95.
- Responsive 360px → 1440px; no layout shift from fonts; reduced-motion respected.
- No Miro logos, imagery or copy anywhere.

## Tests

- Render test per marketing block; behavior tests for `SiteHeader` (menu open/close, keyboard), `UseCaseTabs`
  (tab switching, arrow keys), `PricingCards` (toggle updates prices).
- E2E: navigate landing → pricing → signup CTA.

## Completion evidence (2026-11-11)

- [x] All scope items built; landing order: Hero → LogoStrip → UseCaseTabs → AlternatingFeature → Stats →
      Testimonial → FeatureGrid → PersonaCards → Callout → Resources → CtaBand → SiteFooter.
- [x] Persona pages are one `IndustryPage` component fed by `content/industries.ts`.
- [x] Lighthouse 12.8 (mobile, production build): Perf / A11y / SEO — `/` 90/100/100, `/pricing` 91/100/100,
      `/property-managers` 92/100/100, `/contractors` 94/100/100, `/login` 98/100/100. CLS 0 on every page.
- [x] No horizontal overflow at 360 / 768 / 1440 px on any marketing or auth page.
- [x] Reduced motion respected (ADR-009) — covered by unit tests and an e2e test.
- [x] Tests: render tests for every block; behavior tests for SiteHeader (`site-header.test.tsx`: scroll shadow,
      mega-menu click/keyboard/Escape, mobile drawer), UseCaseTabs (click + arrow keys), PricingCards (toggle);
      e2e `tests/e2e/marketing.spec.ts` (landing → pricing → signup, persona pages, mobile menu, reduced motion,
      SEO routes). `npm run check` green.
