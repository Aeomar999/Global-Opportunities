# Step 1b plan: hard-coded hex values that remain

Generated at the end of Step 1a by a read-only scan of `src`. These are the literals left in screens and components after the foundation step. Step 1b replaces each with the token shown, **screen by screen**, and reviews the "or" cases by looking at the element (text vs icon vs background).

Excluded: files already converted in Step 1a, and the 13 dead template files (they are deleted in Step 2; their counts are listed at the end).

- Live files still containing hex: **51**, **1193** occurrences.
- Also: `rgba(...)` literals are not counted here (mostly black/white overlays and the old purple-blue at 10-12 % opacity: `rgba(102, 113, 228, x)` becomes `rgba(121, 46, 164, x)` or a purple tint token).
- Also: `text-[#...]` / `bg-[#...]` arbitrary Tailwind classes are counted as hex above and become named classes.

## 1. By token (what the 1193 values become)

| Token (design.ts `Colors`) | Occurrences |
|---|---|
| textMuted | 238 |
| white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard) | 210 |
| textBody | 195 |
| textPlaceholder (placeholder/icon) or textMuted | 100 |
| borderDefault | 91 |
| bgScreen (page) or bgAlt (inset) | 54 |
| borderInput (input/control edge) or divider (decorative line) | 53 |
| textBody (text) or black (shadow) | 44 |
| successDot (icon/dot) or success (text) | 35 |
| error (text) or errorDot (icon/dot) | 29 |
| warningSoft (background, dark text) or warningDot (icon) | 18 |
| errorDot | 17 |
| successTint | 16 |
| successDot | 14 |
| radioUnselected (borderInput) | 10 |
| bgScreen | 9 |
| bgAlt | 8 |
| warningDot | 8 |
| white / bgCard | 8 |
| DECIDE (blue info colour; suggest purple400) | 5 |
| errorTint | 5 |
| borderInput | 4 |
| bgDefault (bgScreen) | 3 |
| keep? (Pinterest brand) | 2 |
| keep? (OpenSea brand) | 2 |
| DECIDE (cyan; no token) | 2 |
| warningTint | 2 |
| success (text) | 2 |
| keep (Google brand) | 2 |
| keep? (third-party brand) | 1 |
| purple400 | 1 |
| DECIDE (blue; suggest purple400) | 1 |
| warning (text) | 1 |
| successTint (border: borderDefault) | 1 |
| warningTint (border) | 1 |
| accent500 (icon, dot, badge only) | 1 |

## 2. By file

Format: `hex ×count → token`. Files are sorted by count; the order of work follows the screen groups in the brief (section 7), not this order.

### src/app/(auth)/signup.tsx (108)
- `#a1a1aa` ×27 → textPlaceholder (placeholder/icon) or textMuted
- `#ffffff` ×23 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#ebebee` ×17 → borderInput (input/control edge) or divider (decorative line)
- `#1a1a1a` ×16 → textBody
- `#8a8d9f` ×7 → textMuted
- `#c0c0c8` ×4 → borderInput
- `#f5f6fa` ×3 → bgAlt
- `#d0d0d8` ×2 → borderDefault
- `#595959` ×2 → textMuted
- `#f7f7f9` ×2 → bgScreen (page) or bgAlt (inset)
- `#c4c4c4` ×1 → radioUnselected (borderInput)
- `#e5e6f2` ×1 → borderDefault
- `#dc2626` ×1 → errorDot
- `#ed4c5c` ×1 → error (text) or errorDot (icon/dot)
- `#e0e0e0` ×1 → borderDefault

### src/app/(auth)/login.tsx (79)
- `#ffffff` ×15 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#8a8d9f` ×12 → textMuted
- `#1a1a1a` ×12 → textBody
- `#a1a1aa` ×12 → textPlaceholder (placeholder/icon) or textMuted
- `#ebebee` ×11 → borderInput (input/control edge) or divider (decorative line)
- `#ed4c5c` ×6 → error (text) or errorDot (icon/dot)
- `#000000` ×4 → textBody (text) or black (shadow)
- `#f7f7f9` ×2 → bgScreen (page) or bgAlt (inset)
- `#16a34a` ×2 → successDot (icon/dot) or success (text)
- `#c4c4c4` ×1 → radioUnselected (borderInput)
- `#e0e0e0` ×1 → borderDefault
- `#f5f6fa` ×1 → bgAlt

