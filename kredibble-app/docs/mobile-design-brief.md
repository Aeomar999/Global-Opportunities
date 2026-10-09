# Kredibble mobile app: design brief (Step 0)

Status: **Step 1a (foundation) is done; decisions are made (section 9).** Screens still carry old hard-coded colours; those are Step 1b (`docs/mobile-step-1b-hex-plan.md`). Sections 1 to 8 are the original Step 0 text (the "current spec" describes the app before Step 1a).
Date: 2026-10-08. Scope: `kredibble-app` (Expo SDK 57, React Native 0.86, NativeWind 4, expo-router).

Goal: bring the mobile app onto the same brand as the admin dashboard (`kredibble-admin/docs/design-brief.md`): purple `#792EA4` for structure (navigation, selection, charts), orange `#FC5E24` as the single accent, Plus Jakarta Sans for headings and key figures, Inter for body text.

How this was produced: read-only inspection of the source, a script that counts literals, and a script that computes WCAG 2.x contrast ratios. No tests, no builds, no installs.

Note on rules: `docs/preamble.md` and `docs/doc-addon.md` exist only in `kredibble-admin/docs/`, not in this app. Their rules were followed (no backend or dependency changes, no git writes, no secrets).

Contents: 1 Current spec · 2 Proposed tokens · 3 Contrast check · 4 Decisions · 5 Token consolidation plan · 6 Fonts · 7 Order of later steps · 8 Open questions

---

## 1. Current mobile spec (as found)

Source of truth today: `src/constants/design.ts` (imported by 18 files). It is only partly used: most screens write hex values and pixel numbers directly (see section 5).

### 1.1 Colours (`design.ts` → `Colors`)

| Token | Value | Used for |
|---|---|---|
| primary | `#6671E4` | brand, buttons, tab bar, onboarding background, links |
| primaryLight | `#8B95FF` | light brand |
| primaryDark | `#3654FF` | dark brand |
| primaryTransparent | `rgba(102,113,228,0.1)` | tinted backgrounds |
| primaryChip | `rgba(102,113,228,0.12)` | multi-select chip background |
| bgScreen | `#F7F7F9` | auth and main screen background |
| bgOnboarding | `#6671E4` | onboarding background |
| bgDefault | `#F3F3F3` | default background |
| bgAlt | `#F6F7F9` | alternate background |
| bgCard | `#FFFFFF` | cards |
| bgAdsBanner / bgAdsBannerInner | `#EBEBEE` / `#E0E0E6` | ads placeholder |
| textDefault | `#000000` | text |
| textBody / textHeading | `#1A1A1A` | body and screen titles |
| textMuted | `#8A8D9F` | subtitles, helper text |
| textSecondary | `#595959` | secondary labels |
| textPlaceholder | `#A1A1AA` | input placeholder |
| textAds | `#B0B0BC` | ads label |
| borderDefault | `#E5E6F2` | card borders |
| borderInput | `#EBEBEE` | input borders |
| success / error / warning | `#16A34A` / `#ED4C5C` / `#F6B612` | states |
| tabBar / tabIcon / tabIndicator | `#6671E4` / `#FFFFFF` / `#FFFFFF` | tab bar |
| radioUnselected | `#C4C4C4` | role cards |
| divider | `#EBEBEE` | dividers |

`tailwind.config.js` defines a **second, different** palette: primary `#6671E4`/`#8B95FF`/`#3654FF`, background `#F3F3F3`/`#F6F7F9`/`#FFFFFF`, text `#000000` / muted `#595959` (not `#8A8D9F`) / light `#1A1A1A`, border `#E5E6F2`, plus success/error/warning. `src/global.css` has a **third** set under `:root` (`--color-primary #6671E4`, text `#111827`, muted `#6B7280`, border `#E5E7EB`, error `#EF4444`, and others) that no file in src reads directly (not verified for the web build).

### 1.2 Typography

- Family: `Inter` is named in `design.ts` and in `tailwind.config.js` (`font-sans`), but **it is not loaded anywhere** (section 6). On the emulator the system font (Roboto) is shown.
- `design.ts` scale: xs 12, sm 13, base 14, md 15, screenTitle 17, lg 22, xl 36. Line heights 18 / 20 / 22 / 42. Weights regular 400, medium 500, semibold 600, bold.
- In practice: 667 literal font sizes across the screens, 21 distinct values (8, 9, 10, 11, 12, 13, 14, 14.5, 15, 16, 17, 18, 20, 22, 24, 26, 28, 32, 36, 48, 80 px). Most used: 13 px (205), 14 px (110), 12 px (104), 15 px (63), 11 px (47), 17 px (35), 10 px (27).
- `DateTimePickerModal.tsx` sets `fontFamily: 'Outfit_700Bold'`, a font that is not loaded either.

### 1.3 Spacing and layout

- 4 px base. `Spacing`: 2, 4, 8, 16, 20, 24, 32, 40, 48, 64.
- `Layout`: screen padding 24 (auth) and 20 (home/tabs), top 28, bottom 24, section gap 32, field gap 20, label gap 8, button gap 16, inline gap 12, feature card gap 20, max content width 800 (web).

### 1.4 Radii (`design.ts` → `Radius`)

sm 4 (checkboxes), md 8 (buttons, text inputs), lg 12 (pickers, role cards, ads banner), searchBar 15, card 16, full 9999. In practice 374 literal `borderRadius` numbers in 58 files plus 12 Tailwind `rounded-*` classes in 6 files. Counts: radius 12 appears 115 times in 35 files, radius 16 appears 38 times in 25 files, radius 8 appears 64 times in 27 files.

### 1.5 Sizes (`Size`)

Button height 52, input height 52, search bar 50, auth logo 56, home logo 40, tab bar 64 (code uses 56 on Android, 49 + inset on iOS), tab icon 24, indicator 20 × 3 (the tab layout actually draws 16 × 3), ads banner 59, feature card 121.7, progress bar 4, pagination dots 6 / 4, border width 1, checkbox 16, social icon 18.

In the components: `Button.tsx` uses `h-10` / `h-12` / `h-14` (40 / 48 / 56) with `rounded-xl` (12); `InputField.tsx` uses `h-14` (56) with `rounded-xl` (12); `Header.tsx` is `h-14` with a 40 × 40 round back button.

### 1.6 Shadows

