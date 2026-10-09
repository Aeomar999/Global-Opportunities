DOC ADD-ON (applies to every doc prompt)
- Mobile app, frontend only. Reuse the shared components in src/components/ui (Button, InputField, Header, ToastProvider,
  DateTimePickerModal, Collapsible) instead of duplicating them.
- Colour roles: purple for structure (navigation, selection, links, charts), orange as the single accent (icons, dots, badges
  only; a filled orange button uses accent-600 with white text; orange text uses accent-700). Never orange text on white and
  never white text on #FC5E24.
- Fonts: Plus Jakarta Sans for screen titles, auth headings, the onboarding hero and key figures; Inter for everything else.
- Never truncate a number. Long text clamps to a line or two. No unexplained empty space.
- Destructive actions ask for confirmation. Forms keep their existing validation.
- Light mode only for now.
- Check screens on the Android emulator (Expo Go, Metro on 8081, `adb reverse tcp:8081 tcp:8081` if bundling hangs at 99%).
