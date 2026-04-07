---
name: drank-ui-style
description: >
  Use this skill whenever designing, building, or editing any UI element in the
  drank app. This includes: adding a new page or step, designing a new button,
  input, card, modal, toggle, or panel, adjusting colors or typography, adding
  icons, writing new Tailwind classes, or asking how something should look or
  feel. Also use when the user asks "does this fit the style?", "how should this
  look?", or "make this match the rest of the app." The drank design language is
  specific — organic shapes, warm earth tones, monospace type, and handcrafted
  SVG details — and new elements should always feel like they belong to it.
---
 
# drank — UI Style Guide
 
## Design character
 
drank feels like a handwritten receipt crossed with a café menu — warm, slightly
imperfect, and personal. The aesthetic has three main ingredients:
 
1. **Organic edges** — squiggly SVG lines instead of straight borders, pill
   shapes instead of rectangles, subtle rotations that make things feel placed
   by hand rather than aligned by a grid
2. **Warm earth palette** — off-whites, olive greens, warm browns, dusty yellows;
   no cold grays or stark whites
3. **Monospace personality** — IBM Plex Mono is used for almost everything
   functional (labels, buttons, receipt text); Instrument Sans appears only for
   secondary/helper text
 
New UI elements should feel like they could belong in a physical café — tactile,
slightly worn, never corporate.
 
---
 
## Typography
 
| Role | Font | Class |
|------|------|-------|
| Receipt text, buttons, labels, inputs | IBM Plex Mono | `font-mono` |
| Helper text, captions, nav links | Instrument Sans | `font-sans` |
 
Use `font-mono` as the default for anything the user reads or interacts with.
Reserve `font-sans` for small secondary text (e.g. "Back" links, "or drag & drop",
skip links, muted helper copy).
 
Button labels are `font-mono text-sm uppercase tracking-wider` for primary
actions. Secondary/ghost buttons use `font-mono text-sm` without uppercase.
 
---
 
## Color palette
 
| Token | Hex | Role |
|-------|-----|------|
| `brown` | `#481D0F` | Primary CTA buttons, download button |
| `green-dark` | `#727025` | Back/nav links, accordion titles, squiggly underlines |
| `pink-dark` | `#CB446A` | Destructive/accent actions: sticker delete, re-select, rank another |
| `pink` | `#F884A3` | Lighter pink accent (used sparingly) |
| `background` | `oklch(0.958 0.012 85)` | Page background (warm off-white) |
| `card` | `oklch(0.99 0.008 90)` | Card surfaces, input backgrounds |
| `border` | `oklch(0.92 0.01 85)` | Subtle dividers, input borders |
| `muted-foreground` | `oklch(0.74 0.008 100)` | Helper text, placeholders, disabled states |
| `#FEFCF4` | — | Receipt background (not a token — use inline) |
| `#473C23` | — | Receipt text color (not a token — use inline) |
| `#9BCFEC` | — | Squiggly SVG border stroke (blue, decorate page only) |
| `#D9D88A` | — | Active tab highlight (dusty yellow) |
 
Hover states: use `hover:opacity-70` for text/icon buttons, `hover:bg-brown/90`
for filled buttons. Avoid inventing new hover colors.
 
---
 
## Buttons
 
### Primary (filled)
```tsx
<Button
  className="rounded-full bg-brown px-6 py-5 font-mono text-sm text-card
             uppercase tracking-wider hover:bg-brown/90"
>
  Action Label
</Button>
```
Always `rounded-full`. Icon + label: `gap-2` with `size-4` icon.
 
### Secondary (outline)
```tsx
<Button
  variant="outline"
  className="rounded-full border-2 border-border bg-card px-6 py-5
             font-mono text-sm text-foreground hover:text-muted-foreground"
>
  Action Label
</Button>
```
 
### Ghost text link (nav/back)
```tsx
<button className="flex items-center gap-1.5 font-sans text-sm text-green-dark
                   transition-colors hover:opacity-70">
  <ArrowLeft className="size-4" />
  Back
</button>
```
 
### Destructive text link (reset/delete)
```tsx
<button className="flex items-center gap-2 font-sans text-sm text-pink-dark
                   transition-colors hover:opacity-70">
  <RotateCcw className="size-4" />
  Rank Another
</button>
```
 
### Inline text link (skip/secondary action)
Plain text, no underline on the full string — underline only the actionable word:
```tsx
<button className="text-sm text-muted-foreground transition-colors hover:text-foreground">
  ... or skip and <span className="underline">rank without photo</span>
</button>
```
 
---
 
## Organic / squiggly elements
 
These are the most distinctive part of the drank aesthetic. They are always
hand-drawn SVG paths, never CSS borders or `border-radius` tricks.
 
### Where each squiggly element appears
 