`Shadow.primaryButton`: colour `#6671E4`, offset 0/4, opacity 0.2, radius 8, elevation 4. `Shadow.searchBar`: black, offset 0/1, opacity 0.05, radius 4, elevation 2.

### 1.7 Components

- `ui/Button`, `ui/InputField`, `ui/Header`, `ui/ToastProvider`, `ui/DateTimePickerModal`.
- Everything else (cards, chips, filters, lists, auth forms) is written inline inside the screens.
- Dead template files (nothing imports them except each other): `app-tabs.tsx`, `app-tabs.web.tsx`, `hint-row.tsx`, `web-badge.tsx`, `animated-icon.tsx`, `animated-icon.web.tsx`, `animated-icon.module.css`, `ui/collapsible.tsx`, `themed-text.tsx`, `themed-view.tsx`, `hooks/use-theme.ts`, `external-link.tsx`, `constants/theme.ts`.

### 1.8 Tab bar

Hard-coded in `src/app/(tabs)/_layout.tsx`: background `#6671E4`, six lucide icons (Home, Compass, PlusCircle, Target, Users, User) at 24 px, white; inactive icons at 65 % opacity; active tab shows a 16 × 3 white bar under the icon. Height 56 on Android, 49 + bottom inset on iOS. The tab layout does not read `Colors.tabBar` or `Size.tabBarHeight`.

### 1.9 `app.json` and theme

`userInterfaceStyle` is `automatic`, but no screen has a dark theme (everything is hard-coded light). Splash background `#208AEF` and adaptive icon background `#E6F4FE` are Expo template blue, not the brand. App name "Kredibble".

---

## 2. Proposed tokens

Neutrals are taken from the admin design brief (it was reachable at `kredibble-admin/docs/design-brief.md`), so both products match.

### 2.1 Reference scales

| Purple (structure) | | Orange (single accent) | |
|---|---|---|---|
| purple-50 | `#F6EFFA` | orange-50 | `#FFF1EA` |
| purple-100 | `#ECDDF5` | orange-100 | `#FFDFD0` |
| purple-200 | `#D9BDEB` | orange-500 | `#FC5E24` |
| purple-400 | `#9A52C2` | orange-600 | `#CC4A12` |
| purple-500 | `#792EA4` | orange-700 | `#B53B0A` |
| purple-600 | `#6A2792` | | |
| purple-700 | `#5A2079` | | |

Neutrals: page `#F3F3F7`, surface `#FFFFFF`, surface-2 (inset) `#F6F5FA`, border `#E9E8F0`, border-input `#8F89A3`, text `#17121F`, muted `#66607A`.

Rules of use (from the contrast check below):
- Purple means structure: tab bar, headers, selection, chips, charts, links.
- Orange is the only accent: the one primary call to action per screen, badges that need attention, a highlight.
- **Orange `#FC5E24` is never used for text, and never as the background of white text.** It only fails 4.5:1 (3.10:1). For a filled orange button use orange-600 `#CC4A12` with a white label (4.61:1). For orange text use orange-700 `#B53B0A`. Orange-500 stays for icons, fills, dots and large decoration on white.
- Do not put an orange indicator on the purple tab bar (2.47:1, fails). The active-tab bar stays white.

### 2.2 Current → new

| Current token | Current value | New token | New value | Note |
|---|---|---|---|---|
| primary | `#6671E4` | purple-500 | `#792EA4` | white on it 7.66:1 (current 4.16:1) |
| primaryLight | `#8B95FF` | purple-400 | `#9A52C2` | |
| primaryDark | `#3654FF` | purple-700 | `#5A2079` | pressed state is purple-600 `#6A2792` |
| primaryTransparent | `rgba(102,113,228,.1)` | purple-50 | `#F6EFFA` | solid, so contrast is predictable |
| primaryChip | `rgba(102,113,228,.12)` | purple-100 | `#ECDDF5` | chip text purple-700 (8.46:1) |
| bgScreen | `#F7F7F9` | page | `#F3F3F7` | |
| bgDefault | `#F3F3F3` | page | `#F3F3F7` | merged |
| bgAlt | `#F6F7F9` | surface-2 | `#F6F5FA` | merged |
| bgCard | `#FFFFFF` | surface | `#FFFFFF` | unchanged |
| bgOnboarding | `#6671E4` | purple-500 | `#792EA4` | |
| bgAdsBanner / Inner | `#EBEBEE` / `#E0E0E6` | surface-2 / border | `#F6F5FA` / `#E9E8F0` | confirm, see section 8 |
| textDefault, textBody, textHeading | `#000000`, `#1A1A1A` | text | `#17121F` | merged into one token |
| textMuted | `#8A8D9F` | muted | `#66607A` | current fails AA (3.29:1) |
| textSecondary | `#595959` | muted | `#66607A` | merged |
| textPlaceholder | `#A1A1AA` | muted | `#66607A` | `#7A7490` was tested and is not enough (4.44:1 on white, 4.01:1 on page) |
| textAds | `#B0B0BC` | muted | `#66607A` | |
| borderDefault | `#E5E6F2` | border | `#E9E8F0` | decorative card edge, not a control |
| borderInput | `#EBEBEE` | border-input | `#8F89A3` | current is 1.19:1; a control edge needs 3:1 (3.35:1) |
| radioUnselected | `#C4C4C4` | border-input | `#8F89A3` | current 1.74:1 |
| divider | `#EBEBEE` | border | `#E9E8F0` | |
| success | `#16A34A` | success | text `#15803D` on `#E8F6EE`; dot `#16A34A` | `#16A34A` as text fails (3.30:1) |
| error | `#ED4C5C` | danger | text `#B91C1C` on `#FDECEC`; dot `#DC2626` | `#ED4C5C` as text fails (3.63:1) |
| warning | `#F6B612` | warning | text `#8A5A00` on `#FDF3D8`; dot to be chosen | `#F6B612` is 1.81:1; the admin dot `#D99A00` is 2.45:1 and also fails, so the dot must always sit next to a text or icon label until a darker dot colour is confirmed |
| tabBar | `#6671E4` | purple-500 | `#792EA4` | |
| tabIcon / tabIndicator | `#FFFFFF` | white | `#FFFFFF` | inactive icons at 65 % opacity are about 4.2:1 on purple-500 (estimate, passes 3:1) |
| (new) accent | none | orange-600 / orange-500 / orange-700 | `#CC4A12` / `#FC5E24` / `#B53B0A` | button fill / icon and dot / text |
| Shadow.primaryButton colour | `#6671E4` | orange-700 at 20 % or none | | primary button becomes orange-600; shadow follows it |
| Splash background | `#208AEF` | purple-500 | `#792EA4` | template blue is not the brand |
| Adaptive icon background | `#E6F4FE` | purple-50 | `#F6EFFA` | confirm against the real icon artwork |

