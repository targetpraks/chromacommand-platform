---
version: alpha
name: ChromaCommand
description: Dark command-center UI for the Papa Pasta IoT franchise network — controlling RGB lighting, digital menus, and audio across 100+ stores.

colors:
  primary: "#1B2A4A"
  secondary: "#C8A951"
  tertiary: "#1DB954"
  neutral: "#F7F5F2"

  surface-dark: "#0A0B14"
  surface-panel: "#13141F"
  surface-raised: "#1A1C2A"
  surface-overlay: "#11131C"
  surface-input: "#0A0B14"

  border-subtle: "rgba(255,255,255,0.08)"
  border-medium: "#1F2230"
  border-strong: "#2A2D3A"

  on-dark: "#FFFFFF"
  on-dark-secondary: "rgba(255,255,255,0.55)"
  on-surface: "#E4E4E7"
  on-surface-dim: "#A1A1AA"

  gold-hover: "#D4B669"

  success: "#22C55E"
  success-subtle: "rgba(34,197,94,0.10)"
  warning: "#F59E0B"
  warning-subtle: "rgba(245,158,11,0.10)"
  error: "#EF4444"
  error-subtle: "rgba(239,68,68,0.10)"
  info: "#3B82F6"
  info-subtle: "rgba(59,130,246,0.10)"

typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.2
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.3
  headline-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.4
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5
  label-lg:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1
  label-sm:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: 500
    lineHeight: 1
  label-caps:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: 600
    letterSpacing: 0.08em
    lineHeight: 1
  mono-sm:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: 400
    lineHeight: 1.4

rounded:
  none: 0px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  full: 9999px

spacing:
  base: 8px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  gutter: 24px

components:
  button-primary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 8px 16px
  button-primary-hover:
    backgroundColor: "{colors.gold-hover}"
  button-ghost:
    backgroundColor: "{colors.surface-panel}"
    textColor: "{colors.on-dark-secondary}"
    rounded: "{rounded.md}"
    padding: 6px 12px
  button-ghost-hover:
    backgroundColor: "{colors.surface-raised}"
  card:
    backgroundColor: "{colors.surface-panel}"
    borderColor: "{colors.border-subtle}"
    rounded: "{rounded.xl}"
    padding: 16px
  card-hover:
    borderColor: "rgba(200,169,81,0.2)"
  section:
    backgroundColor: "{colors.surface-overlay}"
    borderColor: "{colors.border-medium}"
    rounded: "{rounded.lg}"
    padding: 20px
  input:
    backgroundColor: "{colors.surface-input}"
    borderColor: "{colors.border-medium}"
    rounded: "{rounded.md}"
    padding: 8px 12px
---

## Overview

ChromaCommand is a **Dark Operations Console** — a command-center dashboard that franchise operators use to control RGB lighting, digital menu screens, and in-store audio across 100+ Papa Pasta locations. The aesthetic is **Tactical Luxury**: deep ink-dark surfaces with warm gold accents evoke a premium control room rather than a consumer app. Every surface, every color, every type decision reinforces that this is a serious tool for real-time infrastructure management.

