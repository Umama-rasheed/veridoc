---
name: Editorial Intelligence
colors:
  surface: '#10141a'
  surface-dim: '#10141a'
  surface-bright: '#353940'
  surface-container-lowest: '#0a0e14'
  surface-container-low: '#181c22'
  surface-container: '#1c2026'
  surface-container-high: '#262a31'
  surface-container-highest: '#31353c'
  on-surface: '#dfe2eb'
  on-surface-variant: '#bbc9cd'
  inverse-surface: '#dfe2eb'
  inverse-on-surface: '#2d3137'
  outline: '#859397'
  outline-variant: '#3c494c'
  surface-tint: '#2fd9f4'
  primary: '#8aebff'
  on-primary: '#00363e'
  primary-container: '#22d3ee'
  on-primary-container: '#005763'
  inverse-primary: '#006877'
  secondary: '#4ae176'
  on-secondary: '#003915'
  secondary-container: '#00b954'
  on-secondary-container: '#004119'
  tertiary: '#ffd961'
  on-tertiary: '#3c2f00'
  tertiary-container: '#e8bc00'
  on-tertiary-container: '#604d00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#a2eeff'
  primary-fixed-dim: '#2fd9f4'
  on-primary-fixed: '#001f25'
  on-primary-fixed-variant: '#004e5a'
  secondary-fixed: '#6bff8f'
  secondary-fixed-dim: '#4ae176'
  on-secondary-fixed: '#002109'
  on-secondary-fixed-variant: '#005321'
  tertiary-fixed: '#ffe083'
  tertiary-fixed-dim: '#eec200'
  on-tertiary-fixed: '#231b00'
  on-tertiary-fixed-variant: '#574500'
  background: '#10141a'
  on-background: '#dfe2eb'
  surface-variant: '#31353c'
typography:
  display-lg:
    fontFamily: Playfair Display
    fontSize: 56px
    fontWeight: '700'
    lineHeight: 64px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Playfair Display
    fontSize: 40px
    fontWeight: '600'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Playfair Display
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Playfair Display
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: 0em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.06em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 3rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system embodies high-trust analytical rigor married with refined editorial craftsmanship. It merges the mechanical precision of developer tooling with the intellectual gravitas of premium literary publishing. The user experience balances deep analytical quietude with sharp, electric clarity.

The visual style is **Editorial Technical Minimalism**:
- **Atmosphere:** Deep midnight surfaces punctuated by controlled, razor-sharp luminous accents.
- **Tone:** Authoritative, disciplined, transparent, and uncluttered. 
- **Emotional Response:** The user feels intellectually empowered, completely in control, and confident in the source-grounded integrity of every insight.

## Colors

The palette establishes an obsidian-grade baseline with surgical cyan accents and precise semantic grounding:

- **Canvas & Underlay:** Base canvas defaults to deep midnight `#0A0E14`, reinforced with deep slate undertones (`#0F172A`) for structural layering.
- **Surfaces & Cards:** Elevated surfaces use `#111827`, bordered with low-contrast structural strokes (`#1F2937`).
- **Primary Accent (`#22D3EE`):** Electric Cyan represents active attention, focus states, interactive highlights, evidence verification tags, and primary calls-to-action.
- **Verification & Status Semantics:**
  - **Anchored / Verified:** `#22C55E` for verified citations and confirmed factual grounding.
  - **Partial / Synthesized:** `#FACC15` for derived inferences, multi-source syntheses, or warnings.
  - **Alert / Unverified:** `#EF4444` for hallucinations, missing citations, or system errors.
- **Foregrounds & Typography:** Primary text uses `#F9FAFB` (98% luminance) for crisp optical contrast. Secondary body text uses `#9CA3AF`, while metadata and captions use `#6B7280`.

## Typography

The typographic tension pairs the classical, literary authority of **Playfair Display** with the ultra-clean, technical geometry of **Plus Jakarta Sans**.

- **Editorial Headlines (Playfair Display):** Conveys investigative depth and intellectual weight. Headings must always maintain tight negative tracking (`-0.01em` to `-0.02em`) to avoid looseness in dark themes.
- **Functional Body & Interface (Plus Jakarta Sans):** Delivers transparent legibility at small sizes, ensuring document previews, transcripts, synthesized answers, and dense UI panels remain effortless to parse.
- **Numerics & Code Citations:** Inline references, footnotes, and document page numbers rely on tabular figures (`font-variant-numeric: tabular-nums`) to ensure strict alignment across data tables and citation rails.