### 2.3 Typography (proposed, applied in the fonts step)

- Headings, screen titles and key figures: Plus Jakarta Sans (600, 700, 800).
- Body, labels, inputs, buttons: Inter (400, 500, 600, 700).
- The first recolour/fonts step does **not** change sizes. A reduction of the 21 literal sizes to the `FontSize` scale is a later screen-group step.

---

## 3. Contrast check

Method: WCAG 2.x relative luminance, ratio `(L1 + 0.05) / (L2 + 0.05)`. Needs: 4.5:1 for body text, 3:1 for large text (18 px regular or 14 px bold and up), icons and graphics that carry meaning. "Needs" shows the requirement used for that row. Pairings are computed, not estimated, except the inactive-tab-icon note above.

Headlines:
- **Orange `#FC5E24` on white: 3.10:1.** It passes only for icons, fills and dots. It fails as text.
- **White on orange `#FC5E24`: 3.10:1.** It fails for a button label (4.5:1). It passes only as large text or an icon. Use orange-600 `#CC4A12` (4.61:1) for any filled button with a label.
- Orange on the purple bar is 2.47:1 and fails even 3:1.
- The current palette fails AA in several places: white on `#6671E4` 4.16:1, muted `#8A8D9F` 3.29:1, placeholder `#A1A1AA` 2.56:1, input border `#EBEBEE` 1.19:1, error text 3.63:1, success text 3.30:1, warning text 1.81:1.
- The new palette passes everywhere it is used as text. The rows marked FAIL under NEW/ORANGE/STATUS/FORM are the "do not use like this" cases (decorative only, or the combinations banned above).

| Pairing | Foreground | Background | Ratio | Needs | AA |
|---|---|---|---|---|---|
| NEW  Body text on white | `#17121F` | `#FFFFFF` | 18.38:1 | 4.5:1 | pass |
| NEW  Body text on page background | `#17121F` | `#F3F3F7` | 16.60:1 | 4.5:1 | pass |
| NEW  Body text on inset (surface-2) | `#17121F` | `#F6F5FA` | 16.94:1 | 4.5:1 | pass |
| NEW  Muted text on white | `#66607A` | `#FFFFFF` | 5.97:1 | 4.5:1 | pass |
| NEW  Muted text on page background | `#66607A` | `#F3F3F7` | 5.39:1 | 4.5:1 | pass |
| NEW  Muted text on inset | `#66607A` | `#F6F5FA` | 5.50:1 | 4.5:1 | pass |
| NEW  Placeholder = muted on white | `#66607A` | `#FFFFFF` | 5.97:1 | 4.5:1 | pass |
| NEW  Link / selected text: purple-700 on white | `#5A2079` | `#FFFFFF` | 10.95:1 | 4.5:1 | pass |
| NEW  purple-700 on purple-50 (chip, selected row) | `#5A2079` | `#F6EFFA` | 9.72:1 | 4.5:1 | pass |
| NEW  purple-700 on purple-100 | `#5A2079` | `#ECDDF5` | 8.46:1 | 4.5:1 | pass |
| NEW  purple-700 on page background | `#5A2079` | `#F3F3F7` | 9.90:1 | 4.5:1 | pass |
| NEW  purple-500 text on white (large text only) | `#792EA4` | `#FFFFFF` | 7.66:1 | 3:1 | pass |
| NEW  purple-500 text on white as body text | `#792EA4` | `#FFFFFF` | 7.66:1 | 4.5:1 | pass |
| NEW  White on purple-500 (tab bar icons, onboarding) | `#FFFFFF` | `#792EA4` | 7.66:1 | 3:1 | pass |
| NEW  White on purple-500 as body text (onboarding copy) | `#FFFFFF` | `#792EA4` | 7.66:1 | 4.5:1 | pass |
| NEW  White on purple-600 (pressed, gradient end) | `#FFFFFF` | `#6A2792` | 9.06:1 | 4.5:1 | pass |
| NEW  White on purple-700 | `#FFFFFF` | `#5A2079` | 10.95:1 | 4.5:1 | pass |
| NEW  purple-400 graphic on white (selected bar, chart) | `#9A52C2` | `#FFFFFF` | 4.82:1 | 3:1 | pass |
| NEW  purple-200 on white (decorative only) | `#D9BDEB` | `#FFFFFF` | 1.69:1 | 3:1 | **FAIL** |
| ORANGE  orange-500 on white (text) | `#FC5E24` | `#FFFFFF` | 3.10:1 | 4.5:1 | **FAIL** |
| ORANGE  orange-500 on white (icon / fill / dot) | `#FC5E24` | `#FFFFFF` | 3.10:1 | 3:1 | pass |
| ORANGE  White on orange-500 (button label) | `#FFFFFF` | `#FC5E24` | 3.10:1 | 4.5:1 | **FAIL** |
| ORANGE  White on orange-500 (large text 18px bold or icon) | `#FFFFFF` | `#FC5E24` | 3.10:1 | 3:1 | pass |
| ORANGE  White on orange-600 (primary button label) | `#FFFFFF` | `#CC4A12` | 4.61:1 | 4.5:1 | pass |
| ORANGE  White on orange-600 hover/pressed #B8410E | `#FFFFFF` | `#B8410E` | 5.53:1 | 4.5:1 | pass |
| ORANGE  orange-700 text on white | `#B53B0A` | `#FFFFFF` | 5.84:1 | 4.5:1 | pass |
| ORANGE  orange-700 text on orange-50 | `#B53B0A` | `#FFF1EA` | 5.29:1 | 4.5:1 | pass |
| ORANGE  orange-700 text on orange-100 | `#B53B0A` | `#FFDFD0` | 4.65:1 | 4.5:1 | pass |
| ORANGE  orange-500 on purple-500 (indicator on a purple bar) | `#FC5E24` | `#792EA4` | 2.47:1 | 3:1 | **FAIL** |
| ORANGE  orange-500 on page background (dot) | `#FC5E24` | `#F3F3F7` | 2.80:1 | 3:1 | **FAIL** |
| STATUS  Success text #15803D on #E8F6EE | `#15803D` | `#E8F6EE` | 4.50:1 | 4.5:1 | pass |
| STATUS  Warning text #8A5A00 on #FDF3D8 | `#8A5A00` | `#FDF3D8` | 5.36:1 | 4.5:1 | pass |
| STATUS  Danger text #B91C1C on #FDECEC | `#B91C1C` | `#FDECEC` | 5.66:1 | 4.5:1 | pass |
| STATUS  Neutral text #4B4560 on #EFEEF4 | `#4B4560` | `#EFEEF4` | 7.85:1 | 4.5:1 | pass |
| STATUS  Success dot #16A34A on white | `#16A34A` | `#FFFFFF` | 3.30:1 | 3:1 | pass |
| STATUS  Warning dot #D99A00 on white | `#D99A00` | `#FFFFFF` | 2.45:1 | 3:1 | **FAIL** |
| STATUS  Danger dot #DC2626 on white | `#DC2626` | `#FFFFFF` | 4.83:1 | 3:1 | pass |
| STATUS  White on danger #B91C1C (destructive button) | `#FFFFFF` | `#B91C1C` | 6.47:1 | 4.5:1 | pass |
| FORM  Input border #8F89A3 on white | `#8F89A3` | `#FFFFFF` | 3.35:1 | 3:1 | pass |
| FORM  Unselected radio / checkbox #8F89A3 on white | `#8F89A3` | `#FFFFFF` | 3.35:1 | 3:1 | pass |
| FORM  Card border #E9E8F0 on white (decorative, not a control) | `#E9E8F0` | `#FFFFFF` | 1.22:1 | 3:1 | **FAIL** |
| CURRENT  Muted #8A8D9F on white | `#8A8D9F` | `#FFFFFF` | 3.29:1 | 4.5:1 | **FAIL** |
| CURRENT  Muted #8A8D9F on #F7F7F9 | `#8A8D9F` | `#F7F7F9` | 3.07:1 | 4.5:1 | **FAIL** |
| CURRENT  Placeholder #A1A1AA on white | `#A1A1AA` | `#FFFFFF` | 2.56:1 | 4.5:1 | **FAIL** |
| CURRENT  Secondary #595959 on white | `#595959` | `#FFFFFF` | 7.00:1 | 4.5:1 | pass |
| CURRENT  White on primary #6671E4 (buttons, tab bar, onboarding) | `#FFFFFF` | `#6671E4` | 4.16:1 | 4.5:1 | **FAIL** |
| CURRENT  White on primary #6671E4 as icons (tab bar) | `#FFFFFF` | `#6671E4` | 4.16:1 | 3:1 | pass |
| CURRENT  Primary #6671E4 text on white (links) | `#6671E4` | `#FFFFFF` | 4.16:1 | 4.5:1 | **FAIL** |
| CURRENT  Input border #EBEBEE on white | `#EBEBEE` | `#FFFFFF` | 1.19:1 | 3:1 | **FAIL** |
| CURRENT  Unselected radio #C4C4C4 on white | `#C4C4C4` | `#FFFFFF` | 1.74:1 | 3:1 | **FAIL** |
| CURRENT  Error #ED4C5C text on white | `#ED4C5C` | `#FFFFFF` | 3.63:1 | 4.5:1 | **FAIL** |
| CURRENT  Warning #F6B612 text on white | `#F6B612` | `#FFFFFF` | 1.81:1 | 4.5:1 | **FAIL** |
| CURRENT  Success #16A34A text on white | `#16A34A` | `#FFFFFF` | 3.30:1 | 4.5:1 | **FAIL** |