### src/app/opportunities/[id].tsx (73)
- `#8a8d9f` ×24 → textMuted
- `#1a1a1a` ×20 → textBody
- `#ffffff` ×5 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#f0f0f2` ×5 → borderDefault
- `#000000` ×3 → textBody (text) or black (shadow)
- `#f7f7f9` ×2 → bgScreen (page) or bgAlt (inset)
- `#e5e6f2` ×2 → borderDefault
- `#f0f0f3` ×2 → borderDefault
- `#16a34a` ×2 → successDot (icon/dot) or success (text)
- `#10b981` ×1 → successDot
- `#ef4444` ×1 → errorDot
- `#5e6175` ×1 → textMuted
- `#a1a1aa` ×1 → textPlaceholder (placeholder/icon) or textMuted
- `#8c8f9f` ×1 → textMuted
- `#7f8295` ×1 → textMuted
- `#f3f4f6` ×1 → bgScreen
- `#e8fdf0` ×1 → successTint

### src/app/(tabs)/profile.tsx (60)
- `#8a8d9f` ×28 → textMuted
- `#ed4c5c` ×7 → error (text) or errorDot (icon/dot)
- `#ffffff` ×6 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#1a1a1a` ×6 → textBody
- `#16a34a` ×4 → successDot (icon/dot) or success (text)
- `#dcfce7` ×2 → successTint
- `#ebebee` ×2 → borderInput (input/control edge) or divider (decorative line)
- `#000` ×2 → textBody (text) or black (shadow)
- `#e5e6f2` ×1 → borderDefault
- `#f7f7f9` ×1 → bgScreen (page) or bgAlt (inset)
- `#f3f3f3` ×1 → bgDefault (bgScreen)

### src/app/(tabs)/opportunities.tsx (52)
- `#ffffff` ×12 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#8a8d9f` ×11 → textMuted
- `#1a1a1a` ×6 → textBody
- `#f7f7f9` ×4 → bgScreen (page) or bgAlt (inset)
- `#e5e6f2` ×4 → borderDefault
- `#f87171` ×2 → errorDot
- `#60a5fa` ×2 → DECIDE (blue info colour; suggest purple400)
- `#34d399` ×2 → successDot
- `#000` ×2 → textBody (text) or black (shadow)
- `#16a34a` ×2 → successDot (icon/dot) or success (text)
- `#e60023` ×1 → keep? (Pinterest brand)
- `#2081e2` ×1 → keep? (OpenSea brand)
- `#da552f` ×1 → keep? (third-party brand)
- `#dcfce7` ×1 → successTint
- `#a1a1aa` ×1 → textPlaceholder (placeholder/icon) or textMuted

### src/app/(tabs)/community.tsx (46)
- `#1a1a1a` ×10 → textBody
- `#8a8d9f` ×8 → textMuted
- `#ffffff` ×8 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#e5e6f2` ×7 → borderDefault
- `#a1a1aa` ×7 → textPlaceholder (placeholder/icon) or textMuted
- `#4a4d5f` ×3 → textMuted
- `#f7f7f9` ×1 → bgScreen (page) or bgAlt (inset)
- `#000` ×1 → textBody (text) or black (shadow)
- `#f3f4f6` ×1 → bgScreen

### src/app/(tabs)/index.tsx (44)
- `#8a8d9f` ×10 → textMuted
- `#1a1a1a` ×9 → textBody
- `#ffffff` ×8 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#ebebee` ×7 → borderInput (input/control edge) or divider (decorative line)
- `#f7f7f9` ×3 → bgScreen (page) or bgAlt (inset)
- `#a1a1aa` ×2 → textPlaceholder (placeholder/icon) or textMuted
- `#ed4c5c` ×1 → error (text) or errorDot (icon/dot)
- `#16a34a` ×1 → successDot (icon/dot) or success (text)
- `#000` ×1 → textBody (text) or black (shadow)
- `#e0e0e6` ×1 → borderDefault
- `#b0b0bc` ×1 → textMuted