The UI should feel like a high-end broadcast console: dark, dense, information-rich, but never cluttered. Gold (#C8A951) is used sparingly and intentionally — only for primary CTAs, active navigation states, and key data highlights. The Spotify green (#1DB954) is reserved exclusively for the Spotify integration page to maintain brand recognition.

## Colors

The palette is organized into four layers: **Brand**, **Surfaces**, **Borders**, and **Semantics**.

- **Primary (#1B2A4A):** Deep Navy — used for headlines, primary panels, and the default LED zone color. This is not a "blue" — it reads as near-black with a blue undertone, lending sophistication.
- **Secondary (#C8A951):** Gold — the sole driver for interaction. Used exclusively for primary buttons, active tab indicators, key metrics, and brand accents. Never use gold for decorative or secondary elements.
- **Tertiary (#1DB954):** Spotify Green — reserved entirely for the Spotify integration page. Never appears elsewhere.
- **Neutral (#F7F5F2):** Warm limestone — reserved for future light-mode contexts.

**Surfaces** use a strict 4-level depth system:
- `surface-dark` (#0A0B14): Page background — the deepest layer.
- `surface-panel` (#13141F): Card and panel background — sits on top of dark.
- `surface-raised` (#1A1C2A): Hover and elevated states — subtle lift from panel.
- `surface-overlay` (#11131C): Section containers within panels — visually between dark and panel.
- `surface-input` (#0A0B14): Form input backgrounds — matches page to create inset feel.

**Borders** use a 3-level system:
- `border-subtle` (rgba 8% white): Default card/divider borders.
- `border-medium` (#1F2230): Section and card borders in form-heavy pages.
- `border-strong` (#2A2D3A): Interactive borders (buttons, inputs, hover states).

**Text** uses a 4-level hierarchy on dark backgrounds:
- `on-dark` (#FFFFFF): Primary text — headlines, important data.
- `on-dark-secondary` (rgba 55% white): Muted text — descriptions, metadata, captions.
- `on-surface` (#E4E4E7): Text on panel/overlay backgrounds.
- `on-surface-dim` (#A1A1AA): Dimmed secondary text.

**Semantic colors** pair a vivid foreground with a subtle background:
- Success: #22C55E / 10% opacity fill
- Warning: #F59E0B / 10% opacity fill
- Error: #EF4444 / 10% opacity fill
- Info: #3B82F6 / 10% opacity fill

## Typography

The type system uses two font families:

- **Inter** (weights 400, 500, 600, 700) handles all UI text — from headlines to body to labels. Its humanist sans-serif construction balances warmth and precision.
- **JetBrains Mono** (weight 400) is reserved exclusively for technical data: store IDs, zone codes, cron expressions, SHA hashes, and monospaced data tables. It signals "machine-readable" content.

Typography levels follow a strict hierarchy:
- Use `headline-lg` (24px/700) only for page titles.
- Use `headline-md` (20px/700) for section titles.
- Use `headline-sm` (14px/600) for card headers and subsection titles.
- Use `body-md` (14px/400) for primary body text.
- Use `body-sm` (12px/400) for secondary descriptions and form labels.
- Use `label-lg` (12px/500) for badges, tabs, and metadata.
- Use `label-sm` (10px/500) for timestamps, counts, and tiny metadata.
- Use `label-caps` (10px/600/0.08em) for section category labels — always uppercase.
- Use `mono-sm` (10px/400 JetBrains Mono) for IDs, codes, and monospaced data.

## Layout

The dashboard uses a **Fixed Sidebar + Fluid Content** layout. The sidebar is 240px fixed-width on the left. Content fills the remaining viewport width with 24px horizontal padding and 24px top padding.

Interior grids follow a responsive pattern:
- Stats cards: `grid-cols-2 lg:grid-cols-4`
- Content cards: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- Detail panels: `grid-cols-1 lg:grid-cols-2`

The 8px spacing scale (with 4px half-step) maintains visual rhythm. Cards use 16px internal padding. Sections use 20px. The gutter between cards is 12px.

## Elevation & Depth

Depth is achieved through **Tonal Layers** rather than drop shadows. The surface hierarchy (dark → overlay → panel → raised) creates visual depth through subtle background color shifts. No `box-shadow` properties are used except for LED color swatches (which use a colored glow to indicate live zone state).

Borders serve as the primary edge definition mechanism. Use `border-subtle` for resting card edges and `border-medium` for form-intensive sections.

## Shapes

All interactive elements and containers use an **xl radius (12px)** for cards and sections, **md radius (8px)** for buttons and inputs, and **sm radius (6px)** for small inline elements and badges. Status dots use `full` radius. This creates a soft, approachable feel while maintaining the precision of a control interface.

Never mix sharp and rounded corners in the same view. Avoid `rounded-none` except for horizontal dividers and list separators.

## Components

### Buttons
- **Primary (Gold):** Gold background with navy text. Used for the single most important action per screen (Sync, Activate, Create, Sign in). Hover lightens to gold-hover.
- **Ghost (Default):** Panel background with subtle border. Used for secondary actions (Refresh, Cancel, Preview). Hover transitions to raised background.
- **Danger:** Same as ghost but hover transitions to red-error tinted background with red text.

### Cards
- Default card: panel background, subtle border, xl radius, 16px padding. Hover state transitions border to gold/20.
- Section card: overlay background, medium border, lg radius, 20px padding. Used for form containers and list sections.

### Inputs
- Input fields use surface-input background (matching page bg) with medium borders. This creates an "inset" feel. Focus state uses a gold ring.

### Badges
- Gold badge: gold/15 background, gold text — used for "NEW" indicators and active navigation.
- Status badges use semantic colors with their -subtle backgrounds.

### Status Dots
- Online: green-500 with pulse animation.
- Offline: red-500, no animation.
- Setup/unknown: zinc-500.

### Progress Bars
- Thin tracks (h-1.5) on white/5 background. Fill color matches context (gold for general, blue for audio, green for success).

## Do's and Don'ts

- Do use gold (#C8A951) only for the single most important action per screen
- Do use the 4-level surface hierarchy consistently: dark → overlay → panel → raised
- Do use JetBrains Mono exclusively for technical identifiers and monospaced data
- Do use semantic token colors (success, warning, error, info) for status indicators
- Do maintain WCAG AA contrast ratios — all text tokens are designed for dark backgrounds
- Don't mix raw hex values with token classes — always use the design tokens
- Don't use gold for decorative elements, borders, or secondary text
- Don't introduce new surface colors outside the defined 5-level hierarchy
- Don't use more than 2 font families (Inter + JetBrains Mono) on any screen
- Don't use `zinc-*` Tailwind classes — use the on-surface token hierarchy instead
- Don't use drop shadows except for LED color glows on swatches