| Element | Where | Color | Notes |
|---------|-------|-------|-------|
| Upload zone border | Upload page | `#9BCFEC` | Loaded from `/upload-border.svg` as a Next.js `<Image>` |
| Receipt border | Decorate page only | `#9BCFEC` | Inline SVG, `viewBox="0 0 359 522"`, absolute inset |
| Section underline (BASICS) | Decorate accordion | `#727025` | `width="52" viewBox="0 0 59 6"` |
| Section underline (CUSTOMIZATIONS) | Decorate accordion | `#727025` | `width="119" viewBox="0 0 119 8"` |
 
The receipt squiggly border and the shake animation exist **only** on the decorate
page. They must never appear on the share page.
 
When adding a new container that needs organic character, use a subtle
`rounded-xl` with `border border-border` rather than inventing a new SVG — new
squiggly SVGs should be purpose-designed in Figma first.
 
---
 
## Cards and panels
 
```tsx
// Standard panel (sticker panel, control sections)
<div className="rounded-xl border border-border bg-card p-4">
  ...
</div>
```
 
Panels use `rounded-xl`, `border border-border`, `bg-card`. Inner padding is `p-4`.
Never add `shadow` to panels — shadows are reserved for the receipt card.
 
The receipt card itself uses `rounded-sm shadow-md` (not xl) to feel like paper.
 
---
 
## Toggles and tab switchers
 
### Toggle switch
```tsx
<button
  role="switch"
  aria-checked={active}
  className={cn(
    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center
     rounded-full border-2 border-transparent transition-colors",
    active ? "bg-green-dark" : "bg-muted"
  )}
>
  <span className={cn(
    "pointer-events-none block size-5 rounded-full bg-white shadow-lg transition-transform",
    active ? "translate-x-5" : "translate-x-0"
  )} />
</button>
```
 
### Pill tab switcher
```tsx
<div className="flex overflow-hidden rounded-full border border-border bg-card">
  <button className={cn(
    "flex-1 py-3 font-mono text-sm transition-colors",
    active ? "bg-[#D9D88A] text-foreground" : "text-muted-foreground"
  )}>
    Option A
  </button>
  <button className={cn(
    "flex-1 py-3 font-mono text-sm transition-colors",
    active ? "bg-[#D9D88A] text-foreground" : "text-muted-foreground"
  )}>
    Option B
  </button>
</div>
```
The active tab gets `bg-[#D9D88A]` (dusty yellow). The container is `rounded-full`
with `overflow-hidden` so the active tab fills edge-to-edge.
 
---
 
## Pill / tag elements
 
Used for sticker buttons and option chips. Always `rounded-full`, monospace, small:
```tsx
<button className="rounded-full px-3 py-1.5 font-mono text-xs font-medium
                   transition-transform hover:scale-105 active:scale-95"
  style={{ backgroundColor: sticker.bg, color: sticker.textColor }}
>
  label
</button>
```
Hover: `scale-105`. Active: `scale-95`. These micro-interactions make the app feel
tactile.
 
---
 
## Layout patterns
 
### Two-column (desktop) / stacked (mobile)
All main pages use a consistent split layout:
- **Left column**: primary visual (receipt preview, upload zone) + primary action button pinned to bottom
- **Right column**: controls, inputs, panels
 
```
Mobile:  single column, full page scroll, fixed CTA pinned to bottom
Desktop: two columns (md:flex-row), fixed height, internal scroll on right column
```
 
Max content width: `max-w-[1100px] mx-auto`. Side padding: `px-4` mobile, `px-6` desktop.
 
### Fixed bottom CTA (mobile)
```tsx
<div className="fixed inset-x-0 bottom-0 z-20 bg-background p-4 md:hidden">
  <div className="mx-auto max-w-[400px]">
    <Button className="w-full ...">Action</Button>
  </div>
</div>
```
Mobile CTAs are always fixed to the bottom so the user never has to scroll to find them.
 
---
 
## Icons
 
Use `lucide-react` exclusively. Standard sizes:
- `size-3` — tiny (back arrow in decorate)
- `size-4` — standard (button icons, nav icons)
- `size-5` — medium (accordion chevrons)
 
Always pair icons with labels — never icon-only except for the sticker delete X button (which is small and contextual).
 
---
 
## Modals and overlays
 
```tsx
// Overlay backdrop
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
  // Modal card
  <div className="flex max-h-[90vh] w-full max-w-lg flex-col gap-4 rounded-xl bg-card p-4">
    ...
    // Two-button footer
    <div className="flex gap-3">
      <Button variant="outline" className="flex-1">Cancel</Button>
      <Button className="flex-1 bg-brown text-white hover:bg-brown/90">Confirm</Button>
    </div>
  </div>
</div>
```
 
Backdrop: `bg-black/80`. Modal: `rounded-xl bg-card`. Always a Cancel + Confirm
pair in the footer, flex with `gap-3`.