### src/app/opportunities/create.tsx (42)
- `#8a8d9f` ×8 → textMuted
- `#ffffff` ×7 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#1a1a1a` ×6 → textBody
- `#f3f4f6` ×5 → bgScreen
- `#a1a1aa` ×5 → textPlaceholder (placeholder/icon) or textMuted
- `#e5e6f2` ×3 → borderDefault
- `#000000` ×3 → textBody (text) or black (shadow)
- `#34d399` ×1 → successDot
- `#f87171` ×1 → errorDot
- `#fbbf24` ×1 → warningDot
- `#f7f7f9` ×1 → bgScreen (page) or bgAlt (inset)
- `#f0f0f3` ×1 → borderDefault

### src/app/profile/edit.tsx (39)
- `#1a1a1a` ×10 → textBody
- `#8a8d9f` ×10 → textMuted
- `#ffffff` ×7 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#ed4c5c` ×4 → error (text) or errorDot (icon/dot)
- `#e5e6f2` ×3 → borderDefault
- `#ebebee` ×3 → borderInput (input/control edge) or divider (decorative line)
- `#f7f7f9` ×2 → bgScreen (page) or bgAlt (inset)

### src/app/assistant/index.tsx (36)
- `#ffffff` ×8 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#1a1a1a` ×6 → textBody
- `#fbbf24` ×3 → warningDot
- `#9ca3af` ×3 → textMuted
- `#8a8d9f` ×3 → textMuted
- `#000000` ×2 → textBody (text) or black (shadow)
- `#f8f9fa` ×2 → bgAlt
- `#000` ×2 → textBody (text) or black (shadow)
- `#e5e7eb` ×2 → borderDefault
- `#00bcd4` ×1 → DECIDE (cyan; no token)
- `#e5e6f2` ×1 → borderDefault
- `#f3f4f6` ×1 → bgScreen
- `#ebebee` ×1 → borderInput (input/control edge) or divider (decorative line)
- `#f0f0f3` ×1 → borderDefault

### src/app/hirer-profile/security.tsx (35)
- `#1a1a1a` ×7 → textBody
- `#8a8d9f` ×7 → textMuted
- `#ffffff` ×6 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#ed4c5c` ×4 → error (text) or errorDot (icon/dot)
- `#e5e6f2` ×4 → borderDefault
- `#ebebee` ×2 → borderInput (input/control edge) or divider (decorative line)
- `#16a34a` ×1 → successDot (icon/dot) or success (text)
- `#f7f7f9` ×1 → bgScreen (page) or bgAlt (inset)
- `#ffeaea` ×1 → errorTint
- `#000` ×1 → textBody (text) or black (shadow)
- `#f3f3f3` ×1 → bgDefault (bgScreen)

### src/app/profile/manage.tsx (35)
- `#8a8d9f` ×11 → textMuted
- `#1a1a1a` ×6 → textBody
- `#ffffff` ×4 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#e5e6f2` ×3 → borderDefault
- `#ebebee` ×3 → borderInput (input/control edge) or divider (decorative line)
- `#f6b612` ×2 → warningSoft (background, dark text) or warningDot (icon)
- `#16a34a` ×2 → successDot (icon/dot) or success (text)
- `#f7f7f9` ×1 → bgScreen (page) or bgAlt (inset)
- `#dcfce7` ×1 → successTint
- `#333333` ×1 → textBody
- `#000` ×1 → textBody (text) or black (shadow)

