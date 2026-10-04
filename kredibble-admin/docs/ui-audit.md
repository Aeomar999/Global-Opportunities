# kredibble-admin UI Audit

Read-only inventory for a UI redesign. Facts only; no redesign suggestions.
Source: static read of `kredibble-admin/src`, `tests/`, `package.json`, `next.config.ts`. Nothing was run, and the Playwright suite was not executed.

---

## 1. Project foundation

### 1.1 Stack

| Item | Current state |
|---|---|
| Framework | Next.js 16.2.10 (App Router, Turbopack), React 19.2.4, TypeScript 5. `output: "standalone"` in `next.config.ts`. |
| Styling | Tailwind CSS v4 via `@tailwindcss/postcss` (`postcss.config.mjs`). No `tailwind.config.*`; theme is CSS-first in `src/app/globals.css`. |
| Utility libs | `clsx` is a dependency but is not imported anywhere in `src`. Class strings are template literals with ternaries. |
| Component library | None (no shadcn, Radix, MUI, Headless UI, etc.). All UI is hand-written Tailwind markup. |
| Chart library | None. The only "charts" are hand-rolled `div` progress bars (analytics, event detail, grant detail). |
| Icon library | `lucide-react` ^1.24.0. 27 import sites. Icon sizes/colours are passed as props (`size={16}`, `color="#6671E4"`). |
| Fonts | `Inter` via `next/font/google` (`src/app/layout.tsx`), exposed as `--font-inter`. `body` also falls back to `Arial, Helvetica, sans-serif`. No other fonts loaded. |
| Dark mode | None. No `dark:` classes or `prefers-color-scheme` rules. |
| Images | `public/logo.png` used via `next/image` (sidebar, login). Article banners use raw `<img>` (eslint-disabled). `public/` also holds unused default Next assets (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`). |
| Tests | Playwright (`tests/admin.e2e.spec.ts`, `tests/example.spec.ts`). Config runs chromium, firefox, webkit; `webServer` block commented out. |

### 1.2 Where tokens/theme live

Three places carry the same values:

1. `src/app/globals.css`
   - `:root` defines `--background`, `--foreground` and the `--color-kb-*` palette.
   - `@theme inline` re-maps each `--color-kb-*` so Tailwind generates `bg-kb-*`, `text-kb-*`, `border-kb-*` utilities.
   - Palette: `kb-primary #6671E4`, `kb-primary-light #8B95FF`, `kb-primary-dark #3654FF`, `kb-bg-screen #F7F7F9`, `kb-bg-card #FFFFFF`, `kb-bg-alt #F6F7F9`, `kb-text-body #1A1A1A`, `kb-text-muted #8A8D9F`, `kb-text-secondary #595959`, `kb-text-placeholder #A1A1AA`, `kb-border #E5E6F2`, `kb-border-input #EBEBEE`, `kb-success #16A34A`, `kb-error #ED4C5C`, `kb-warning #F6B612`, `kb-divider #EBEBEE`.
   - Also holds custom scrollbar styling (webkit + Firefox) applied to `*`.
2. `src/lib/design-tokens.ts`: a TS object (`Colors`, `Radius`, `FontWeight`). **Not imported by any file in `src`.** (Header comment says it is for inline styles/logic.)
3. Hex literals repeated inline across pages (see 2.x "one-off styling"): status pill colours (`#F0FDF4/#16A34A`, `#FFFBEB/#B7791F`, `#FEF2F2/#ED4C5C`, `#F3F4F6/#6B7280`), type colours (`#6671E4`, `#F59E0B`, `#10B981`, `#EF4444`), and Tailwind default palette classes (`bg-green-50`, `text-red-600`, `bg-gray-100`, `border-red-200`, etc.) that are not part of the `kb-*` token set.

**Referenced-but-undefined tokens:** `bg-kb-bg-body` (`verification/page.tsx:50`) and `bg-kb-bg-muted` (`login/page.tsx:85`) have no definition in `globals.css`, so Tailwind generates no rule for them.

### 1.3 `src/lib/nav.ts` structure

```ts
interface NavItem { label: string; href: string; icon: typeof LayoutDashboard; built: boolean }
interface NavSection { title: string; items: NavItem[] }
export const NAV_SECTIONS: NavSection[]
```

- `icon` is a `lucide-react` component reference (not a string). All icons are imported at the top of `nav.ts`.
- `built: false` renders a disabled "Soon" row in `Sidebar`; all current items are `built: true`.
- Active state is exact match: `pathname === item.href` (detail routes such as `/seekers/123` do not highlight their parent item).
- Sections and items (11 sections, 18 items):
  - Overview: Dashboard `/`, Platform Analytics `/analytics`
  - Verification: Verification Queue `/verification`
  - Opportunities: Opportunities Queue `/opportunities`
  - Users & Companies: Seekers `/seekers`, Hirers `/hirers`
  - Community: Channels `/community`
  - Trust & Safety: Reports Queue `/reports`
  - Content: Career Resources `/content/articles`
  - Reference Data: Seeker Taxonomy `/taxonomy/seeker`, Hirer Taxonomy `/taxonomy/hirer`, Grants Taxonomy `/taxonomy/grants`
  - Events & Grants: Events `/events`, Grants `/grants`
  - Notifications: Composer `/notifications/compose`, History `/notifications/history`
  - Admin Team: Staff `/staff`, Roles & Permissions `/roles`
- Not in nav (reachable by link or URL only): detail routes, `/staff/invite`, `/content/articles/new`.

### 1.4 Layout shell

- `src/app/layout.tsx`: `<html>` with `inter.variable h-full antialiased`; `<body class="min-h-full flex flex-col bg-kb-bg-screen text-kb-text-body">`.
- `src/app/(dashboard)/layout.tsx` (client): session gate. Reads `hasAdminSession()` (a stored-user check in `lib/api.ts`), redirects to `/login` if absent, shows "Checking admin session..." while pending. Renders `<Sidebar />` + `<main className="flex-1 min-w-0 p-8">`.
- Sidebar: `w-64`, sticky, full height, logo header, scrollable nav, Log Out button pinned at bottom.
- No top bar, breadcrumbs, user menu, page-header component, toast system, modal/drawer component, or responsive/mobile layout (fixed `w-64` sidebar, fixed `grid-cols-N` everywhere).

### 1.5 `src/components` inventory

| File | What it does | Imported by |
|---|---|---|
| `Sidebar.tsx` | Fixed left nav. Renders `NAV_SECTIONS` (section titles + items, active highlight, "Soon" variant), logo, and a Log Out button that calls `logoutAdmin()` then `router.push("/login")`. Client component. | `src/app/(dashboard)/layout.tsx` |
| `TaxonomyManager.tsx` | Tabbed editor for string lists: tab pills with counts, add input (Enter or button), removable chips. State is local (`useState`); nothing persisted. | `taxonomy/seeker/page.tsx`, `taxonomy/hirer/page.tsx`, `taxonomy/grants/page.tsx` |

These are the only two shared components. Everything else (stat cards, info cards/rows, status pills, filter pills, table rows, back buttons, form fields) is re-declared inline per page (see section 3).

Components duplicated per page (not shared): `StatCard` (dashboard, analytics: two different versions), `InfoCard` + `InfoRow` (verification/[id], opportunities/[id], seekers/[id], hirers/[id]; `InfoRow` also in reports/[id]), `Field` (articles/[id]), `STATUS_STYLES` maps (verification list + detail, opportunities list + detail, reports list + detail, community list + detail, hirers list + detail, events list).

### 1.6 Data layer (`src/lib`)

- `api.ts`: `request<T>()` wrapper (`fetch` against `NEXT_PUBLIC_API_URL`, unwraps `payload.data`, throws `Error(payload.error.message)`); helpers `getDashboardSummary`, `getVerifications`, `updateVerificationStatus` (defined, **not called by any page**), `getOpportunities`, `loginAdmin`, `logoutAdmin`, `hasAdminSession`, `saveAdminUser`, `clearAdminSession`.
- `mock-*.ts` (11 files): `mock-data` (pending verification companies), `mock-articles`, `mock-channels`, `mock-events`, `mock-grant-ops`, `mock-hirers`, `mock-opportunities`, `mock-reports`, `mock-seekers`, `mock-staff` (store class with subscribe), plus `notification-store.ts` (store class with subscribe).

---

## 2. Page inventory

Legend for state columns: **L** = loading state, **E** = empty state, **Er** = error state, **NP** = no-permission state. "Not found" means a "<thing> not found" fallback with a back link.

Global notes that apply to every page below:
- No page has a no-permission state. Access control is only the layout's session check (redirect to `/login`).
- No page except `/login` renders an API error. API calls elsewhere use `.then().finally()` with no `.catch()`, so a failed request leaves the page empty/unchanged with no message (and an unhandled promise rejection).
- No page has a confirmation dialog, toast, or success message after a mutation.
- Pages marked "server component" have no `"use client"` and read their mock data at render time.

### 2.1 Auth

#### `/login` — `src/app/login/page.tsx`
- **Purpose:** Admin email/password sign-in.
- **Type:** auth.
- **Renders:** Centred card with logo, `h1` "Kredibble Admin", subtitle, Email input, Password input, inline error box, "Sign in" submit button (disabled until both fields non-empty and not submitting; label becomes "Signing in..."), help text mentioning `npm run user:create-admin`.
- **Buttons:** primary "Sign in".
- **Data source:** real API `POST /auth/admin/login` (`loginAdmin`); on success stores the user and `router.push("/")`.
- **States:** L (button label only), E n/a, Er **yes** (error message box), NP n/a.
- **Status values:** none.
- **Playwright:** `h1` contains "Kredibble Admin"; `input[type="email"]`, `input[type="password"]`, `button[type="submit"]` (text "Sign in", disabled/enabled behaviour); `text=Invalid admin credentials` (error text comes from the backend message); redirect to `/` on success; `/login` URL after failure.
- **One-off styling:** both inputs and button are raw Tailwind (`h-11 rounded-lg border border-kb-border-input ...`); uses undefined `bg-kb-bg-muted` on the `<code>`; no `<label htmlFor>` association (labels are siblings, not bound to inputs).

### 2.2 Analytics / overview

#### `/` — `src/app/(dashboard)/page.tsx`
- **Purpose:** Dashboard home with headline counts and quick links.
- **Type:** analytics (stat cards + link cards).
- **Renders:** `h1` "Dashboard"; 3 stat cards (Pending Verification, Active Seekers, Active Hirers); 2-column grid of 7 quick-link cards (Verification, Opportunities, Seekers, Hirers, Community, Reports, Analytics) each with icon tile, title, dynamic subtitle, arrow.
- **Tables/filters/tabs/modals/bulk actions:** none.
- **Data source:** real API `GET /dashboard/summary` (`getDashboardSummary`). Fields used: `pendingVerifications`, `pendingOpportunities`, `activeSeekers`, `activeHirers`, `openReports`.
- **States:** L **yes** (centred spinner, whole page), E no (zeros shown), Er no, NP no.
- **Status values:** none.
- **Playwright:** `main` visible; `text=Dashboard` visible (matches heading and sidebar item).
- **One-off styling:** local `StatCard` with inline `style={{ backgroundColor: \`${color}1A\` }}` and hex colours passed as props (`#F6B612`, `#16A34A`, `#6671E4`); quick-link icon colour hard-coded `#6671E4`.

#### `/analytics` — `src/app/(dashboard)/analytics/page.tsx`
- **Purpose:** Cross-platform stats computed from mock seekers/hirers/postings/reports.
- **Type:** analytics.
- **Renders:** `h1` "Platform Analytics"; 4 stat cards (Active Seekers, Verified Hirers, Total Applications, Open Reports, each with a sub-line); one card "Postings by Type" with 4 horizontal bars (Jobs, Internships, Events, Grants) and counts.
- **Data source:** mock — `mock-seekers.ts`, `mock-hirers.ts`, `mock-opportunities.ts`, `mock-reports.ts`. Server component.
- **States:** L no, E no, Er no, NP no.
- **Status values:** reads seeker `status === "active"`, hirer `verification === "verified"`, report `status === "open"`; opportunity types `jobs|internships|events|grants`.
- **Playwright:** only the protected-route redirect test (`/analytics`).
- **One-off styling:** separate `StatCard` (different from dashboard's: adds `sub`); bars are `div`s with inline `width` % and inline hex `TYPE_COLORS`; no chart library.

### 2.3 Queues / moderation lists

#### `/verification` — `src/app/(dashboard)/verification/page.tsx`
- **Purpose:** Queue of company verification requests.
- **Type:** list.
- **Renders:** `h1` "Verification Queue"; filter tabs (segmented control): all / pending / approved / rejected; table (CSS grid `grid-cols-[2fr_1.2fr_1fr_1fr_20px]`) with columns **Company** (name + recruiter email), **Industry**, **Submitted**, **Status** (pill), chevron. Rows are `<Link>`s to `/verification/{id}`.
- **Buttons:** filter tabs only. No bulk actions, no search, no pagination.
- **Data source:** real API `GET /verification/companies[?status=]` (`getVerifications`), refetched on filter change.
- **States:** L **yes** (spinner in table body), E **yes** ("No verification requests found."), Er no, NP no.
- **Status values:** `pending | approved | rejected` (unknown values fall back to pending style).
- **Playwright:** redirect test only (`/verification`).
- **One-off styling:** local `STATUS_STYLES` with hex colours applied via inline `style`; uses undefined `hover:bg-kb-bg-body`; table is `div` grid, not `<table>`.

#### `/verification/[id]` — `.../verification/[id]/page.tsx`
- **Purpose:** Review a company's four submitted documents and approve/reject each.
- **Type:** detail (with per-item actions).
- **Renders:** back button; company name, industry · size · location; overall-status pill; two info cards (Company: website, company email, submitted; Recruiter: name, position, email); "Verification Documents" list of 4 rows (Business registration, Org ID, Company logo, Proof of org) each with file icon, label, filename, status pill, approve (check) and reject (X) icon buttons.
- **Data source:** **mock** — `mock-data.ts` (`pendingCompanies`), local state only. **List page uses the real API, this page uses mock data looked up by `params.id`**, so ids from the API will not resolve here ("Company not found."). `updateVerificationStatus` in `api.ts` is not called.
- **States:** L no, E n/a, Er no, NP no; "Company not found." fallback yes.
- **Status values:** `pending | approved | rejected` (per document and overall; overall is derived: all approved → approved, any rejected → rejected, else pending).
- **Playwright:** none.
- **One-off styling:** local `InfoCard`/`InfoRow`; icon buttons use `title="Approve"`/`"Reject"` as only labels; hex colours on icons and pills.

#### `/opportunities` — `.../opportunities/page.tsx`
- **Purpose:** Moderation queue for posted opportunities.
- **Type:** list.
- **Renders:** `h1` "Opportunities Queue" with pending-count sentence; filter pills: All / Jobs / Internships / Events / Grants (client-side filter); table `grid-cols-[2fr_1.3fr_1fr_1fr_1fr_20px]`: **Title** (+ "N applied"), **Company**, **Type** (icon + label), **Posted**, **Status** pill, chevron. Rows link to `/opportunities/{id}`.
- **Data source:** real API `GET /opportunities` (`getOpportunities`, no status arg; type filtering is client-side).
- **States:** L **yes**, E **yes** ("No opportunities in this category."), Er no, NP no.
- **Status values:** `moderationStatus`: `pending | approved | rejected`. Types: `jobs | internships | events | grants`.
- **Playwright:** redirect test only; sidebar text "Opportunities" is asserted on the dashboard.
- **One-off styling:** local `STATUS_STYLES` and `TYPE_META` (hex colours, icon per type); filter pill markup duplicated in reports, taxonomy, notifications, staff, articles.

#### `/opportunities/[id]` — `.../opportunities/[id]/page.tsx`
- **Purpose:** Review one posting; approve or reject.
- **Type:** detail.
- **Renders:** back button; type badge; title; company · location; status pill; Description card; "Posting Details" card (Posted, Applicants, optional Work Type, Salary); conditional Event/Grant Details card; Approve and Reject buttons.
- **Data source:** **mock** — `mock-opportunities.ts` (`postedOpportunities`), local state. Same API/mock id mismatch as verification detail.
- **States:** L no, Er no, NP no; "Opportunity not found." yes.
- **Status values:** `pending | approved | rejected`.
- **Playwright:** none.
- **One-off styling:** local `InfoCard`/`InfoRow`, `STATUS_STYLES`, `TYPE_META`; type badge background built with `${color}1A`.

#### `/reports` — `.../reports/page.tsx`
- **Purpose:** Trust & safety reports queue.
- **Type:** list.
- **Renders:** `h1` "Reports Queue"; filter pills All / Open / Resolved / Dismissed (default **Open**); table `grid-cols-[2fr_1fr_1fr_1fr_1fr_20px]`: **Target**, **Type** (capitalised), **Reason**, **Reported by**, **Status** pill, chevron.
- **Data source:** mock — `mock-reports.ts`.
- **States:** L no, E **yes** ("No reports in this category."), Er no, NP no.
- **Status values:** `open | resolved | dismissed`; target types `post | user | opportunity | channel`.
- **Playwright:** redirect test only.
- **One-off styling:** local `STATUS_STYLES` (hex, includes grey `#F3F4F6/#6B7280`).

#### `/reports/[id]` — `.../reports/[id]/page.tsx`
- **Purpose:** Read a report and mark it resolved or dismissed.
- **Type:** detail.
- **Renders:** back button; target-type eyebrow, target label, status pill; "Report Details" card (Reason, Reported by, Date, details paragraph); optional link "View the channel this report is about" (`/community/{linkedChannelId}`); "Mark resolved" and "Dismiss" buttons.
- **Data source:** mock — `mock-reports.ts`, local state.
- **States:** "Report not found." only.
- **Status values:** `open | resolved | dismissed`.
- **Playwright:** none.
- **One-off styling:** local `InfoRow`; `bg-gray-100`/`text-gray-600` Tailwind default palette for Dismiss.

### 2.4 Directories (users)

#### `/seekers` — `.../seekers/page.tsx`
- **Purpose:** Seeker directory with text search.
- **Type:** list.
- **Renders:** `h1` "Seekers Directory" with total-count sentence; search input (matches name, email, university, country); table `grid-cols-[1.6fr_1.6fr_1fr_0.8fr_0.8fr_1fr_20px]`: **Name** (+ email), **University**, **Country**, **Applied**, **Saved**, **Status** pill, chevron.
- **Data source:** mock — `mock-seekers.ts`.
- **States:** E **yes** ("No seekers match your search."), L no, Er no, NP no.
- **Status values:** `active | suspended`.
- **Playwright:** redirect test; sidebar text "Seekers" asserted on dashboard.
- **One-off styling:** inline-style status pill; search input markup duplicated in hirers.

#### `/seekers/[id]` — `.../seekers/[id]/page.tsx`
- **Purpose:** Seeker account detail; suspend/reinstate.
- **Type:** detail.
- **Renders:** back button; name, profession; status pill; "Account" card (Email, University, Country, Joined); "Activity" card (Applications submitted, Saved opportunities); one button "Suspend account" / "Reinstate account".
- **Data source:** mock — `mock-seekers.ts`, local state.
- **States:** "Seeker not found." only.
- **Status values:** `active | suspended`.
- **Playwright:** none.
- **One-off styling:** local `InfoCard`/`InfoRow`; inline-style pill.

#### `/hirers` — `.../hirers/page.tsx`
- **Purpose:** Hirer/company directory with text search.
- **Type:** list.
- **Renders:** `h1` "Hirers Directory" + count; search input (company, recruiter, email, industry); table `grid-cols-[1.6fr_1.4fr_1fr_0.8fr_1fr_1fr_20px]`: **Company** (+ location), **Recruiter**, **Industry**, **Postings**, **Verification** pill, **Status** pill, chevron.
- **Data source:** mock — `mock-hirers.ts`.
- **States:** E **yes** ("No hirers match your search."); others no.
- **Status values:** verification `verified | pending | rejected`; account `active | suspended`.
- **Playwright:** redirect test; sidebar text "Hirers" asserted.
- **One-off styling:** local `VERIFICATION_STYLES` (hex); inline-style account pill.

#### `/hirers/[id]` — `.../hirers/[id]/page.tsx`
- **Purpose:** Hirer account detail; suspend/reinstate; link to verification review.
- **Type:** detail.
- **Renders:** back button; company name, industry · location; verification pill + status pill; "Company" card (Recruiter, Recruiter Email, Joined, Active Postings); optional "Verification" card with link "Go to Verification Review" (`/verification/{linkedVerificationId}`); Suspend/Reinstate button.
- **Data source:** mock — `mock-hirers.ts`, local state.
- **States:** "Hirer not found." only.
- **Status values:** as above.
- **Playwright:** none.
- **One-off styling:** local `InfoCard`/`InfoRow`/`VERIFICATION_STYLES`; the Verification card is hand-built, not `InfoCard`.

### 2.5 Community

#### `/community` — `.../community/page.tsx`
- **Purpose:** List all community channels.
- **Type:** list.
- **Renders:** `h1` "Community Channels" + flagged count; table `grid-cols-[1.8fr_1.4fr_1fr_1fr_1fr_20px]`: **Channel** (hash icon tile + name), **Owner**, **Followers**, **Posts**, **Status** pill, chevron. No filter/search.
- **Data source:** mock — `mock-channels.ts`. Server component.
- **States:** none (no empty state).
- **Status values:** `active | flagged | removed`.
- **Playwright:** redirect test only.
- **One-off styling:** local `STATUS_STYLES` (hex).

#### `/community/[id]` — `.../community/[id]/page.tsx`
- **Purpose:** Review a channel's posts; remove posts; remove/restore the channel.
- **Type:** detail (with per-item actions).
- **Renders:** back button; name, owner · followers; status pill; "Posts" list of cards (author, date, optional red "Flagged" badge, trash icon button `title="Remove post"`, body; flagged cards get `border-red-200`); "Remove channel" / "Restore channel" button.
- **Data source:** mock — `mock-channels.ts`, local state.
- **States:** E **yes** ("No posts in this channel."), "Channel not found." yes.
- **Status values:** `active | flagged | removed` (button toggles removed ↔ active).
- **Playwright:** none.
- **One-off styling:** Tailwind default palette (`bg-red-50`, `text-red-600`, `border-red-200`).

### 2.6 Content

#### `/content/articles` — `.../content/articles/page.tsx`
- **Purpose:** List career-resource articles.
- **Type:** list.
- **Renders:** `h1` "Career Resources" with "New Article" link-button (to `/content/articles/new`); draft-count sentence; table `grid-cols-[2fr_1fr_1fr_1fr_20px]`: **Title** (banner thumbnail or file icon + title), **Category**, **Read Time**, **Status** pill, chevron.
- **Data source:** mock — `mock-articles.ts`. Server component.
- **States:** none (no empty state).
- **Status values:** `published | draft`.
- **Playwright:** redirect test only (`/content/articles`).
- **One-off styling:** raw `<img>` (eslint-disabled); inline-style pill; primary-button markup duplicated on staff and notification history pages.

#### `/content/articles/[id]` (also `/content/articles/new`) — `.../content/articles/[id]/page.tsx`
- **Purpose:** Create or edit an article.
- **Type:** form/editor.
- **Renders:** back button; `h1` "New Article"/"Edit Article"; fields: Banner Image (file picker via programmatic `<input type=file>`, preview with Remove and Replace overlay buttons, `URL.createObjectURL`), Title, Category, Read Time, Summary (textarea 2 rows), Content (plain textarea 10 rows), Status (Draft/Published pill toggle); submit button "Publish Article" (new) / "Save Changes" (edit), disabled until title, category, summary, content non-empty.
- **Data source:** mock `mock-articles.ts` to prefill; **save does nothing** except `router.push("/content/articles")` (code comment: "No backend yet"). Banner image is a local blob URL, not uploaded.
- **States:** "Article not found." (bare paragraph, no back link); L/E/Er/NP no.
- **Status values:** `draft | published`.
- **Playwright:** none.
- **One-off styling:** local `Field` wrapper; no rich-text editor (plain textareas); labels are not bound to inputs.

### 2.7 Reference data (settings-style editors)

#### `/taxonomy/seeker`, `/taxonomy/hirer`, `/taxonomy/grants` — `.../taxonomy/{seeker,hirer,grants}/page.tsx`
- **Purpose:** Edit dropdown option lists used by the mobile/web app.
- **Type:** settings-style editor (all three are thin wrappers around `TaxonomyManager`).
- **Renders:** `h1` + subtitle; tab pills with item counts; add-input + "Add" button; chips with an X remove button.
  - Seeker tabs: Universities (21), Programs (25), Skills (24), Career Interests (20).
  - Hirer tabs: Industries (10), Company Sizes (6), Position Roles (10).
  - Grants tabs: Sectors (17), Applicant Types (7), Funding Agencies (4).
- **Data source:** local component state seeded from arrays hard-coded in each page file. No persistence; refresh resets. Server-component wrappers pass data to a client component.
- **States:** E **yes** (per-tab "No entries yet — add one above."); L/Er/NP no. Duplicate values are silently ignored.
- **Status values:** none.
- **Playwright:** redirect tests (`/taxonomy/seeker`, `/taxonomy/grants`, `/taxonomy/hirer`).
- **One-off styling:** all markup lives in `TaxonomyManager`; X button has no accessible label.

### 2.8 Events & grants

#### `/events` — `.../events/page.tsx`
- **Purpose:** Events with capacity/attendance.
- **Type:** list.
- **Renders:** `h1` "Events"; table `grid-cols-[2fr_1.2fr_1fr_1.2fr_1fr_20px]`: **Event** (calendar icon tile + title), **Hirer**, **Date** (`dateTime.split(",")[0]`), **Attendance** ("n/cap (pct%)"), **Status** pill, chevron.
- **Data source:** mock — `mock-events.ts`. Server component. No filter/empty state.
- **Status values:** `upcoming | past | cancelled`.
- **Playwright:** redirect test only.
- **One-off styling:** local `STATUS_STYLES` (hex).

#### `/events/[id]` — `.../events/[id]/page.tsx`
- **Purpose:** View attendance, adjust capacity, cancel event.
- **Type:** detail with inline edit.
- **Renders:** back button; title; hirer · location · date/time; "Attendance" card with progress bar (`div`, inline width) and text; "Adjust Capacity" card (number input, Save, helper text "Cannot be set below current attendee count"); "Cancel event" button (hidden once cancelled). Note: the page shows no status pill.
- **Data source:** mock — `mock-events.ts`, local state. Save silently ignores invalid values (no error text).
- **States:** "Event not found." only.
- **Status values:** `cancelled` set locally; list shows `upcoming | past | cancelled`.
- **Playwright:** none.
- **One-off styling:** hand-built progress bar; same bar pattern in grant detail and analytics.

#### `/grants` — `.../grants/page.tsx`
- **Purpose:** Grants with funding-pool allocation.
- **Type:** list.
- **Renders:** `h1` "Grants"; table `grid-cols-[2fr_1.2fr_1fr_1.4fr_1fr_20px]`: **Grant** (icon tile + title), **Hirer**, **Sector**, **Budget Allocated** ("$a / $pool (pct%)"), **Status** pill (Open/Closed), chevron.
- **Data source:** mock — `mock-grant-ops.ts`. Server component. No filter/empty state.
- **Status values:** `open | closed`.
- **Playwright:** redirect test only.
- **One-off styling:** inline-style pill with ternary (no style map).

#### `/grants/[id]` — `.../grants/[id]/page.tsx`
- **Purpose:** Review grant applications; approve/reject; allocation recalculated.
- **Type:** detail (with per-item actions).
- **Renders:** back button; title; hirer · sector; "Funding Pool" card with progress bar and "allocated of pool · remaining" text; "Applications" list: applicant, requested amount, status pill, and (if pending) approve/reject icon buttons (approve disabled if `requestedAmount > remaining`).
- **Data source:** mock — `mock-grant-ops.ts`, local state (allocated total recomputed from approved applications).
- **States:** "Grant not found." only. No empty state for zero applications.
- **Status values:** application `pending | approved | rejected`; grant `open | closed`.
- **Playwright:** none.
- **One-off styling:** nested-ternary inline-style pill; icon-only buttons with `title` attributes.

### 2.9 Notifications

#### `/notifications/compose` — `.../notifications/compose/page.tsx`
- **Purpose:** Write a broadcast notification.
- **Type:** compose+history (compose half; form).
- **Renders:** `h1` "Notification Composer"; card with Audience pills (All Seekers / All Hirers / Both, default Both), Title input, Message textarea (4 rows), "Send Notification" button (disabled until title and message non-empty). On send → `router.push("/notifications/history")`.
- **Data source:** local in-memory class store `notification-store.ts` (`notificationBroadcastStore.send`). No API call; resets on reload.
- **States:** L/E/Er/NP no.
- **Status values:** audience `seekers | hirers | both`.
- **Playwright:** none by path. **Note:** `/notifications` (no suffix) is listed in the redirect test, but there is no `page.tsx` at that path (see section 4).
- **One-off styling:** pill + input markup duplicated from other forms.

#### `/notifications/history` — `.../notifications/history/page.tsx`
- **Purpose:** List sent broadcasts.
- **Type:** compose+history (history half; card list).
- **Renders:** `h1` "Notification History" with "Compose New" link-button; count sentence; card per broadcast: title, audience badge (icon + "All Seekers"/"All Hirers"/"Everyone"), message, sent-at string.
- **Data source:** local store (seeded with 2 entries) with subscribe/notify; client component.
- **States:** E no (count shows 0, empty list), L/Er/NP no.
- **Playwright:** none.
- **One-off styling:** badge uses `bg-kb-primary/10`.

### 2.10 Admin team

#### `/staff` — `.../staff/page.tsx`
- **Purpose:** List admin/support accounts.
- **Type:** list.
- **Renders:** `h1` "Staff" with "Invite Staff" link-button; count sentence; table `grid-cols-[1.6fr_1.6fr_1fr_1fr_20px]`: **Name**, **Email**, **Role**, **Status** pill, chevron.
- **Data source:** mock store `mock-staff.ts` (subscribe/notify); 3 seeded members.
- **States:** none.
- **Status values:** `active | suspended`; roles `Super Admin | Moderator | Support`.
- **Playwright:** redirect test only (`/staff`).
- **One-off styling:** inline-style pill.

#### `/staff/[id]` — `.../staff/[id]/page.tsx`
- **Purpose:** Change a staff member's role; suspend/reinstate.
- **Type:** detail (with inline edit).
- **Renders:** back button; name; email · joined; "Role" card with 3 pill buttons (clicking applies immediately); "Suspend access" / "Reinstate access" button.
- **Data source:** mock store `mock-staff.ts`.
- **States:** "Staff member not found." only.
- **Playwright:** none.

#### `/staff/invite` — `.../staff/invite/page.tsx`
- **Purpose:** Add a staff member.
- **Type:** form/editor.
- **Renders:** back button; `h1` "Invite Staff"; card with Full Name, Email, Role pills (default Support), "Send Invite" button (disabled until name and email non-empty). On submit → `staffStore.invite` then `router.push("/staff")`. No email is sent; no password or backend account is created.
- **Data source:** mock store.
- **Playwright:** none.

#### `/roles` — `.../roles/page.tsx`
- **Purpose:** Show/toggle which permissions Moderator and Support roles have.
- **Type:** settings-style editor.
- **Renders:** `h1` "Roles & Permissions"; 3 cards in a `grid-cols-3`: Super Admin (locked, all 6 permissions shown as green checks), Moderator and Support (each permission is a toggle button with check/X circle). Six permissions: verifications, moderate, suspend, content, broadcast, staff. No Save button.
- **Data source:** local component state (`useState(initialGrants)`); no persistence, and nothing reads these values elsewhere in the app.
- **States:** L/E/Er/NP no.
- **Playwright:** none.
- **One-off styling:** circular check/X icons use `bg-green-100`, `bg-gray-100`, `group-hover:bg-red-100` (Tailwind default palette); toggles are `<button>`s without `role="switch"`/`aria-pressed`.

---

## 3. Grouping

### 3.1 By page type

| Page type | Pages |
|---|---|
| auth | `/login` |
| analytics | `/`, `/analytics` |
| list (queue/directory table) | `/verification`, `/opportunities`, `/reports`, `/seekers`, `/hirers`, `/community`, `/content/articles`, `/events`, `/grants`, `/staff` (10) |
| detail | `/verification/[id]`, `/opportunities/[id]`, `/reports/[id]`, `/seekers/[id]`, `/hirers/[id]`, `/community/[id]`, `/events/[id]`, `/grants/[id]`, `/staff/[id]` (9) |
| form/editor | `/content/articles/[id]` (+ `/new`), `/staff/invite` |
| compose+history | `/notifications/compose`, `/notifications/history` |
| settings-style editor | `/taxonomy/seeker`, `/taxonomy/hirer`, `/taxonomy/grants` (via `TaxonomyManager`), `/roles` |
| other | none |

### 3.2 Pages that could share one reusable layout

**List-page template (10 pages).** All share the same structure: `h1` + subtitle sentence → optional action button in header row → optional filter (pill row, segmented tabs, or search input) → rounded bordered card containing a CSS-grid header row and `Link` rows ending in a chevron column → optional empty message. Differences between them:
- Column templates and cell contents (some have an icon tile in the first cell: community, articles, events, grants; two-line name+sub cell: verification, opportunities, seekers, hirers).
- Filter type: none (community, events, grants, staff, articles), pill row (opportunities, reports), segmented tabs (verification), text search (seekers, hirers).
- Header action button: articles ("New Article"), staff ("Invite Staff").
- Loading state only on verification and opportunities (API-backed).

**Detail-page template (9 pages).** Shared skeleton: back button (`router.push` to list) → header row with title/subtitle on the left and a status pill (sometimes two) on the right → one or two `InfoCard` blocks in `grid-cols-2` → action area (icon buttons per row, or one or two labelled buttons at the bottom) → "not found" fallback. Variants:
- Per-row actions: verification (4 documents), grants (applications), community (posts).
- Bottom action buttons: opportunities (Approve/Reject), reports (Resolve/Dismiss), seekers/hirers (Suspend/Reinstate), staff (Suspend/Reinstate + role pills), community (Remove/Restore channel), events (Cancel).
- Inline-edit sub-forms: events (capacity), staff (role).
- `InfoCard`/`InfoRow` are re-declared identically in 4 detail pages (+`InfoRow` in reports).

**Stat-card block (2 pages).** `/` and `/analytics` each define their own `StatCard` (same container classes; analytics adds a `sub` line).

**Form page (3 pages).** `/staff/invite`, `/notifications/compose`, `/content/articles/[id]` share: bordered card (or bare column), label + input pairs with identical input classes (`h-11 rounded-lg border border-kb-border-input px-3 text-sm ...`), pill-toggle groups (audience, role, status), and a full-width primary button disabled until required fields are non-empty. `/login` uses the same input/button classes.

**Tabbed chip editor.** Already shared via `TaxonomyManager` (3 pages).

**Progress-bar card.** Hand-rolled in `/analytics`, `/events/[id]`, `/grants/[id]`.

**Status pill.** Many inline implementations (map-based or ternary), all `inline-flex w-fit text-xs font-semibold rounded-full px-2.5 py-1` (list) or `px-3 py-1.5` (detail header) with inline `style` colours.

---

## 4. Risks

### 4.1 Tests and hard-coded selectors that depend on markup

All selectors are in `tests/admin.e2e.spec.ts`. (`tests/example.spec.ts` is the Playwright template and targets `playwright.dev`, not this app.) Tests were not run for this audit.

| Selector / assertion | Depends on |
|---|---|
| `page.locator('h1')` contains "Kredibble Admin" | `/login` must keep a single `h1` with this text. |
| `input[type="email"]`, `input[type="password"]` | Login inputs must stay native inputs with these `type` attributes (no id/name/label selectors used). |
| `button[type="submit"]` text "Sign in"; `toBeDisabled()` / `toBeEnabled()` | Login submit button label and its disabled-until-valid behaviour. |
| `text=Invalid admin credentials` | Backend error message string surfaced verbatim in the login error box. |
| `toHaveURL(`${BASE_URL}/`)` after login; `/login` after failure/redirect | Post-login route is `/`; guard redirect target is `/login`. |
| `page.locator('main')` visible | Dashboard layout must keep a `<main>` element. |
| `page.locator('nav, aside')` `toBeVisible()` | Matches both `<aside>` and `<nav>` in the sidebar (two elements). Under Playwright strict mode this locator resolves to more than one element. |
| `text=Dashboard`, `text=Seekers`, `text=Hirers`, `text=Opportunities` | Visible text in the sidebar; `text=Dashboard` also matches the page `h1` as well as the sidebar item, so these are text-substring locators that depend on label copy. |
| Logout test: `button:has-text("Sign out"), button:has-text("Logout"), a:has-text("Sign out"), a:has-text("Logout")` guarded by `if (await logoutButton.isVisible(...))` | The Sidebar button reads "Log Out" (not matched by "Logout" or "Sign out"), so the guarded block is skipped silently today. Changing the label to "Logout" or "Sign out" would activate the assertions. |
| Protected-route redirect list (15 paths): `/seekers /hirers /opportunities /events /grants /verification /reports /community /notifications /analytics /staff /content/articles /taxonomy/seeker /taxonomy/grants /taxonomy/hirer` | Relies on the `(dashboard)` layout's client-side session check. `/notifications` has no `page.tsx` (only `/notifications/compose` and `/notifications/history`), so that path falls outside the dashboard layout. `/roles` and the detail/new routes are not covered. |
| API tests: `POST {API}/auth/admin/login`, `GET {API}/dashboard/summary` with `totalUsers`, `totalOpportunities` in `data` | Backend contract; unaffected by markup but note the dashboard page itself reads different fields (`pendingVerifications`, etc.). |
| Credentials come from E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD in the gitignored .env.test.local (no defaults) | Requires such a seeded admin. |

No `data-testid` attributes exist anywhere in `src`. No test touches any page other than `/login`, `/`, and the redirect checks. Detail pages, forms, taxonomy, roles, staff, notifications compose/history have no test coverage.

### 4.2 Other things that would break or change with markup/class changes

- **Duplicated class strings rather than components.** Table row grid templates appear twice per list page (header and row) and must match; changing columns in one place without the other misaligns them. Status pill colours are duplicated across many inline implementations; `STATUS_STYLES` for the same enum is duplicated between list and detail pages (verification, opportunities, reports, community, hirers).
- **Token consumers.** All colour utilities resolve through `--color-kb-*` in `globals.css`. Renaming a token breaks every `bg-kb-*`/`text-kb-*`/`border-kb-*` usage (silently, since Tailwind v4 drops unknown utilities). Two already-undefined tokens (`kb-bg-body`, `kb-bg-muted`) show this failure mode.
- **Hex literals bypass tokens.** Inline `style` colours in status pills, stat-card icon tiles, type colours, progress bars, and `color=` props on icons will not follow any token/theme change.
- **Sidebar active matching** is exact-path only; detail routes show no active nav item.
- **Dashboard text** (`"Real-time platform overview fetched from the live database."`, quick-link subtitles) is hard-coded around summary fields; the `StatCard`/quick-link layout assumes `grid-cols-3` and `grid-cols-2` with no responsive breakpoints.
- **Fixed layout.** `w-64` sidebar plus `p-8` main with fixed-column grids and no breakpoints; table grids use fixed fr templates plus a `20px` chevron column.
- **Session gate is client-side.** `(dashboard)/layout.tsx` renders "Checking admin session..." on first paint for every dashboard route; any change to this flow affects the redirect tests.
- **Server vs client mix.** Eight pages are server components (analytics, community list, articles list, events list, grants list, three taxonomy wrappers); everything with state, router hooks or stores is a client component. Moving state/hooks into them changes their boundary.
- **Data/API mismatches that affect any redesign of list→detail flows:** `/verification` and `/opportunities` lists are API-backed, but their `[id]` pages read mock data by id, and `updateVerificationStatus` is unused. Every mutation button on detail pages changes only local state and is lost on navigation. Staff, notifications, taxonomy and roles are in-memory only.
- **Accessibility-relevant markup present today:** icon-only buttons rely on `title` (no `aria-label`), form labels are not associated with inputs (no `htmlFor`/`id`), pill toggles lack `aria-pressed`, rows are `div` grids rather than `<table>` semantics. (Listed only because markup changes would affect these.)
- **Unused artifacts:** `clsx` dependency, `design-tokens.ts`, `updateVerificationStatus`, default Next SVGs in `public/`, `built: false` branch of nav/Sidebar.

### 4.3 Pages with heavy custom UI

None use drag-and-drop, a rich-text editor, a charting library, modals, or drawers. The most custom interaction UI is:

| Page | Custom UI |
|---|---|
| `/content/articles/[id]` | Programmatic file picker (`document.createElement("input")`), blob-URL image preview with overlay Remove/Replace buttons; plain-textarea body (no rich editor); four pill-toggle/field groups. |
| `/analytics` | Hand-rolled horizontal bar chart (`div` widths from computed counts, inline colours). |
| `/events/[id]`, `/grants/[id]` | Hand-rolled progress bars; grants recomputes allocated total and disables approve buttons based on remaining pool. |
| `/verification/[id]` | Per-document approve/reject with derived overall status. |
| `/community/[id]` | Per-post remove with flagged-card styling; channel remove/restore toggle. |
| `/roles` | 3-column permission matrix with per-cell toggle buttons. |
| `TaxonomyManager` | Tab state + add/remove chips with Enter-key handling and dedupe. |
| `/notifications/history`, `/staff*` | Subscribe/notify in-memory stores driving re-renders via `useEffect` subscriptions. |