---

## 4. Decisions to record

### 4.1 Light mode only (for now)

- Decision: the app ships light only. Dark mode is out of scope.
- Plan: in `app.json` change `"userInterfaceStyle": "automatic"` to `"light"` (currently `automatic`). **Not changed in this step.** It goes into the first implementation step (section 7, step 1).
- Why: no screen has a dark variant (colours are hard-coded light), so `automatic` would give a light UI with a dark status bar and dark system dialogs on phones set to dark.

### 4.2 One button radius: 12 px

- Proposal: **12 px** for buttons, text inputs and pickers.
- Why: (a) it matches the admin control radius (12), so both products share a shape; (b) it is already the most used radius (115 uses in 35 files against 64 for 8); (c) `Button.tsx` and `InputField.tsx` already use `rounded-xl` (12), so the shared components do not change; (d) cards stay 16 and inset elements 10, as in the admin, which keeps a clear step between control and container.
- `design.ts` says `Radius.md = 8` is for "buttons, text inputs", so the token itself disagrees with the shared components. The fix is to point `Radius.control` at 12 and remove `md`.
- Every place that uses radius 8 today (`borderRadius: 8`, `Radius.md`, `rounded-lg`): **64 uses in 27 files**:

| Uses | File |
|---|---|
| 11 | `src/app/(auth)/login.tsx` |
| 6 | `src/app/(tabs)/community.tsx` |
| 4 | `src/app/events/booking.tsx` |
| 4 | `src/app/grants/apply.tsx` |
| 3 | `src/app/(auth)/signup.tsx` |
| 3 | `src/app/(tabs)/opportunities.tsx` |
| 3 | `src/app/events/[id].tsx` |
| 2 | `src/app/(tabs)/profile.tsx` |
| 2 | `src/app/community/feed.tsx` |
| 2 | `src/app/events/confirmation.tsx` |
| 2 | `src/app/grants/index.tsx` |
| 2 | `src/app/grants/[id].tsx` |
| 2 | `src/app/internships/[id].tsx` |
| 2 | `src/app/jobs/[id].tsx` |
| 2 | `src/app/opportunities/[id].tsx` |
| 2 | `src/app/profile/manage.tsx` |
| 2 | `src/app/profile/saved.tsx` |
| 1 | `src/app/(onboarding)/1.tsx`, `2.tsx`, `3.tsx` (one each) |
| 1 | `src/app/(tabs)/career.tsx` |
| 1 | `src/app/(tabs)/index.tsx` |
| 1 | `src/app/hirer-profile/verification.tsx` |
| 1 | `src/app/opportunities/create.tsx` |
| 1 | `src/app/profile/applications.tsx` |
| 1 | `src/app/recommended/index.tsx` |
| 1 | `src/components/ui/DateTimePickerModal.tsx` |