### src/app/profile/security.tsx (35)
- `#1a1a1a` ×7 → textBody
- `#8a8d9f` ×7 → textMuted
- `#ffffff` ×6 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#ed4c5c` ×4 → error (text) or errorDot (icon/dot)
- `#e5e6f2` ×4 → borderDefault
- `#ebebee` ×2 → borderInput (input/control edge) or divider (decorative line)
- `#16a34a` ×1 → successDot (icon/dot) or success (text)
- `#f7f7f9` ×1 → bgScreen (page) or bgAlt (inset)
- `#ffeaea` ×1 → errorTint
- `#000` ×1 → textBody (text) or black (shadow)
- `#f3f3f3` ×1 → bgDefault (bgScreen)

### src/app/grants/index.tsx (34)
- `#ffffff` ×6 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#8a8d9f` ×6 → textMuted
- `#1a1a1a` ×4 → textBody
- `#e5e6f2` ×3 → borderDefault
- `#f7f7f9` ×2 → bgScreen (page) or bgAlt (inset)
- `#16a34a` ×2 → successDot (icon/dot) or success (text)
- `#000` ×2 → textBody (text) or black (shadow)
- `#a1a1aa` ×2 → textPlaceholder (placeholder/icon) or textMuted
- `#f87171` ×1 → errorDot
- `#60a5fa` ×1 → DECIDE (blue info colour; suggest purple400)
- `#34d399` ×1 → successDot
- `#fee2e2` ×1 → errorTint
- `#dc2626` ×1 → errorDot
- `#dcfce7` ×1 → successTint
- `#fff` ×1 → white / bgCard

### src/app/internships/index.tsx (34)
- `#8a8d9f` ×7 → textMuted
- `#ffffff` ×6 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#1a1a1a` ×4 → textBody
- `#e5e6f2` ×3 → borderDefault
- `#34d399` ×2 → successDot
- `#f7f7f9` ×2 → bgScreen (page) or bgAlt (inset)
- `#000` ×2 → textBody (text) or black (shadow)
- `#16a34a` ×2 → successDot (icon/dot) or success (text)
- `#a1a1aa` ×2 → textPlaceholder (placeholder/icon) or textMuted
- `#f87171` ×1 → errorDot
- `#60a5fa` ×1 → DECIDE (blue info colour; suggest purple400)
- `#dcfce7` ×1 → successTint
- `#fff` ×1 → white / bgCard

### src/app/profile/saved.tsx (34)
- `#8a8d9f` ×8 → textMuted
- `#ffffff` ×6 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#1a1a1a` ×3 → textBody
- `#f7f7f9` ×2 → bgScreen (page) or bgAlt (inset)
- `#e5e6f2` ×2 → borderDefault
- `#ebebee` ×2 → borderInput (input/control edge) or divider (decorative line)
- `#16a34a` ×2 → successDot (icon/dot) or success (text)
- `#e8f5e9` ×2 → successTint
- `#2e7d32` ×2 → success (text)
- `#34d399` ×1 → successDot
- `#000` ×1 → textBody (text) or black (shadow)
- `#dcfce7` ×1 → successTint
- `#ffeaea` ×1 → errorTint
- `#ff4d4d` ×1 → errorDot

### src/app/jobs/index.tsx (33)
- `#8a8d9f` ×7 → textMuted
- `#ffffff` ×6 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#1a1a1a` ×4 → textBody
- `#e5e6f2` ×3 → borderDefault
- `#f7f7f9` ×2 → bgScreen (page) or bgAlt (inset)
- `#000` ×2 → textBody (text) or black (shadow)
- `#16a34a` ×2 → successDot (icon/dot) or success (text)
- `#a1a1aa` ×2 → textPlaceholder (placeholder/icon) or textMuted
- `#f87171` ×1 → errorDot
- `#60a5fa` ×1 → DECIDE (blue info colour; suggest purple400)
- `#34d399` ×1 → successDot
- `#dcfce7` ×1 → successTint
- `#fff` ×1 → white / bgCard

