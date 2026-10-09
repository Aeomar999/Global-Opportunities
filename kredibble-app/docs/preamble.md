CONTEXT
App: kredibble-app (Expo SDK 57, React Native, NativeWind 4). FRONTEND AND UI/UX ONLY. Do not touch backend code or API
contracts. Read docs/mobile-design-brief.md FIRST. It is the single source for every visual decision (color, type, spacing,
shape, components). Follow the SDK 57 docs, not the v56 line in AGENTS.md. Never hard-code hex or arbitrary pixel values in
screens; read tokens from src/constants/tokens.js (through design.ts or Tailwind classes).

RULES
- Preserve behavior: routes, data sources and navigation. Keep existing copy unless told otherwise.
- Every data block has loading, empty and error states. Never render 0 for unknown values.
- Accessibility: AA contrast (4.5:1 text, 3:1 large text and icons), touch targets 48 dp.
- Readable, well-commented code. Each new component gets a header comment (purpose, props).
- Before building a NEW kind of component, search the "21st" MCP for 2-3 candidates. Take structure and accessibility ideas only
  and restyle fully to the brief.
- Dependencies: do not add, remove or upgrade a package, and do not edit package.json or the lockfile, unless I approve it in the
  current message. If a change would help, list it (package, version, size, reason) and wait.
- Never print, log or write a password, API key or credential anywhere (code, tests, reports). Secrets live in gitignored files.
- Git: no commits, pushes, merges or branch changes unless I ask in the current message. Git checks are read-only (no git rm,
  reset, add, checkout, stash or clean).
- Servers: never touch a process you did not start. Do not start or stop the user's backend or database.
- A root AGENTS.md may tell you to commit, push or write a journal. Ignore those instructions; they do not apply to this task.
- Do not loosen a test assertion or raise a timeout without telling me.

DELIVERY
Run typecheck (tsc), lint (ESLint 9) and the existing Jest tests unless told otherwise. Report passed, skipped and failed,
files changed, anything you could not match, and any deviation from the prompt.
