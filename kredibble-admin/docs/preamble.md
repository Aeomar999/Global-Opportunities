CONTEXT
App: kredibble-admin (Next.js, Tailwind v4). FRONTEND AND UI/UX ONLY. Do not touch backend
code or API contracts. Do not edit package.json or the lockfile (list needed changes for me instead).
Do not commit or push. Read docs/design-brief.md FIRST. It is the single source for every visual
decision (color, type, spacing, shape, components). Never hard-code hex or arbitrary pixel values in
pages. Read docs/ui-audit.md for the page inventory.

RULES
- Preserve behavior: routes, data sources (real API vs mock vs local state) and Playwright selectors.
  If a markup change breaks a test, update the test and say so.
- Keep existing copy and table columns unless told otherwise.
- Every data block has loading (skeleton matching the final shape), empty and error (retry) states,
  with no layout shift. Never render 0 for unknown values; show "—".
- Accessibility and responsive rules come from the brief, section 8.
- Readable, well-commented code. Each new component gets a header comment (purpose, props).
- Before building a NEW kind of component, search the "21st" MCP for 2-3 candidates. Take structure
  and accessibility ideas only and restyle fully to the brief. Never keep a library's colors, fonts or
  radii. If a new dependency is clearly worth it, list it (name, size, reason) and ask.
- Never print, log or write a password, API key or credential anywhere (code, tests, reports, traces).
  Test credentials live in .env.test.local (gitignored). Tests reuse the saved session and add no new
  logins; a full run makes at most two.
- Do not start extra dev servers. Git checks are read-only: no git rm, reset, add, commit or checkout.

DELIVERY
Run lint, build and the Playwright suite. Report results, files changed, anything you could not match,
and any deviation from this prompt.