### src/app/profile/applications.tsx (32)
- `#8a8d9f` ×7 → textMuted
- `#ffffff` ×6 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#1a1a1a` ×3 → textBody
- `#ed4c5c` ×2 → error (text) or errorDot (icon/dot)
- `#f7f7f9` ×2 → bgScreen (page) or bgAlt (inset)
- `#e5e6f2` ×2 → borderDefault
- `#dcfce7` ×1 → successTint
- `#16a34a` ×1 → successDot (icon/dot) or success (text)
- `#ffeaea` ×1 → errorTint
- `#fef3c7` ×1 → warningTint
- `#d97706` ×1 → warningDot
- `#00bcd4` ×1 → DECIDE (cyan; no token)
- `#e60023` ×1 → keep? (Pinterest brand)
- `#2081e2` ×1 → keep? (OpenSea brand)
- `#ebebee` ×1 → borderInput (input/control edge) or divider (decorative line)
- `#000` ×1 → textBody (text) or black (shadow)

### src/app/hirer-profile/company.tsx (26)
- `#8a8d9f` ×9 → textMuted
- `#ffffff` ×8 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#1a1a1a` ×4 → textBody
- `#e5e6f2` ×3 → borderDefault
- `#f7f7f9` ×1 → bgScreen (page) or bgAlt (inset)
- `#ebebee` ×1 → borderInput (input/control edge) or divider (decorative line)

### src/app/jobs/filter.tsx (26)
- `#a1a1aa` ×8 → textPlaceholder (placeholder/icon) or textMuted
- `#ffffff` ×7 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#1a1a1a` ×4 → textBody
- `#f7f7f9` ×2 → bgScreen (page) or bgAlt (inset)
- `#c4c4c4` ×1 → radioUnselected (borderInput)
- `#8a8d9f` ×1 → textMuted
- `#fff` ×1 → white / bgCard
- `#000` ×1 → textBody (text) or black (shadow)
- `#e5e6f2` ×1 → borderDefault

### src/app/grants/filter.tsx (24)
- `#a1a1aa` ×8 → textPlaceholder (placeholder/icon) or textMuted
- `#1a1a1a` ×5 → textBody
- `#ffffff` ×4 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#f7f7f9` ×2 → bgScreen (page) or bgAlt (inset)
- `#c4c4c4` ×1 → radioUnselected (borderInput)
- `#8a8d9f` ×1 → textMuted
- `#fff` ×1 → white / bgCard
- `#e5e6f2` ×1 → borderDefault
- `#000` ×1 → textBody (text) or black (shadow)

### src/app/hirer-profile/verification.tsx (24)
- `#8a8d9f` ×5 → textMuted
- `#1a1a1a` ×3 → textBody
- `#16a34a` ×3 → successDot (icon/dot) or success (text)
- `#e5e6f2` ×2 → borderDefault
- `#ffffff` ×2 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#f6b612` ×1 → warningSoft (background, dark text) or warningDot (icon)
- `#b7791f` ×1 → warning (text)
- `#f7f7f9` ×1 → bgScreen (page) or bgAlt (inset)
- `#f0fdf4` ×1 → successTint
- `#bbf7d0` ×1 → successTint (border: borderDefault)
- `#fffbeb` ×1 → warningTint
- `#fde68a` ×1 → warningTint (border)
- `#f5f6fa` ×1 → bgAlt
- `#dcfce7` ×1 → successTint

### src/app/internships/filter.tsx (24)
- `#a1a1aa` ×8 → textPlaceholder (placeholder/icon) or textMuted
- `#ffffff` ×6 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#1a1a1a` ×4 → textBody
- `#f7f7f9` ×2 → bgScreen (page) or bgAlt (inset)
- `#c4c4c4` ×1 → radioUnselected (borderInput)
- `#8a8d9f` ×1 → textMuted
- `#fff` ×1 → white / bgCard
- `#000` ×1 → textBody (text) or black (shadow)

### src/app/experts/[id].tsx (21)
- `#f6b612` ×11 → warningSoft (background, dark text) or warningDot (icon)
- `#16a34a` ×4 → successDot (icon/dot) or success (text)
- `#ffffff` ×2 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#c4c4c4` ×1 → radioUnselected (borderInput)
- `#000000` ×1 → textBody (text) or black (shadow)
- `#dcfce7` ×1 → successTint
- `#000` ×1 → textBody (text) or black (shadow)

