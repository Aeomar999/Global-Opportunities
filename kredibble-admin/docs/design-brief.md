# G.O.D Admin: Design Brief (single source of truth for all visual decisions)

References: Ref 1 = dark purple dashboard (sidebar shape, mood, breadcrumbs). Ref 2 = light
dashboard (container structure, charts, accent usage). Match structure and feel. Never copy their
branding, copy, icons or illustrations.

> Revision note: four values differ from the first draft of this brief, after the contrast checks.
> They are marked **[adjusted]** below. If this brief is ever re-pasted from an older copy, re-apply
> these four: orange-700, border-input, the chart bar colours and the label rule.

## 1. Principles
- Purple builds the structure (sidebar, selection, charts). Orange is the single accent: the
  primary button, one highlighted datum per chart, key icon tiles, notification dots.
- Calm and restrained: mostly white, soft grey and violet-black. Accent colour appears
  sparingly so the eye lands on what matters.
- Small, refined type. Dense but breathable.
- Glass effects live only on DARK surfaces (sidebar, one feature card per page). Light
  surfaces stay flat and clean.
- Status colours (green/amber/red) are only for status and deltas, always with text.
- Never rely on colour alone. Every pale or decorative element has a labelled equivalent.

## 2. Color tokens (CSS variables in globals.css, Tailwind v4 @theme)
Light surfaces
- page bg #F3F3F7, surface #FFFFFF, surface-2 (inset/KPI upper) #F6F5FA, border #E9E8F0
- text #17121F, text-muted #66607A (minimum for readable text on white and on page bg)
- **[adjusted]** input / control boundary token `border-input` #8F89A3 (3.35:1 on white). Inputs use it.
  The card border #E9E8F0 (1.2:1) is only for cards and dividers, never for form controls.
