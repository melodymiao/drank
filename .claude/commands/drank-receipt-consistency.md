---
name: drank-receipt-consistency
description: >
  Use this skill whenever working on any part of the drank app that involves
  the receipt component, receipt rendering, receipt export, or download
  functionality. This includes: editing share-step.tsx, editing decorate-step.tsx,
  fixing download bugs, fixing spacing or sizing mismatches between preview and
  downloaded images, adding features to the receipt, or any question about why
  the receipt looks different in the export vs the preview. Also use when asked
  to add canvas drawing code, re-implement receipt rendering, or debug image
  capture issues. If in doubt, use this skill — receipt consistency bugs are the
  most common and costly issue in this codebase.
---
 
# drank — Receipt Rendering Consistency
 
## The core rule
 
The receipt DOM element is the single source of truth. The downloaded image must
always be produced by capturing that live element — never by re-implementing the
receipt in canvas drawing code.
 
**Always use html2canvas. Never redraw.**
 
This rule exists because canvas drawing can never exactly reproduce CSS layout.
Even with correct font sizes and `textBaseline = "top"`, subtle differences in
line-height, letter-spacing, margin collapsing, and subpixel rendering accumulate
into visible spacing mismatches. Every attempt to redraw the receipt manually in
this codebase has failed. Don't try again.
 
---
 
## The receipt component
 
The receipt is rendered by `ReceiptContent` in `share-step.tsx`. It must be
**pixel-identical** to `ReceiptPreview` in `decorate-step.tsx`. If you ever
touch either component, check that both still match.
 
### Exact structure (top to bottom)
 
```
py-6 (24px) top padding
  [rating circle]     size-14 (56px), border-2, text-lg (18px), font-normal, mb-3 (12px), centered
  [cafe name]         text-sm (14px), font-medium, centered, mb-3
  [drink name]        text-lg (18px), font-medium, leading-tight, centered, mb-3
  [customizations]    text-sm, font-medium, centered, mb-3  — omit if empty
  [drink sticker]     centered img, my-3 top+bottom        — omit if toggle off
  [notes]             text-xs (12px), font-light, left-aligned, mb-3  — omit if empty
  [location]          text-xs, font-light, left-aligned    — omit if empty, NO mb, same line as date/time
  [date + time]       text-xs, font-light, left-aligned, mb-3 — always shown (required field, auto-filled from photo EXIF or current datetime)
  [divider]           border-t, opacity 20%, mb-3
  [footer]            "Ranked with drank" text-xs, font-normal, centered
py-6 (24px) bottom padding
```
 
### Exact container styles
 
```
w-[280px] px-5 py-6 rounded-sm shadow-md
background: #FEFCF4
font: Space Mono (IBM Plex Mono)
text color: #473C23
```
 
### What belongs only on the decorate page (never on share page)
 
- `shake-on-hover` class and the shake CSS animation
- `transform: rotate(1deg)`
- The squiggly blue SVG border (`stroke="#9BCFEC"`)
 
---
 
## The export pipeline
 
### Receipt download
 
```typescript
// ALWAYS dynamic import — top-level import crashes Next.js SSR
const html2canvas = (await import("html2canvas")).default
 
const captured = await html2canvas(receiptDivRef.current, {
  useCORS: true,
  backgroundColor: "#FEFCF4",
  logging: false,
  width: el.offsetWidth,
  height: el.offsetHeight,
})
 
// Upscale to 2x manually (do NOT use the scale option — not in type definitions)
const finalCanvas = document.createElement("canvas")
finalCanvas.width = captured.width * 2
finalCanvas.height = captured.height * 2
finalCanvas.getContext("2d")!.drawImage(captured, 0, 0, finalCanvas.width, finalCanvas.height)
 
const dataUrl = finalCanvas.toDataURL("image/png")
```
 
### Story download
 
The story (1080×1920) is produced by compositing the html2canvas receipt capture
onto the background photo — not by re-drawing the receipt in canvas.
 
```typescript
async function generateStoryCanvas(
  canvas: HTMLCanvasElement,
  receiptCapture: HTMLCanvasElement,   // the 2x capture from above
  placedStickers: PlacedSticker[],
  backgroundImageSrc: string,
  storyPreviewEl: HTMLDivElement | null
): Promise<string | null> {
  const W = 1080, H = 1920
  // SCALE maps preview pixels → export pixels
  const previewW = storyPreviewEl?.getBoundingClientRect().width ?? 220
  const SCALE = W / previewW
 
  // 1. Draw background (cover fill, brightness 0.9)
  // 2. Compute receipt size: receipt is 70% of story preview width, scaled up
  const exportReceiptW = Math.round(previewW * 0.70 * SCALE)
  const exportReceiptH = Math.round(
    (receiptCapture.height / 2 / (receiptCapture.width / 2)) * exportReceiptW
  )
  // 3. Draw receipt centered
  ctx.drawImage(receiptCapture, rX, rY, exportReceiptW, exportReceiptH)
  // 4. Draw placed stickers scaled by SCALE
}
```
 
### ref wiring
 
`receiptDivRef` must point to the actual receipt card div (the `w-[280px]` div),
not its wrapper. It is attached in `InteractiveCanvas` and passed up to
`ShareStep` via props. `storyPreviewRef` points to the story preview container
div to measure its rendered width at export time.
 
---
 
## Known pitfalls
 
**Do not use the `scale` option in html2canvas** — it doesn't exist in the
installed type definitions and will cause a TypeScript error. Upscale manually
after capture (see above).
 
**Do not add a top-level html2canvas import** — it accesses browser DOM APIs and
will crash Next.js during server-side rendering. Always use dynamic import inside
the async function.
 
**Do not re-implement receipt drawing in canvas** — this has been tried many
times and always produces spacing mismatches due to CSS vs canvas baseline
differences. The only correct approach is html2canvas DOM capture.
 
**Do not change the receipt between pages** — the receipt on the share page must
be visually identical to the decorate page. No extra wrappers, no extra padding,
no background color changes, no border.
 
**The download button must always be visible** — never let canvas size push it
off screen. Shrink the canvas (maintaining aspect ratio) before hiding the button.
 
---
 
## Color and font reference
 
| Token        | Hex / Value  | Used for                          |
|-------------|--------------|-----------------------------------|
| `brown`      | `#481D0F`    | Primary buttons, download button  |
| `green-dark` | `#727025`    | Back links, nav text              |
| `pink-dark`  | `#CB446A`    | Sticker handles, delete button    |
| Receipt bg   | `#FEFCF4`    | Receipt background                |
| Receipt text | `#473C23`    | All receipt text                  |
| Story toggle | `#D9D88A`    | Active tab highlight              |
| Border       | `#9BCFEC`    | Squiggly SVG border (decorate only)|
 
Fonts: `IBM Plex Mono` for mono, `Instrument Sans` for sans.
