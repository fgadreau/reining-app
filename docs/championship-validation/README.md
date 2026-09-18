# Championship highlights and final titles — 2026-09-18

The public championship now has one collapsed season-highlights accordion immediately before the class list, on desktop and mobile. Its three counts use all included occurrence results, including zero-point and disqualified participants, with the existing stable-identity resolver. They do not sum class standings.

Performance distinctions explicitly exclude DQ (including imported DQ placement labels). Point records use stable rider/horse identities and retain all tied holders and occurrence contexts. A combined rider/horse/duo card requires a complete one-to-one match of leader sets, totals and positive-point contributions. Otherwise the records remain separate with partner context. Top 3 placings count classes separately; participation means class participation rather than a distinct arena run.

Score maxima and progression are hidden. The CSV/public occurrence contract does not carry a reliable judge count, scoring scale or discipline metadata sufficient to establish comparable scores; no judge count is guessed from a score. Name-only identity fallback retains the existing behavior: ambiguous names are not assigned arbitrarily to a stable identity.

Final titles use only the real `final` status and the two highest distinct eligible positive point totals, with the existing `1e-9` tolerance. Co-champions do not suppress reserves. Numeric ranks and point calculation are unchanged. Titles are computed before search filtering and shared by the desktop, mobile and PDF presentations. FR/EN title translations are covered.

Validation:

- `npm test`: 288 tests, including 16 focused title/highlight cases; 20-duo PDF pagination remains covered.
- `npm run build`: successful; existing large-bundle warning remains.
- `npm run test:e2e -- tests/e2e/championship-highlights.spec.js`: desktop 1440px and mobile 390px, collapsed default, keyboard Enter/Space, unique entry point, no modal, no horizontal overflow, provisional title absence, final titles, search invariance, FR/EN, PDF text extraction and raster rendering.
- Visual review of screenshots below and the PDF page. All are isolated local fictional fixtures. No AQR season, status, points or results were changed.

Evidence:

- [Desktop titles and collapsed accordion](desktop-final.png)
- [Mobile titles and collapsed accordion](mobile-final.png)
- [Expanded mobile accordion](mobile-highlights.png)
- [Rendered final PDF](pdf-final.png) and [fictional PDF](final-fiction.pdf), including 50/50/48/48.

These fixtures validate final-only behavior. They are not evidence of final titles on a provisional production season. Deployment verification and promotion SHAs belong in the delivery PRs.

## Compact presentation follow-up

The public highlights now show only a short title, the shared record value and every tied holder. The combined points record adds the short label “Cavalier · Cheval · Duo”. Class/show lists, contribution details and calculation explanations are no longer rendered, including in hidden disclosures. Counts, accordion behavior, calculations, championship titles and PDF remain unchanged.

The current presentation supersedes the expanded highlight screenshots above: [desktop](compact-desktop.png), [mobile](compact-mobile.png). Both were visually inspected. The existing two Playwright scenarios also verify that context lists are absent and both tied points holders remain visible. All 288 unit tests, both browser scenarios and the production build pass.