Not every one of these is a button (some are chips or small boxes). Each must be looked at when its screen group is done; do not bulk-replace. Radius 4 (checkboxes, small chips), the 15 px search bar and pills (9999) are separate decisions and stay as they are in the first steps.

### 4.3 One set of heights: 48

Today: 52 is in `design.ts` (`buttonHeight`, `inputHeight`), 48 is `Button`'s default (`h-12`), `InputField` is 56 (`h-14`), and secondary buttons are 40 (`h-10`).

| Height | Uses | Where |
|---|---|---|
| 52 | 36 uses in 9 files | `signup.tsx` (16), `login.tsx` (5), `hirer-profile/security.tsx` (3), `profile/security.tsx` (3), `welcome.tsx` (2), `hirer-profile/company.tsx` (2), `hirer-profile/recruiter.tsx` (2), `profile/edit.tsx` (2), `opportunities/create.tsx` (1) |
| 48 | 35 uses in 18 files | `login.tsx` (8), `community.tsx` (3), `opportunities/create.tsx` (3), `profile.tsx` (2), `community/feed.tsx` (2), `events/confirmation.tsx` (2), `experts/[id].tsx` (2), `hirer-profile/security.tsx` (2), `profile/security.tsx` (2), and 1 each in `signup.tsx`, `events/[id].tsx`, `grants/apply.tsx`, `grants/[id].tsx`, `hirer-profile/channels.tsx`, `internships/[id].tsx`, `jobs/[id].tsx`, `profile/edit.tsx`, `ui/Button.tsx` |
| 56 | 6 uses in 5 files | `InputField`, `Header` and others |
| 40 | 21 uses in 15 files | small buttons and controls |

Proposal: **48 px** for every button and every text input. Why: it is the Android/Material minimum touch target (48 dp), it is already the `Button` default and the second most used value, and it shows more of a form on small phones than 52 or 56. The 36 uses of 52 and the 56 in `InputField` move to 48; 40 px controls either become 48 or keep 40 with extra touch area (hit slop). **Open question 3** asks you to confirm 48 against 52, because the 52 values are on the auth screens, the first thing a new user sees.

---

## 5. Token consolidation plan

### 5.1 Files that define or hard-code colour, fonts, spacing or radii

Hard-coded hex values (search pattern `#RGB`, `#RRGGBB`, `#RRGGBBAA`; counts exclude `rgba()` and named colours): **1,555 occurrences, 90 distinct values, in 69 files.** The columns are occurrences and distinct values.

| Occ. | Distinct | File |
|---|---|---|
| 130 | 17 | `src/app/(auth)/signup.tsx` |
| 105 | 14 | `src/app/(auth)/login.tsx` |
| 80 | 19 | `src/app/opportunities/[id].tsx` |
| 62 | 17 | `src/app/(tabs)/opportunities.tsx` |
| 60 | 11 | `src/app/(tabs)/profile.tsx` |
| 57 | 11 | `src/app/(tabs)/community.tsx` |
| 57 | 16 | `src/app/opportunities/create.tsx` |
| 51 | 12 | `src/app/(tabs)/index.tsx` |
| 50 | 8 | `src/app/profile/edit.tsx` |
| 43 | 18 | `src/app/assistant/index.tsx` |
| 41 | 16 | `src/app/profile/saved.tsx` |
| 39 | 17 | `src/app/grants/index.tsx` |
| 38 | 14 | `src/app/internships/index.tsx` |
| 38 | 14 | `src/app/jobs/index.tsx` |
| 38 | 17 | `src/app/profile/applications.tsx` |
| 37 | 12 | `src/app/hirer-profile/security.tsx` |
| 37 | 10 | `src/app/jobs/filter.tsx` |
| 37 | 12 | `src/app/profile/manage.tsx` |
| 37 | 12 | `src/app/profile/security.tsx` |
| 35 | 9 | `src/app/internships/filter.tsx` |
| 34 | 10 | `src/app/grants/filter.tsx` |
| 34 | 10 | `src/components/ui/DateTimePickerModal.tsx` |
| 32 | 20 | `src/constants/design.ts` (the token file itself) |
| 27 | 7 | `src/app/hirer-profile/company.tsx` |
| 27 | 16 | `src/app/hirer-profile/verification.tsx` |
| 21 | 7 | `src/app/experts/[id].tsx` |
| 21 | 13 | `src/app/notifications/index.tsx` |
| 19 | 10 | `src/app/hirer-profile/postings.tsx` |
| 18 | 7 | `src/app/hirer-profile/recruiter.tsx` |
| 17 | 9 | `src/app/community/feed.tsx` |
| 15 | 8 | `src/app/hirer-profile/channels.tsx` |
| 14 | 7 | `src/app/hirer-profile/notifications.tsx` |
| 14 | 7 | `src/app/profile/notifications.tsx` |
| 14 | 9 | `src/app/recommended/index.tsx` |
| 13 | 13 | `tailwind.config.js` (second palette) |
| 12 | 8 | `src/app/grants/search.tsx`, `internships/search.tsx`, `jobs/search.tsx` (12 each) |
| 11 | 10 | `src/global.css` (third palette, `:root` variables) |
| 10 | 8 | `src/constants/theme.ts` (Expo template, dead) |
| 9 | 5 | `src/app/(auth)/welcome.tsx`, `src/app/career-resources/index.tsx` (9 each) |
| 7 | 2 | `src/app/(onboarding)/1.tsx`, `2.tsx`, `3.tsx` (7 each); `src/app/events/index.tsx` (7, 4 distinct) |
| 6 | 5 / 3 | `src/app/(tabs)/career.tsx` (6, 5 distinct); `src/app/(tabs)/_layout.tsx` (6, 3 distinct, the tab bar) |
| 5 | | `src/app/experts/filter.tsx`, `src/components/ui/ToastProvider.tsx` |
| 4 | | `src/app/grants/apply.tsx` |
| 3 | | `src/app/events/booking.tsx`, `src/app/events/[id].tsx`, `src/components/animated-icon.tsx` (dead), `src/components/ui/InputField.tsx` |
| 2 | | `src/app/grants/[id].tsx`, `src/app/index.tsx`, `src/app/internships/[id].tsx`, `src/app/jobs/[id].tsx`, `src/app/_layout.tsx`, `src/components/animated-icon.module.css` (dead), `src/constants/authStore.ts` (the two Google brand colours, keep), `app.json` (splash and adaptive icon backgrounds) |
| 1 | | `src/app/(auth)/loading.tsx`, `src/app/events/confirmation.tsx`, `src/app/events/filter.tsx`, `src/components/themed-text.tsx` (dead), `src/components/ui/Button.tsx`, `src/components/ui/Header.tsx` |