### src/app/hirer-profile/postings.tsx (18)
- `#8a8d9f` ×5 → textMuted
- `#1a1a1a` ×3 → textBody
- `#ffffff` ×3 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#e5e6f2` ×2 → borderDefault
- `#f59e0b` ×1 → warningDot
- `#10b981` ×1 → successDot
- `#ef4444` ×1 → errorDot
- `#a1a1aa` ×1 → textPlaceholder (placeholder/icon) or textMuted
- `#f7f7f9` ×1 → bgScreen (page) or bgAlt (inset)

### src/app/hirer-profile/recruiter.tsx (17)
- `#8a8d9f` ×6 → textMuted
- `#1a1a1a` ×4 → textBody
- `#ffffff` ×3 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#e5e6f2` ×2 → borderDefault
- `#f7f7f9` ×1 → bgScreen (page) or bgAlt (inset)
- `#ebebee` ×1 → borderInput (input/control edge) or divider (decorative line)

### src/app/notifications/index.tsx (16)
- `#1a1a1a` ×3 → textBody
- `#ffffff` ×3 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#8a8d9f` ×2 → textMuted
- `#e5e6f2` ×2 → borderDefault
- `#10b981` ×1 → successDot
- `#f59e0b` ×1 → warningDot
- `#16a34a` ×1 → successDot (icon/dot) or success (text)
- `#f7f7f9` ×1 → bgScreen (page) or bgAlt (inset)
- `#595959` ×1 → textMuted
- `#a1a1aa` ×1 → textPlaceholder (placeholder/icon) or textMuted

### src/app/community/feed.tsx (13)
- `#ef4444` ×5 → errorDot
- `#ffffff` ×2 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#8b5cf6` ×1 → purple400
- `#10b981` ×1 → successDot
- `#f59e0b` ×1 → warningDot
- `#3b82f6` ×1 → DECIDE (blue; suggest purple400)
- `#e5e6f2` ×1 → borderDefault
- `#e5e7eb` ×1 → borderDefault

### src/app/hirer-profile/notifications.tsx (13)
- `#e5e6f2` ×3 → borderDefault
- `#ffffff` ×3 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#1a1a1a` ×3 → textBody
- `#f7f7f9` ×2 → bgScreen (page) or bgAlt (inset)
- `#8a8d9f` ×1 → textMuted
- `#000` ×1 → textBody (text) or black (shadow)

### src/app/profile/notifications.tsx (13)
- `#e5e6f2` ×3 → borderDefault
- `#ffffff` ×3 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#1a1a1a` ×3 → textBody
- `#f7f7f9` ×2 → bgScreen (page) or bgAlt (inset)
- `#8a8d9f` ×1 → textMuted
- `#000` ×1 → textBody (text) or black (shadow)

### src/app/hirer-profile/channels.tsx (12)
- `#1a1a1a` ×3 → textBody
- `#8a8d9f` ×3 → textMuted
- `#e5e6f2` ×2 → borderDefault
- `#ffffff` ×2 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#a1a1aa` ×1 → textPlaceholder (placeholder/icon) or textMuted
- `#f7f7f9` ×1 → bgScreen (page) or bgAlt (inset)

### src/app/recommended/index.tsx (12)
- `#1a1a1a` ×3 → textBody
- `#16a34a` ×2 → successDot (icon/dot) or success (text)
- `#8a8d9f` ×2 → textMuted
- `#34d399` ×1 → successDot
- `#f7f7f9` ×1 → bgScreen (page) or bgAlt (inset)
- `#e5e6f2` ×1 → borderDefault
- `#ffffff` ×1 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#dcfce7` ×1 → successTint

### src/app/grants/search.tsx (11)
- `#1a1a1a` ×3 → textBody
- `#a1a1aa` ×3 → textPlaceholder (placeholder/icon) or textMuted
- `#f7f7f9` ×1 → bgScreen (page) or bgAlt (inset)
- `#ffffff` ×1 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#000` ×1 → textBody (text) or black (shadow)
- `#8a8d9f` ×1 → textMuted
- `#e5e6f2` ×1 → borderDefault