Purple (brand #792EA4)
- 50 #F6EFFA, 100 #ECDDF5, 200 #D9BDEB, 400 #9A52C2, 500 #792EA4, 600 #6A2792, 700 #5A2079
- text on light: purple-700. Links: purple-700, underline on hover.
Dark sidebar
- sb-bg #140A22, sb-raised #1D1030, sb-line rgba(255,255,255,0.08)
- sb-text #F4EEFB, sb-muted #B8A9CE (8.8:1 on sb-bg)
- selected parent pill: linear-gradient(180deg, #8E40BD, #7B2FA7), white text (5.8:1 or better)
- glass fill: linear-gradient(to top, rgba(167,106,214,0.22), rgba(255,255,255,0.04));
  glass border 1px rgba(255,255,255,0.10); glass bottom edge 1px rgba(210,170,240,0.40)
  (this is the "light from below" glow). Search field and active child use it.
Orange accent (brand #fc5e24)
- 50 #FFF1EA, 100 #FFDFD0, 500 #fc5e24 (fills, bars, dots, icons only, never small text),
  600 #CC4A12 (primary button background, white label 4.6:1), hover #B8410E
- **[adjusted]** 700 #B53B0A (orange text on white, orange-50 and orange-100: 5.84 / 5.29 / 4.65:1).
  It was #C2410C, which is only 4.12:1 on orange-100.
Status (text on tint): success #15803D on #E8F6EE (dot #16A34A), warning #8A5A00 on #FDF3D8
  (dot #D99A00), danger #B91C1C on #FDECEC (dot #DC2626), neutral #4B4560 on #EFEEF4
**[adjusted]** Chart: highlight orange-500, primary series purple-500, secondary purple-400.
  Non-highlighted bars have TWO colours depending on whether they carry value labels:
  - `chart-pale` #D5C6E3 (1.61:1 on white, decorative only): allowed ONLY when every bar has a
    printed value label (14 bars or fewer).
  - `chart-bar` #9E7FBB (3.38:1 on white, 3.12:1 on surface-2; passes the WCAG 3:1 graphics rule):
    required whenever bars have no labels (the 30-day view). #A284BE, the first estimate, is
    3.19:1 on white but only 2.94:1 on surface-2, so it was not used.
Focus ring: 2px, offset 2px. purple-500 on light, #C9A3E6 on dark.
Legacy kb-* tokens stay as aliases pointing to these values until the final cleanup step.

## 3. Typography
Fonts: Plus Jakarta Sans (headings, KPI numbers, card titles) and Inter (everything else), via
next/font/google. tabular-nums on every number. Never go below 12px.
- Greeting headline (Overview): Jakarta 800, 28/34, -0.01em
- Page title (inner pages): Jakarta 700, 24/30, -0.01em
- Page subtitle: Inter 400, 14/20, muted
- Card title: Jakarta 700, 16/22. Card subtitle: Inter 12/16 muted
- KPI value: Jakarta 800, 30/36. KPI label: Inter 500, 12/16, muted
- Sidebar group row: Inter 600, 13/18. Sidebar child: Inter 400, 13/18 (active 500)
- Breadcrumb: Inter 13/18 (current segment 600)
- Table header: Inter 600, 11/16, uppercase, +0.06em. Table body: 13/18 (primary cell 600),
  secondary line 12/16 muted
- Badge, chip, count pill: Inter 600, 12/16. Button: Inter 600, 14/20. Input: 14/20
- Chart axis and footer: 12/16 muted
Mobile (below 640px): greeting 24/30, page title 22/28.

## 4. Spacing, shape, elevation
- 4px base scale: 4, 8, 12, 16, 20, 24, 28, 32, 40, 48. No arbitrary pixel values.
- Page padding 28px desktop, 20px tablet, 16px mobile. Grid gap 16px. Card padding 20px.
- Radii: card 16, control 12, inset 10, pill 999, sidebar curve 28.
- Elevation: cards get a 1px border #E9E8F0 plus shadow 0 1px 2px rgba(23,18,31,0.04). Nothing
  heavier. Menus and dialogs: shadow 0 12px 32px rgba(23,18,31,0.14).
- Content max-width 1440px, centered.

## 5. Sidebar (dark violet, collapsible)
- Expanded 248px, collapsed rail 72px. Sticky, height 100dvh, nav list scrolls internally,
  brand and user blocks stay pinned. **[adjusted]** The sidebar itself has NO rounded corners and
  sits flush to the viewport. The curve of the reference is on the CONTENT PANEL's TOP-LEFT
  corner (radius 28px, token `radius-panel`): the whole shell behind the sidebar is the sidebar
  colour (sb-bg) at full height, so the dark colour shows through the notch and looks as if it
  wraps around the content. Implementation: an "inverted corner" on the sticky top bar (the
  `panel-corner` utility): a 28px absolutely positioned square at the bar's top-left painted
  `radial-gradient(circle at 100% 100%, transparent 28px, sb-bg 28.5px)`. No overflow:hidden
  on the panel (it would break the sticky top bar). The corner follows the panel's left edge, so
  it tracks 248px, 72px and the 200ms width animation. Below 1024px (drawer mode) the panel is
  flush: no corner, no notch. **[adjusted]** The bottom purple glow is subtle: radial
  rgba(121,46,164,0.18) (was 0.35), so the sidebar stays near-black except around the user card.
- Brand row 64px: orange rounded-square "G" mark, "G.O.D" (Jakarta 700 15px white) and
  "Global Opportunity Desk" (11px muted), plus a 28px ghost collapse button (chevrons).
- Search: 40px glass field with a "Cmd K" key chip. Opens a command palette (page list from nav.ts).
- Nav is two-level. Group names: Dashboard (Overview, Insights), Opportunities, People, Trust &
  safety, Content, Comms & admin. Group rows are parents (icon 18px stroke 1.75, label, chevron). The group
  containing the active route is the violet pill and is open; the others are collapsed. Several
  groups may be open at once.
- Children sit under a thin tree line (1px rgba(255,255,255,0.14)) with a curved elbow into each
  child, as in Ref 1. Child row 36px, radius 10. The ACTIVE child uses the glass style and may
  show a right-aligned count pill (rgba(255,255,255,0.10) background). **[adjusted]** The active
  child's "light from below" is stronger than the plain glass: 1px rgba(210,170,240,0.55) on the
  bottom edge and 1px rgba(255,255,255,0.08) on the other three (`glass-active`).
- Parent rows 40px, radius 12, hover rgba(255,255,255,0.06).
- Bottom: glass user card (avatar 32px, name 13/18 600, role 12/16 muted) with a Log Out
  action. The visible text "Log Out" must remain in expanded mode for the e2e test.
- Collapsed rail: only icons. Brand shows only the "G" mark with the toggle beneath it. Hover or
  keyboard focus on an icon shows a tooltip with its name. Clicking a group icon opens a flyout
  panel (glass, dark, 220px) beside the rail listing its children. Esc and outside click close it,
  and focus returns to the icon. Group icons show a small dot for pending counts. Search becomes
  an icon button. The user card becomes an avatar with a Log Out icon button (with tooltip).
- Width animates 200ms ease-out (none under prefers-reduced-motion). Toggle is a real button
  with aria-expanded and a label. Shortcut: Ctrl/Cmd+B.
- Persist the choice in a cookie ("sidebar=expanded|collapsed") that the server layout reads, so
  the first paint is correct. With no cookie, start expanded and collapse once at below 1280px.
- Below 1024px: no rail. A hamburger in the top bar opens the same dark sidebar as a drawer
  (always expanded, focus trapped, Esc closes).

## 6. Top bar and breadcrumbs
- Top bar 64px, white, 1px bottom border. Left: hamburger (mobile) and breadcrumbs. Right: the
  "Mock data" pill (dev only), bell with an orange dot, user menu (avatar, name, role).
- Breadcrumb pattern: Home / Group (with a dropdown caret) / Current page [count pill].
  Separators are light "/". The caret opens a menu of the group's pages; **[adjusted]** the page you
  are on is marked in that menu: check icon on the right, weight 600, aria-current="page". The
  current segment is strongest (600). The optional count pill is purple-50 with purple-700 text. On detail pages:
  Group / List page / Entity name. On mobile collapse to "... / Current page".

## 7. Components
- Card: white, border, 16px radius, 20px padding. Header = title (Jakarta 16/22) + subtitle
  (12/16 muted) left, optional action right (a text link in purple-700, e.g. "See more").
- KPI card (two layers): upper area on surface-2 with label, big value and a mini bar sparkline
  (12 vertical bars, 4px wide, pale #D5C6E3, ONE accent bar in orange); white footer strip with
  the delta chip, a muted caption and an optional kebab. The whole card is one link. Delta chip
  colour follows good or bad (a "goodDirection" prop), never just arrow direction.
- List card rows: 36px icon tile (radius 10, tinted), title 13/18 600, subtitle 12/16 muted, time
  right-aligned 12/16 muted.
- Highlight bar chart (New submissions): only the latest or the hovered/focused bar is orange.
  **[adjusted]** 14 bars or fewer (7 and 14 days): pale bars with a small value label above EVERY
  bar (the highlighted label is bold). More than 14 bars (30 days): darker `chart-bar` bars, no
  per-bar labels except the highlighted bar. The highlight is never colour alone (bold label +
  tooltip). Dark one-line tooltip (#17121F, white text, "28 Sep 2026 · 6 submissions"). Dashed
  gridlines, evenly spaced axis labels ending on the last date, arrow-key navigation, visually
  hidden data table.
- KPI mini bar sparkline: stays pale (#D5C6E3). It is decorative (aria-hidden) and the KPI value
  is always printed next to it, so the 3:1 graphics rule does not apply.
- Segmented bar (Insights): one 12px bar split into segments (purple-500, orange-500, purple-400,
  orange-100 border style), a legend with dot, label, value and percent under it, all inside an
  inset surface-2 box showing the total.
- Progress row: label and bold percent on one line, 6px bar on a #EDEBF3 track (fill purple-500),
  12px muted caption below.
- Table: header band surface-2 (36px, radius 10). Rows 56px, 1px divider, hover surface-2. Rows
  are real links with focus rings. Numbers are tabular-nums.
- Status badge: pill, tinted background, dot plus text (never colour alone). Mapping lives in
  ONE file (status-map.ts).
- Dark feature card: at most ONE per page. Gradient #140A22 to #4A1C6B with a soft orange glow
  at the bottom edge, frosted inner rows, an orange primary button.
- Buttons: 40px tall, 12px radius. Primary = orange-600 with a white label. Secondary = white
  with a border. Ghost = transparent. Danger = red tint. Disabled = clearly muted.
- Inputs: 40px, 12px radius, 1px border (`border-input`), purple focus ring.
- Dialog and toast: white, 16px radius, menu shadow, focus trapped, Esc closes.

## 8. Motion, accessibility, responsive
- Motion: 150-200ms ease-out for hover, focus and sidebar width only. Honour reduced-motion.
- Text contrast at least 4.5:1 (orange text uses orange-700, never orange-500). Visible focus
  rings everywhere. One h1 per page. Icon-only buttons have aria-labels.
- Breakpoints: 1280 and up full layout; 1024-1279 rail by default; below 1024 drawer;
  below 640 single column and tables become stacked cards.

## 9. Never
- No colour outside this palette, no hard-coded hex or pixel values in pages, no second dark
  feature card on a page, no glass on light surfaces, no orange for status or small text.