Most used values: `#FFFFFF` 238, `#8A8D9F` 232, `#6671E4` 207, `#1A1A1A` 202, `#A1A1AA` 104, `#E5E6F2` 81, `#F7F7F9` 58, `#EBEBEE` 56, `#16A34A` 38, `#ED4C5C` 31, black 55 (`#000`, `#000000`). The eight most used of the 90 values account for 1,178 of the 1,555 uses, so the recolour is mostly a mapping of about 25 values, not 90.

Other literals (not hex): 374 `borderRadius` numbers in 58 files; 667 literal font sizes (21 distinct) in the screens; `StyleSheet.create` in 37 files; inline `style={{ }}` in 59 files. Spacing is written as Tailwind classes (`p-4`, `gap-3`) or numbers; there is no count of arbitrary pixel values yet and it is not part of the first steps.

Files that define tokens (the problem): `src/constants/design.ts`, `tailwind.config.js`, `src/global.css`, `src/constants/theme.ts`, `app.json`, `src/app/(tabs)/_layout.tsx` (tab bar), `src/components/ui/ToastProvider.tsx` (own colours).

### 5.2 Single source of truth

Proposal: **`src/constants/design.ts` stays the one place where values are written, and everything else derives from it.**

| Consumer | How it derives |
|---|---|
| `tailwind.config.js` | `require` the tokens instead of repeating them. Tailwind runs as CommonJS, so the colour, radius, font and spacing values move to a plain `.js` file (`src/constants/tokens.js`, no TypeScript syntax) that both `design.ts` (re-exports it) and `tailwind.config.js` (`require`) read. This is the only way to share one file between a CommonJS config and TypeScript without a build step. |
| Screens and components | Use Tailwind classes (`bg-primary`, `text-muted`, `rounded-control`) first; use `Colors.*` from `design.ts` only where a style object is needed (icon `color` props, `StyleSheet`, shadows). A hex literal in a screen is a defect. |
| `src/global.css` | Remove the unused `:root` palette. Keep only the base layer; autofill colours read the same tokens. |
| `app.json` | Cannot import. Keep three literals only (splash background, adaptive icon background, and `userInterfaceStyle: "light"`) and mark them with a comment in this brief. A check (a small script in a later step, no new dependency) compares them to the tokens. |
| Tab bar (`(tabs)/_layout.tsx`) | Reads `Colors.tabBar`, `Size.tabBarHeight` and `Size.tabIndicator*`. |
| `ToastProvider.tsx` | Reads `Colors` for success/error/info. |

Token names (so both products read alike): `primary` (purple scale 50 to 700), `accent` (orange scale), `page`, `surface`, `surface-2`, `border`, `border-input`, `text`, `muted`, `success`, `warning`, `danger`, and radius names `control` (12), `card` (16), `inset` (10), `pill` (9999), `check` (4).

### 5.3 What to do with `theme.ts`

`src/constants/theme.ts` is the Expo starter template (light/dark colours, "display" font, `Spacing`). Its only importers are other dead template files (`app-tabs.tsx`, `app-tabs.web.tsx`, `hint-row.tsx`, `themed-text.tsx`, `themed-view.tsx`, `ui/collapsible.tsx`, `web-badge.tsx`, `hooks/use-theme.ts`). **Nothing live uses it.** Plan: delete `theme.ts` together with those dead files, in one small, separate step (step 2 below), after you confirm the list. Deleting is not done in Step 0. Until then it must not be imported by any new code.

---

## 6. Fonts

### 6.1 Is Inter actually loaded?

**No.** Evidence:
- `design.ts` sets `FontFamily.sans = 'Inter'`, and `tailwind.config.js` sets `fontFamily.sans = ["Inter", "sans-serif"]`. Nearly every screen and component (about 55 files) uses `font-sans` (and `font-medium`, `font-bold`, ...).
- There is **no** `useFonts` call, no `@expo-google-fonts/*` package in `package.json`, no `.ttf`/`.otf` under `assets/`, and no `expo-font` config plugin entry in `app.json`. `expo-font` (~57.0.4) is installed, but only as a dependency of Expo itself.
- `src/app/_layout.tsx` does not wait for any font; `expo-splash-screen` is installed and not tied to fonts.
- Result: a native device has no font named "Inter", so it falls back to the system font (Roboto on Android, San Francisco on iOS). On the web target, the browser also falls back unless Inter happens to be installed.
- `DateTimePickerModal.tsx` references `Outfit_700Bold`, also not loaded, so it falls back the same way.

### 6.2 What is needed to load Inter and Plus Jakarta Sans in Expo