### src/app/internships/search.tsx (11)
- `#1a1a1a` ×3 → textBody
- `#a1a1aa` ×3 → textPlaceholder (placeholder/icon) or textMuted
- `#f7f7f9` ×1 → bgScreen (page) or bgAlt (inset)
- `#ffffff` ×1 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#000` ×1 → textBody (text) or black (shadow)
- `#8a8d9f` ×1 → textMuted
- `#e5e6f2` ×1 → borderDefault

### src/app/jobs/search.tsx (11)
- `#1a1a1a` ×3 → textBody
- `#a1a1aa` ×3 → textPlaceholder (placeholder/icon) or textMuted
- `#f7f7f9` ×1 → bgScreen (page) or bgAlt (inset)
- `#ffffff` ×1 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#000` ×1 → textBody (text) or black (shadow)
- `#8a8d9f` ×1 → textMuted
- `#e5e6f2` ×1 → borderDefault

### src/app/career-resources/index.tsx (8)
- `#a1a1aa` ×3 → textPlaceholder (placeholder/icon) or textMuted
- `#1a1a1a` ×2 → textBody
- `#8a8d9f` ×2 → textMuted
- `#f7f7f9` ×1 → bgScreen (page) or bgAlt (inset)

### src/app/events/index.tsx (7)
- `#ffffff` ×3 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#8a8d9f` ×2 → textMuted
- `#e5e6f2` ×1 → borderDefault
- `#000000` ×1 → textBody (text) or black (shadow)

### src/app/(tabs)/career.tsx (6)
- `#f6b612` ×2 → warningSoft (background, dark text) or warningDot (icon)
- `#c4c4c4` ×1 → radioUnselected (borderInput)
- `#000000` ×1 → textBody (text) or black (shadow)
- `#16a34a` ×1 → successDot (icon/dot) or success (text)
- `#ffffff` ×1 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)

### src/app/experts/filter.tsx (5)
- `#c4c4c4` ×2 → radioUnselected (borderInput)
- `#f6b612` ×2 → warningSoft (background, dark text) or warningDot (icon)
- `#ffffff` ×1 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)

### src/app/grants/apply.tsx (4)
- `#fff` ×2 → white / bgCard
- `#ef4444` ×1 → errorDot
- `#f3f4f6` ×1 → bgScreen

### src/global.css (4)
- `#ffffff` ×2 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#17121f` ×2 → textBody

### src/app/events/booking.tsx (3)
- `#e5e6f2` ×1 → borderDefault
- `#ffffff` ×1 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#fafafa` ×1 → bgAlt

### src/app/events/[id].tsx (2)
- `#ffffff` ×1 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)
- `#000000` ×1 → textBody (text) or black (shadow)

### src/app/internships/[id].tsx (2)
- `#34d399` ×1 → successDot
- `#ffffff` ×1 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)

### src/app/jobs/[id].tsx (2)
- `#ffffff` ×2 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)

### src/constants/authStore.ts (2)
- `#4285f4` ×1 → keep (Google brand)
- `#ea4335` ×1 → keep (Google brand)

### src/app/(auth)/loading.tsx (1)
- `#f7f7f9` ×1 → bgScreen (page) or bgAlt (inset)

### src/app/events/filter.tsx (1)
- `#c4c4c4` ×1 → radioUnselected (borderInput)

### src/app/grants/[id].tsx (1)
- `#ffffff` ×1 → white / bgCard (white on a coloured fill or icon = white; card/surface = bgCard)

### src/app/index.tsx (1)
- `#f7f7f9` ×1 → bgScreen (page) or bgAlt (inset)

### src/components/ui/BrushHighlight.tsx (1)
- `#fc5e24` ×1 → accent500 (icon, dot, badge only)

## 3. Dead template files (removed in Step 2, do not convert)

- src/constants/theme.ts (10)
- src/components/animated-icon.tsx (3)
- src/components/animated-icon.module.css (2)
- src/components/themed-text.tsx (1)
