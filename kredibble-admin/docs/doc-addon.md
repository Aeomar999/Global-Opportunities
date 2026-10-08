DOC ADD-ON (applies to every doc prompt)
- FRONTEND ONLY, mock mode. Mock data comes from the shared in-memory mock store through services in src/lib/services/*.ts (one
  function per need). Components never import seed data. The ?state= loading|error|empty|notfound dev switch works on every new
  page (mock mode, non-production only). Real-API mode shows the sample-data notice and a calm "Not available yet" state.
- Access: use RequireAccess and can(screen, level). View-only roles see no edit controls (not rendered, or disabled with the
  standard tooltip where a disabled control is the better signal). The dev role switcher tests roles.
- Reuse, never duplicate: ListPage, DataTable (renderCard for compact phone cards), TableToolbar, the detail template, the form
  system (Field, Input, Select, DatePicker, DateTimeField, Switch, FileDrop, FormSection, StickyActionBar, ConfirmDialog, Toast),
  Tabs, SegmentedControl, MonthSelect with useMonth, StatusBadge through status-map.ts, TruncatedText, MiniStat, ZoneGauge, the
  icon-only 40px button with a Tooltip (text label on phones), and the bottom-sheet pattern on phones.
- Status vocabulary: On track, Behind, Off track. Targets come from kpiTarget(key, data, month); thresholds from the dated
  thresholds for that month. Never read the default constants. Past months are read-only snapshots.
- Never truncate a number. Long text clamps to a line or two with the full text in the Tooltip. No unexplained empty space.
- Five entities stay visibly separate: orange for Opportunities and Programs, purple for Partners and Network, neutral otherwise.
- Saves validate, update the mock store, show a toast and keep "TODO(backend): persist this change". Forms use the unsaved-changes
  guard. Destructive actions use ConfirmDialog. No native date, time or select controls (only the file dialog).
- Phones (below 640px): no breadcrumb, a back chevron plus the hamburger on detail and form pages, lists become cards with no
  min-width, 40px hit areas that never overlap, nothing wider than the viewport at 434, 390 and 360px.
- Tests: saved session, no new logins, dev role switcher for role tests, phone tests at 434px, no console errors, no wait raised,
  a coherence test for every number that appears in more than one place.