1. **Packages** (Expo's recommended route for Google fonts). These are the only ones required:
   - `@expo-google-fonts/inter`
   - `@expo-google-fonts/plus-jakarta-sans`

   `expo-font` and `expo-splash-screen` are already installed, so nothing else is needed. The version must be the one `npx expo install` picks for SDK 57; I have not looked it up and will not guess a number here. Size: each package contains every weight and italic, but the app bundles only the weights imported by name, so the extra weight in the app is roughly one `.ttf` per imported weight (tens of kB each; to be measured at install time). **Not installed. Awaiting your approval in a later message**, per the dependency rule.
   - Alternative with no new packages: download the `.ttf` files into `assets/fonts/` and list them in the `expo-font` config plugin in `app.json`. This needs the font files from you or from Google Fonts, and a development build (the plugin does not apply in Expo Go). I do not recommend it for now, because the app runs in Expo Go.
2. **Weights to import** (per-weight families, because React Native does not synthesise weights for custom fonts on Android): Inter 400, 500, 600, 700 (`Inter_400Regular`, `Inter_500Medium`, `Inter_600SemiBold`, `Inter_700Bold`) and Plus Jakarta Sans 600, 700, 800 (`PlusJakartaSans_600SemiBold`, `PlusJakartaSans_700Bold`, `PlusJakartaSans_800ExtraBold`).
3. **Loading** in `src/app/_layout.tsx`: call `useFonts({...})`, keep the splash screen visible with `SplashScreen.preventAutoHideAsync()` until the fonts are loaded (or failed, so a font error never blocks the app), then `SplashScreen.hideAsync()`.
4. **Tailwind names**: define one family per weight in the shared tokens (`font-body`, `font-body-medium`, `font-body-semibold`, `font-body-bold`, `font-heading`, `font-heading-bold`, `font-heading-extrabold`) and replace the combination `font-sans font-bold`. Plain `font-bold` on a custom family does nothing on Android, so the weight classes in all those files must change together. This is the one part that touches many files and has to be done in the same step as the load.
5. **Remove** the `Outfit_700Bold` reference (use the heading family).
6. **Fallback**: keep `sans-serif` after the custom family so a failed load still shows readable text.

---

## 7. Order of the later steps

Each step is a separate request, with its own approval. No step changes layout, copy or behaviour unless it says so.

| Step | What | Files it would touch |
|---|---|---|
| **0 (this)** | Brief only | `docs/mobile-design-brief.md` (new) |
| **1** | Tokens, recolour and fonts, **no layout change.** Create `tokens.js`; point `design.ts` and `tailwind.config.js` at it; new colours, radii and heights as values only; load fonts; set `userInterfaceStyle` to `light`; splash and adaptive icon colours; tab bar to tokens. **Needs approval to install the two font packages** (edits `package.json` and the lockfile). | `src/constants/design.ts`, new `src/constants/tokens.js`, `tailwind.config.js`, `src/global.css`, `app.json`, `package.json` and lockfile (approval), `src/app/_layout.tsx`, `src/app/(tabs)/_layout.tsx`, `src/components/ui/Button.tsx`, `InputField.tsx`, `Header.tsx`, `ToastProvider.tsx`, `DateTimePickerModal.tsx` |
| **2** | Remove dead template files and `theme.ts` (after your confirmation of the list in 1.7 and 5.3). | the 13 files in section 1.7 |
| **3** | Auth and onboarding: replace hex literals with tokens, orange primary button, radius 12, height 48, font families by weight. | `(auth)/login.tsx`, `signup.tsx`, `welcome.tsx`, `loading.tsx`, `(onboarding)/1.tsx`, `2.tsx`, `3.tsx`, `src/app/index.tsx` |
| **4** | Tabs and home: home, opportunities, career, community, profile. | `(tabs)/index.tsx`, `opportunities.tsx`, `career.tsx`, `community.tsx`, `profile.tsx` |
| **5** | Listings and details: jobs, internships, grants, opportunities, recommended, experts, events. | `jobs/*`, `internships/*`, `grants/*`, `opportunities/*`, `recommended/index.tsx`, `experts/*`, `events/*` |
| **6** | Profile and hirer profile: edit, manage, saved, applications, security, notifications, company, recruiter, postings, channels, verification. | `profile/*`, `hirer-profile/*` |
| **7** | The rest: assistant, notifications, community feed, career resources. | `assistant/index.tsx`, `notifications/index.tsx`, `community/feed.tsx`, `career-resources/index.tsx` |
| **8** | Final sweep: a check that finds any remaining hex literal or off-scale radius/height in `src`, contrast re-check on screenshots from the emulator, and the type-size clean-up (21 sizes to the scale). | all of `src` (read-only check first) |

Each step ends with the project's own checks (lint, type check, and a run on the emulator for the screens it touched), and is reported before the next begins.

---

## 8. Open questions (Step 0)

**Answered on 2026-10-08, see section 9.** Kept for the record.

1. **Font packages.** May I install `@expo-google-fonts/inter` and `@expo-google-fonts/plus-jakarta-sans` (via `npx expo install`) in step 1? Or do you prefer local `.ttf` files and a development build instead of Expo Go?
2. **Primary button colour.** The primary call to action must be orange-600 `#CC4A12` (white label 4.61:1) because `#FC5E24` fails with a white label. Is it acceptable that the button is darker than the brand orange, or should the label be dark (`#17121F` on `#FC5E24` would pass) instead?
3. **Height 48 or 52.** The auth screens use 52 today. Confirm 48 for all buttons and inputs, or tell me to keep 52.
4. **Warning dot colour.** `#D99A00` (admin) and `#F6B612` (app) both fail 3:1 on white. Is a darker warning dot colour acceptable, or must the admin and app keep the same one? (Admin may need the same fix.)
5. **Ads banner and splash/icon colours.** Is the ads placeholder to be `#F6F5FA`/`#E9E8F0`, and is the adaptive icon background `#F6EFFA` right for the real icon artwork? Is there a final icon and splash image, or only the Expo template ones?
6. **Heading font scope.** Plus Jakarta Sans on screen titles and key figures (counts, salary, dates in cards) only, with Inter everywhere else. Is that the intended scope?
7. **Dead template files.** Confirm that the 13 files in section 1.7 can be deleted in step 2 (nothing live imports them).
8. **Expo docs version.** `AGENTS.md` tells agents to read the Expo docs for **v56**, but `package.json` is on SDK **57**. Which should be followed for font loading and the splash API?

---

## 9. Decisions made (2026-10-08) and Step 1a result

### 9.1 Decisions (final)

| Topic | Decision |
|---|---|
| Primary | `#792EA4` with the scale purple-50 `#F6EFFA`, 100 `#ECDDF5`, 200 `#D9BDEB`, 400 `#9A52C2`, 500 `#792EA4`, 600 `#6A2792`, 700 `#5A2079` |
| Orange | `#FC5E24` is the single accent for icons, dots and badges only. Never orange text, never white text on `#FC5E24`. Filled orange button: `#CC4A12` with white text. Orange text: `#B53B0A` |
| Neutrals and text | the AA-passing values of section 2 (text `#17121F`, muted and placeholder `#66607A`, control border `#8F89A3`, card border `#E9E8F0`, page `#F3F3F7`, inset `#F6F5FA`) |
| Error and success | text `#B91C1C` / `#15803D`, dots `#DC2626` / `#16A34A`, tints `#FDECEC` / `#E8F6EE` |
| Warning (answers question 4) | dot and icon `#D97706` (3.19:1 on white), text `#B45309` (5.02:1 on white), `#F6B612` only as a soft background with dark text (10.17:1). Note: `#D97706` on the page background `#F3F3F7` is 2.88:1, so a warning dot on the page (not on a white card) needs a text label next to it |
| Radius | 12 for buttons, inputs and pickers (token `radius.control`, class `rounded-control`) |
| Height | 48 for buttons and inputs (token `size.controlHeight`, class `h-control`), including `InputField` (was 56) and the auth screens (were 52, applied in Step 1b) |
| Mode | light only: `userInterfaceStyle` is `"light"` |
| Fonts | Plus Jakarta Sans for screen titles, auth headings, the onboarding hero and key figures; Inter for everything else |
| Outfit_700Bold | **reference removed** (not loaded): `DateTimePickerModal` title now uses the heading family (Plus Jakarta Sans bold) |
| Expo docs | SDK 57, not the v56 line in `AGENTS.md` (which is unchanged) |
| Packages | `@expo-google-fonts/inter@^0.4.2` and `@expo-google-fonts/plus-jakarta-sans@^0.4.2` added with `npx expo install`. Nothing else was added (`expo-font` was already installed) |

### 9.2 Step 1a checklist

- [x] Single token source: `src/constants/tokens.js` (plain CommonJS).
- [x] `src/constants/design.ts` reads it (same export names; new names added: `purple*`, `accent*`, `*Dot`, `*Tint`, `warningSoft`, `Radius.control`, `Size.controlHeight`, `FontFamily.heading`).
- [x] `tailwind.config.js` reads it (old class names kept; new: `accent-*`, `purple-*`, `page`, `surface`, `muted`, `border-input`, `rounded-control`, `h-control`, `font-heading`).
- [x] `global.css`: the unused third palette removed; web autofill colours mirror the tokens.
- [x] Shared components: `Button` (radius 12, height 48 for every size, new `accent` variant), `InputField` (48, border-input), `Header` (heading font), `ToastProvider`, `DateTimePickerModal` (all hex replaced).
- [x] Tab bar: purple bar, white icons, inactive 65 %, white 20 × 3 underline, all from tokens. (The indicator was 16 × 3 in the code; it is now 20 × 3 as in `design.ts`.)
- [x] Onboarding 1 to 3: purple background, Plus Jakarta Sans hero, button 48 / radius 12.
- [x] `app.json`: `userInterfaceStyle` light; splash and adaptive-icon background `#792EA4`; artwork untouched.
- [x] Fonts loaded in `src/app/_layout.tsx`; splash stays until fonts are ready or failed; on failure the system font is used.
- [x] Hex list for Step 1b: `docs/mobile-step-1b-hex-plan.md`.
- [ ] `Collapsible` (`ui/collapsible.tsx`): **not changed.** It is one of the dead template files (it imports `theme.ts` and the template theme hook, which Step 1a was told not to touch). It is deleted in Step 2.
- [ ] Screens (hex replacement, auth 52 → 48, radius-8 list in section 4.2, font weights): Step 1b and later.

### 9.3 How fonts work (so nobody is surprised)

React Native needs one font family name per weight. Screens still say `fontWeight: '600'` (429 places) and `font-sans`. `src/lib/typography.tsx` replaces `Text` and `TextInput` with thin wrappers (installed only after the fonts load) that read the weight and pick the matching face (`Inter_400Regular` to `Inter_700Bold`, `PlusJakartaSans_600SemiBold` to `_800ExtraBold`), then set `fontWeight` back to normal so Android does not fake-bold. Use `font-heading` (or `fontFamily: FontFamily.heading`) for Plus Jakarta Sans. This bridge can be removed when every screen uses explicit font classes.

### 9.4 Still open

- Heading font on auth headings and key figures needs the screens (Step 1b); only the Header title, onboarding hero and date picker title use it so far.
- Question 5 (ads banner, splash and icon artwork) and question 7 (delete the dead files) are still to be answered; the splash and adaptive icon *backgrounds* are purple, the artwork is unchanged.
- The orange accent is defined but no screen uses it yet (Step 1b decides where badges, dots and the one filled orange button go).

### 9.5 Later changes (2026-10-08, after Step 1a)

- [x] Onboarding 1 to 3 match the approved design: wider, brighter glow behind the photo; headline in Plus Jakarta Sans ExtraBold (800); the italic middle word (Global, Employability, Opportunity) is ExtraBold Italic on an orange brush stroke (`src/components/ui/BrushHighlight.tsx`). White on #FC5E24 is 3.10:1, so this is allowed only because it is large text.
- [x] Real Plus Jakarta Sans italic faces are loaded (600, 700, 800).
- [x] Welcome screen removed (`src/app/(auth)/welcome.tsx`). Onboarding and the start screen now go to Login. Consequence: there is no Browse as Guest entry any more.
- [x] Logo: `assets/images/logo.png` replaced with the new ring-and-handshake logo (source is 71 x 77 px, low resolution; a larger file is needed for sharp results on high-density screens). It is used by 9 screens.
- [x] Primary colour sweep: every old primary (#6671E4) and its tints (#EEF2FF, #8B95FF, #3654FF, #C5C9F0, #E0E7FF, #F8F9FF, #DDE1FA, #C7CBEE, #D8DBFF, #818CF8, #3D2A6B) in screens is now a token (Colors.primary, primaryTransparent, purple50/100/200/400/700), plus 3 rgba values. 211 literals in 38 files; none remain. `docs/mobile-step-1b-hex-plan.md` was regenerated and lists what is still left (neutrals, text, borders, status colours).
- [x] Home cards: the five card images (`assets/images/opportunities_listing.png`, `expert_listing.png`, `community_networking.png`, `career_resources.png`, `ai_assistant.png`) were recoloured from the old blue to #792EA4 (background only; lighting and illustrations kept). Originals are in git.
- [x] Bottom tab bar matches the approved design: flat purple bar, no shadow, the five supplied icon pairs in `src/components/ui/NavIcons.tsx` (white outline inactive, orange solid active), 12 x 3 orange underline. The active-tab orange on the purple bar is 2.47:1 (below the 3:1 icon minimum); kept because it is in the approved design.
- [x] No drop shadows on buttons or search bars; no Shadow token remains.
- [x] Login screen: new logo, 10 % purple disabled/soft buttons (`Colors.primary10`), local Google logo (`GoogleLogo.tsx`), content centred vertically.
- [x] AI assistant screen restyled to the approved design: logo avatar, flat white bubbles (radius 12), orange user bubble (white text on #FC5E24 is 3.10:1; use #CC4A12 if AA is required), flat job cards, outline pill input with a purple send button. The suggestion chip was removed because the design has none.
