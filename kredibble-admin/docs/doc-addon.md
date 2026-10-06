DOC ADD-ON (applies to every doc prompt)
- Read docs/design-brief.md. Never use the legacy kb-* aliases in new code. Never print or write a password.
- FRONTEND ONLY. Mock data only, from the shared in-memory mock store through services in
  src/lib/services/*.ts (one function per need). Components never import seed data. The ?state=
  loading|error|empty|notfound dev switch works on every new page (mock mode, non-production only).
- Access: use RequireAccess and can(screen, level) from the roles step. View-only roles see no edit
  actions; disabled controls get a tooltip "Your role can view this page but not change it".
- Reuse, never duplicate: ListPage, DataTable, TableToolbar, the detail template (DetailPage, DetailHeader,
  InfoCard, KeyValueList, MiniStat, DangerZone), the form system (Field, Input, Textarea, Select, Switch,
  FileDrop, FormSection, StickyActionBar, ConfirmDialog, Toast), Tabs, SegmentedControl, MonthSelect,
  StatusBadge through status-map.ts. Search the "21st" MCP for 2-3 candidates before building a new kind of
  component and restyle to our tokens.
- Five entities stay visibly separate (own columns, icon tile, accent): orange for Opportunities and
  Programs, purple for Partners and Network. Database records and Social use neutral tiles.
- Saves validate, update the mock store, show a toast and keep "TODO(backend): persist this change". Forms use
  the unsaved-changes guard. Destructive actions use ConfirmDialog.
- Phones (below 640px): no breadcrumb, a back chevron plus the hamburger on detail and form pages, lists
  become cards with no min-width, 40px hit areas that never overlap, nothing wider than the viewport.
- Tests: saved session, no new logins. Role-gating tests use the dev role switcher. Phone tests at 434px.
  No console errors. No unexplained jump in test count.
- DELIVERY: run lint, build and the Playwright suite. Report results, files changed and anything you could
  not match. No commits, no pushes, no package.json or lockfile edits (list needed changes instead).