## Layout & Spacing

The layout is built upon a 12-column fluid grid on desktop, scaling down to an 8-column model on tablet and a 4-column model on mobile devices.

- **Editorial Reading Rhythm:** Synthesized document answers and analytical outputs adopt a reading column constrained to a maximum width of `760px` to maintain optimal line lengths (65–75 characters per line).
- **Asymmetric Split Workspace:** The canonical desktop workspace uses an asymmetric two-pane layout: a flexible 7-column primary inquiry/synthesis stream and a 5-column live citation/document preview rail.
- **Vertical Rhythm:** Paragraphs and structural elements follow strict multiples of `0.5rem` (`8px`). Generous section margins (`space-xl` and above) prevent visual clutter and evoke magazine-grade composure.

## Elevation & Depth

Depth is established primarily through **tonal layering and low-contrast borders**, supplemented by restrained luminous cyan glows rather than heavy drop shadows:

- **Layer 0 (Canvas):** `#0A0E14` with a subtle, non-distracting 24px CSS grid overlay pattern rendered in `rgba(255, 255, 255, 0.02)`.
- **Layer 1 (Panels & Structural Sidebar):** `#0D1117` with a 1px solid border of `#1F2937`.
- **Layer 2 (Cards & Active Modules):** `#111827` bordered with `#1F2937`. On hover or active state, the border shifts to `rgba(34, 211, 238, 0.4)` accompanied by a subtle ambient outer blur: `0 0 20px -4px rgba(34, 211, 238, 0.12)`.
- **Layer 3 (Overlays, Popovers, & Citations):** `#161F30` with `backdrop-filter: blur(16px)` and a crisp stroke of `rgba(34, 211, 238, 0.25)`. Box shadow: `0 12px 32px -8px rgba(0, 0, 0, 0.7)`.

## Shapes

The design system employs **Soft (`1`)** roundedness. This sharp-leaning curvature aligns with high-density productivity tools, conveying surgical precision over consumer softness:

- Base inputs, cards, and containment panels use `0.25rem` (`4px`).
- Elevating containers, modal dialogues, and context sheets scale to `0.5rem` (`rounded-lg`).
- Evidence tags, source citation chips, and status badges take full pill geometries (`rounded-full`) to immediately distinguish interactive metadata from structured document cards.

## Components

### Buttons
- **Primary Action:** Solid `#22D3EE` background with `#0A0E14` text at `label-md`, font-weight 600. Hover triggers a subtle glow (`box-shadow: 0 0 16px rgba(34, 211, 238, 0.35)`).
- **Secondary / Ghost:** Transparent background with `#1F2937` 1px border and `#F9FAFB` text. Hover transitions the border to `rgba(34, 211, 238, 0.4)` and surface to `rgba(255, 255, 255, 0.03)`.

### Evidence Chips & Citations
- Inline textual citations are pill badges (`font-size: 11px`, monospaced numerals) with `rgba(34, 211, 238, 0.1)` background, `#22D3EE` text, and a `1px` border of `rgba(34, 211, 238, 0.25)`.
- Clicking or hovering on an evidence chip triggers the document rail to scroll directly to the target paragraph while applying an electric cyan focus bracket.

### Cards & Document Nodes
- Base background `#111827`, border `1px solid #1F2937`.
- Hover introduces a sharp transition: border turns `rgba(34, 211, 238, 0.35)` with an interior micro-gradient highlight along the top edge.

### Input Fields & Prompt Console
- Prompt bars use `#0D1117` with a 1px border of `#1F2937`.
- Focus states transition the entire boundary to `#22D3EE` with an ambient glow of `0 0 0 1px #22D3EE, 0 0 12px rgba(34, 211, 238, 0.2)`. Placeholder text sits at `#4B5563`.

### Status Indicators
- Discrete micro-dots (`6px`) with semantic color fills (`#22C55E`, `#FACC15`, `#EF4444`) accompanied by an outer radial halo (`box-shadow: 0 0 8px currentColor`) to indicate verification certainty.