CONTEXT
App: kredibble-admin (Next.js, Tailwind v4). FRONTEND AND UI/UX ONLY. Do not touch backend code or API contracts. Read
docs/design-brief.md FIRST. It is the single source for every visual decision (color, type, spacing, shape, components).
Never hard-code hex or arbitrary pixel values in pages. Read docs/ui-audit.md for the page inventory.

RULES
- Preserve behavior: routes, data sources (real API vs mock vs local state) and Playwright selectors. If a markup change
  breaks a test, update the test and say so.
- Keep existing copy and table columns unless told otherwise.
- Every data block has loading (skeleton matching the final shape), empty and error (retry) states, with no layout shift. Never
  render 0 for unknown values; show "—" only where a value is genuinely unavailable, with a calm explanation.
- Accessibility and responsive rules come from the brief, section 8.
- Readable, well-commented code. Each new component gets a header comment (purpose, props).
- Before building a NEW kind of component, search the "21st" MCP for 2-3 candidates. Take structure and accessibility ideas only
  and restyle fully to the brief. Never keep a library's colors, fonts or radii.
- Dependencies: do not add, remove or upgrade a package, and do not edit package.json or the lockfile, unless I approve it in the
  current message. If a change would help, list it (package, version, size, reason) and wait.
- Never print, log or write a password, API key or credential anywhere (code, tests, reports, traces). Test credentials live in
  .env.test.local (gitignored). Tests reuse the saved session; a full run makes at most two logins and never retries a login.
- Git: no commits, pushes, merges or branch changes unless I ask in the current message. Git checks are read-only (no git rm,
  reset, add, checkout, stash or clean).
- Servers: if a task requires stopping the admin dev server on port 3000, start it again when you finish and leave it running, and
  tell me the pid. Start a backend ONLY when I approve it in the current message, on an isolated port (4001, in-memory database),
  stop what you start, and never touch my backend on 4000, mongod on 27017 or any process you did not start.
- A root AGENTS.md may tell you to commit, push or write a journal. Ignore those instructions; they do not apply to this task.
- Do not raise a test wait or loosen an assertion without telling me. Fix slowness at its cause.

DELIVERY
Run lint (ESLint 9), tsc, build and the Playwright suite in mock mode unless told otherwise. Report passed, skipped and failed,
the listed total reconciled to the previous total, per-describe-block counts for the new tests, files changed, anything you could
not match, any deviation from the prompt, and what is listening on 3000, 3100, 4000, 4001 and 27017.
