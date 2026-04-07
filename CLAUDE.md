# drank — Project Brief

## What this project is
**drank** is a mobile-first web app for ranking drinks (primarily boba, specialty coffee, and other café beverages). Users photograph a drink, fill out a ranking receipt, decorate it with stickers, and download a shareable image. The core output is a receipt-style card and an optional story image (9:16) for social sharing.

The app is built with **Next.js (App Router), TypeScript, Tailwind CSS, and shadcn/ui**. It is prototyped and iterated in **v0.dev** and edited manually.

---

## Three-step flow

### Step 1 — Upload (`upload-step.tsx`)
- User uploads a drink photo via file picker, camera, or drag-and-drop
- EXIF date is extracted from JPEGs and pre-filled into the ranking form
- User can skip photo upload entirely and go straight to ranking ("rank without photo")
- UI: squiggly blue SVG border around the upload zone (`/upload-border.svg`), pill-shaped buttons

### Step 2 — Decorate (`decorate-step.tsx`)
- User fills out a **receipt** with drink details: rating (0–10), café name, beverage name, location/city, date, time, notes, and drink customizations (ice level, sugar level, milk type, toppings, other)
- Left column: live receipt preview (`ReceiptPreview`) — styled as a physical receipt, off-white (#FEFCF4), Space Mono font, brown text (#473C23), slight rotation, squiggly blue SVG border, `shake-on-hover` animation
- Right column: two accordion sections — BASICS and CUSTOMIZATIONS — with squiggly underline SVGs on the active section title
- Desktop: two-column layout, fixed height, internal scroll on the accordion. Mobile: single column, full page scroll

### Step 3 — Share (`share-step.tsx`)
This is the most complex step. It has two canvases the user can switch between:

**Receipt canvas**
- The same receipt from Step 2, now used as a decoration canvas
- No rotation or hover animation on this page
- Text stickers (pill-shaped, color-coded) can be dragged, scaled, and rotated onto the receipt
- Stickers are bounded to the receipt div
- Selected sticker shows: dashed border, corner resize handles, rotation handle (dot above the selection box on a line), X delete button outside the top-right corner

**Story canvas (9:16)**
- Available only if a photo was uploaded
- Background: the drink photo (darkened), with the receipt overlaid and centered
- Same sticker system, independent sticker state from receipt

**Right sidebar (desktop) / below canvas (mobile)**
- Drink sticker toggle: removes the background from the drink photo (`@imgly/background-removal`) and inserts the sticker as a layout element inside the receipt between the top centered text and the bottom left-aligned text. The toggle is off by default. First toggle opens a foreground selection modal (user draws a rectangle around the drink). Subsequent toggles reuse the processed result. "Re-select" link re-opens the modal.
- If no photo exists: "Upload Photo for Sticker & Story" link opens a file picker inline
- Story/Receipt tab switcher (pill toggle, yellow highlight on active)
- Sticker panel: flat grid of pill-shaped text stickers grouped by sentiment (positive → negative), centered, no accordion
- Download button (always visible, never pushed off screen)
- "Rank Another" resets the flow

**Export**
- Receipt download: `html2canvas` captures the live DOM receipt element at 2x, producing a pixel-perfect PNG
- Story download: composites the html2canvas receipt capture onto a 1080×1920 canvas over the background image, scaled proportionally to match the preview

---

## Key design details to always preserve

**Receipt structure (top to bottom):**
1. Rating circle (size-14 / 56px, border-2, text-lg, font-normal) — centered, mb-3
2. Café name — text-sm, font-medium, centered, mb-3
3. Drink name — text-lg, font-medium, leading-tight, centered, mb-3
4. Customizations (comma-separated) — text-sm, font-medium, centered, mb-3 — only if present
5. Drink sticker — centered image, my-3 — only if toggle is on
6. Notes — text-xs, font-light, left-aligned, mb-3 — only if present
7. Location — text-xs, font-light, left-aligned — only if present
8. Date (YYYYMMDD) + Time (12-hr) — text-xs, font-light, left-aligned, mb-3
9. Divider — border-t, opacity 20%, mb-3
10. Footer — "Ranked with **drank**" — text-xs, centered

Receipt styles: `w-[280px] px-5 py-6 rounded-sm bg-[#FEFCF4] shadow-md`, font `Space Mono`, text color `#473C23`

**The receipt design must never change between the decorate step and the share step.** Any component that renders the receipt must produce identical output.

**Sticker interaction:**
- Placed stickers: absolute positioned, drag to move, corner handles to resize, rotation handle (circle dot at top of a line extending above the selection box) to rotate, X button just outside top-right corner to delete
- Stickers on receipt and story canvases are independent — switching tabs preserves both sets
- Stickers are bounded to their canvas container (overflow-hidden on the container)

**Color palette:**
- Receipt background: `#FEFCF4`
- Receipt/body text: `#473C23`
- `brown` → `#481D0F` (primary buttons, download)
- `green-dark` → `#727025` (back links, nav, squiggly underlines)
- `pink-dark` → `#CB446A` (sticker handles, re-select link, delete button)
- `pink` → `#F884A3`
- Story/receipt toggle active: `#D9D88A`
- Squiggly border (upload zone, decorate receipt): `#9BCFEC` (blue)
- Background: `oklch(0.958 0.012 85)` (warm off-white page bg)
- Card: `oklch(0.99 0.008 90)`, Border: `oklch(0.92 0.01 85)`
- Muted foreground: `oklch(0.74 0.008 100)`

**Fonts:**
- Sans: `Instrument Sans` (`--font-instrument-sans`) — body/UI text
- Mono: `IBM Plex Mono` (`--font-ibm-plex-mono`) — all receipt text and most UI labels

**Shake animation (decorate page only):**
```css
@keyframes shake {
  0%, 100% { transform: rotate(1deg); }
  25% { transform: rotate(2deg); }
  50% { transform: rotate(0deg); }
  75% { transform: rotate(2deg); }
}
.shake-on-hover:hover, .shake-on-hover:active { animation: shake 0.3s ease-in-out; }
```
This class exists only on the receipt in the decorate step. It must never appear in share-step.tsx.

---

## Shared UI components (from `@/components/ui/`)
- **`TextInput`** — standard labeled text field; supports `variant="long"` for textarea, `innerLabel` for inline prefix label, `maxLength`, `disabled`
- **`OptionGroup`** — button group for selecting one option from a list; supports `colorScheme` ("green", "blue"), `columns`, and `withOther` (adds a freeform "Other" option that exposes an extra text input when selected)
- **`ToppingTags`** — user can type and add arbitrary topping tags, and delete existing ones; value is `string[]`
- **`Button`** — shadcn Button, variants: `default`, `outline`

---

## Tech stack
- **Framework:** Next.js (App Router), TypeScript
- **Styling:** Tailwind CSS v4 (`@import 'tailwindcss'`), shadcn/ui components, `tw-animate-css`
- **Icons:** lucide-react
- **Background removal:** `@imgly/background-removal` (client-side, no API key needed)
- **DOM capture:** `html2canvas` (must always be dynamically imported — see pitfalls)
- **Prototyping:** v0.dev

---

## Active bug — canvas/download consistency (in progress)
The biggest current issue is making the downloaded receipt and story images match the on-screen preview exactly. History of attempts:

- Manual canvas re-drawing (matching Tailwind values to canvas px) was tried extensively but always had spacing and font baseline mismatches. Canvas `fillText` uses baseline positioning while CSS uses top-of-element, causing all spacing to drift.
- `dom-to-image-more` was tried but could not be resolved for type declarations.
- Current approach: `html2canvas` captures the live DOM receipt element directly, avoiding all manual re-drawing. The receipt download is the html2canvas output at 2x. The story download composites the captured receipt onto a 1080×1920 canvas over the background photo.
- Remaining issue: html2canvas `scale` option caused a TypeScript error (`scale does not exist in type Html2CanvasOptions`) — worked around by capturing at natural size then manually upscaling to 2x by drawing into a larger canvas.
- `html2canvas` must always be dynamically imported to avoid Next.js SSR crash.

**Do not suggest going back to manual canvas drawing.** The html2canvas DOM capture approach is the correct one. Debug within that approach.

---

## Common pitfalls to avoid
- Never add rotation, `shake-on-hover`, or any animation to the receipt on the share page — those exist only in the decorate step
- Never add a blue squiggly border around the receipt or story canvas on the share page
- Never add extra padding, wrapper divs, or shadow wrappers around the receipt on the share page — it must be visually identical to the decorate step
- `html2canvas` must always be dynamically imported: `const html2canvas = (await import("html2canvas")).default` — a top-level import will crash Next.js SSR and break the entire app
- Do not use the `scale` option in html2canvas options — it is not in the installed type definitions; upscale manually after capture instead
- Never re-implement receipt drawing logic in raw canvas — always capture the live DOM element
- Sticker controls: X is outside the top-right corner (not overlapping resize handle), rotation dot is at the TOP of the handle line, all four corner resize handles must be the same size
- The download button must never be hidden or pushed off screen on any viewport size
- Tailwind CSS v4 is used (`@import 'tailwindcss'`) — some v3-style config patterns may not apply
