/**
 * receipt-store.ts
 *
 * localStorage persistence layer for drank receipts.
 * All reads/writes go through this module — swap the internals
 * for a real DB later without touching any component code.
 *
 * Storage key: "drank_receipts"  →  SavedReceipt[]
 *
 * Photo handling:
 *   - Images are resized to max 800px wide, JPEG quality 0.82 before storing.
 *   - A separate 80px thumbnail is stored for fast list/gallery rendering.
 *   - If localStorage is near capacity a soft warning is logged to the console.
 */

import type { ReceiptData } from "@/components/decorate-step"

/* ─────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────── */

/** A single placed sticker as stored — mirrors PlacedSticker in share-step.tsx */
export interface StoredSticker {
  id: string
  text: string
  bg: string
  textColor: string
  x: number        // percentage 0-100
  y: number        // percentage 0-100
  scale: number
  rotation: number
}

export interface SavedReceipt {
  /** Stable UUID generated when the user enters the rank step */
  id: string
  /** ISO timestamp of first save (finish ranking) */
  savedAt: string
  /** ISO timestamp of last update (save story/receipt from share step) */
  updatedAt: string

  // ── Receipt form data (mirrors ReceiptData exactly) ──────────────────
  cafeName: string
  drinkName: string
  rating: string
  comments: string
  location: string
  date: string
  time: string
  iceTemp: string
  iceLevel: string
  otherIceLevel: string
  sugarLevel: string
  otherSugarLevel: string
  milk: string
  otherMilk: string
  toppings: string[]
  otherCustomizations: string

  // ── Media ─────────────────────────────────────────────────────────────
  /** ~800px wide JPEG data URL — null if no photo was uploaded */
  imageDataUrl: string | null
  /** ~80px wide JPEG data URL — always present when imageDataUrl is set */
  thumbnailDataUrl: string | null
  /**
   * Background-removed drink PNG data URL — set when the user enables the
   * drink sticker and saves. Used as the gallery/list thumbnail when present.
   */
  bgRemovedImageDataUrl: string | null

  // ── Share step state ──────────────────────────────────────────────────
  /** Placed stickers on the receipt canvas at time of last save */
  receiptStickers: StoredSticker[]
  /** Placed stickers on the story canvas at time of last save */
  storyStickers: StoredSticker[]
  /** Whether the drink sticker was enabled at time of last save */
  showDrinkSticker: boolean
  /**
   * The "best" saved canvas PNG for this receipt — used in the history detail
   * view instead of re-rendering the DOM receipt. Priority (highest wins):
   *   2 — story canvas with drink sticker
   *   1 — story canvas without drink sticker
   *   0 — receipt canvas only
   * null if the user has never hit Save.
   */
  savedCanvasDataUrl: string | null
  /** Priority level of savedCanvasDataUrl (0/1/2). -1 means not yet saved. */
  savedCanvasPriority: number
}

/* ─────────────────────────────────────────────────────────────
   Storage key
───────────────────────────────────────────────────────────── */

const STORAGE_KEY = "drank_receipts"
/** Soft-warn when localStorage usage exceeds this fraction */
const STORAGE_WARN_THRESHOLD = 0.8
/** Hard-fail threshold — above this, saves will likely throw QuotaExceededError */
const STORAGE_CRITICAL_THRESHOLD = 0.95

/* ─────────────────────────────────────────────────────────────
   Internal helpers
───────────────────────────────────────────────────────────── */

function readAll(): SavedReceipt[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as SavedReceipt[]
  } catch {
    return []
  }
}

function writeAll(receipts: SavedReceipt[]): void {
  try {
    const serialized = JSON.stringify(receipts)
    localStorage.setItem(STORAGE_KEY, serialized)
    checkStorageCapacity()
  } catch (err) {
    // Likely a QuotaExceededError
    console.error("[receipt-store] Failed to write to localStorage:", err)
    throw err
  }
}

function checkStorageCapacity(): void {
  try {
    let total = 0
    for (const key of Object.keys(localStorage)) {
      total += (localStorage.getItem(key)?.length ?? 0) * 2 // UTF-16 = 2 bytes per char
    }
    const limitBytes = 5 * 1024 * 1024 // 5MB
    if (total / limitBytes > STORAGE_WARN_THRESHOLD) {
      console.warn(
        `[receipt-store] localStorage is ${Math.round((total / limitBytes) * 100)}% full. ` +
        `Consider removing old receipts or enabling cloud sync.`
      )
    }
  } catch {
    // Non-critical — ignore
  }
}

/* ─────────────────────────────────────────────────────────────
   Image resizing
───────────────────────────────────────────────────────────── */

/**
 * Resizes a data URL to a max dimension, returning a new JPEG data URL.
 * Returns null if the input is null or resizing fails.
 */
export async function resizeImage(
  dataUrl: string,
  maxWidth: number,
  quality = 0.82
): Promise<string | null> {
  if (!dataUrl) return null
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width)
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement("canvas")
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d")
      if (!ctx) { resolve(null); return }
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL("image/jpeg", quality))
    }
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}

/* ─────────────────────────────────────────────────────────────
   Public API
───────────────────────────────────────────────────────────── */

/**
 * Creates a new receipt record.
 * Called automatically when the user transitions from rank → share step.
 * At this point, no photo resize has happened yet — pass the raw dataUrl
 * and this function handles resizing internally.
 *
 * Returns the saved receipt's id.
 */
export async function saveReceipt(
  id: string,
  data: ReceiptData,
  rawImageDataUrl: string | null
): Promise<string> {
  const [imageDataUrl, thumbnailDataUrl] = await Promise.all([
    rawImageDataUrl ? resizeImage(rawImageDataUrl, 800, 0.82) : Promise.resolve(null),
    rawImageDataUrl ? resizeImage(rawImageDataUrl, 400, 0.82) : Promise.resolve(null),
  ])

  const now = new Date().toISOString()
  const receipt: SavedReceipt = {
    id,
    savedAt: now,
    updatedAt: now,
    ...data,
    imageDataUrl,
    thumbnailDataUrl,
    bgRemovedImageDataUrl: null,
    receiptStickers: [],
    storyStickers: [],
    showDrinkSticker: false,
    savedCanvasDataUrl: null,
    savedCanvasPriority: -1,
  }

  const all = readAll()
  // If a record with this id already exists (e.g. user went back and re-finished,
  // or the user is editing a history entry), preserve fields that belong to the
  // share step — they will be re-written when the user saves from the share step.
  // Also preserve the original savedAt timestamp.
  const existingIdx = all.findIndex((r) => r.id === id)
  if (existingIdx !== -1) {
    const prev = all[existingIdx]
    all[existingIdx] = {
      ...receipt,
      savedAt: prev.savedAt,
      bgRemovedImageDataUrl: prev.bgRemovedImageDataUrl,
      showDrinkSticker: prev.showDrinkSticker,
      receiptStickers: prev.receiptStickers,
      storyStickers: prev.storyStickers,
      savedCanvasDataUrl: prev.savedCanvasDataUrl,
      savedCanvasPriority: prev.savedCanvasPriority,
    }
  } else {
    all.unshift(receipt) // newest first
  }

  // Try writing with images. If storage is full, fall back to stripping images
  // so the record (form data + metadata) always lands in localStorage even when
  // photos can't fit. The share step will show the low-storage banner afterward.
  try {
    writeAll(all)
  } catch {
    const idx = existingIdx !== -1 ? existingIdx : 0
    all[idx] = { ...all[idx], imageDataUrl: null, thumbnailDataUrl: null }
    writeAll(all) // if this also throws, propagate — truly out of space
  }

  return id
}

/**
 * Updates an existing receipt.
 * Called when the user taps "Save Story" / "Save Receipt" on the share step.
 * Pass only the fields that changed — everything else is preserved.
 *
 * Special rule: savedCanvasDataUrl is only written when the incoming
 * savedCanvasPriority is >= the existing value, so the "most detailed"
 * version (story with drink sticker) is never overwritten by a simpler save.
 */
export function updateReceipt(
  id: string,
  updates: Partial<Omit<SavedReceipt, "id" | "savedAt">>
): void {
  const all = readAll()
  const idx = all.findIndex((r) => r.id === id)
  if (idx === -1) {
    console.warn(`[receipt-store] updateReceipt: id ${id} not found`)
    return
  }

  const existing = all[idx]

  // If the incoming update carries a canvas, only accept it when it is at least
  // as "detailed" as what we already have stored.
  const incomingPriority = updates.savedCanvasPriority ?? -1
  const existingPriority = existing.savedCanvasPriority ?? -1
  const canvasUpdates =
    incomingPriority >= existingPriority
      ? {}
      : { savedCanvasDataUrl: existing.savedCanvasDataUrl, savedCanvasPriority: existingPriority }

  all[idx] = {
    ...existing,
    ...updates,
    ...canvasUpdates,
    updatedAt: new Date().toISOString(),
  }

  try {
    writeAll(all)
  } catch {
    // Full write failed (likely QuotaExceededError from bgRemovedImageDataUrl or savedCanvasDataUrl).
    // Retry without the heaviest blobs so at least the metadata lands.
    all[idx] = { ...all[idx], bgRemovedImageDataUrl: null, savedCanvasDataUrl: null, savedCanvasPriority: -1 }
    writeAll(all) // propagate if still failing
  }
}

export type ReceiptSortBy = "rating" | "latest"
export type ReceiptSortDir = "asc" | "desc"

/**
 * Returns the current localStorage usage fraction (0–1).
 * "warn" = approaching full (>80%), "critical" = nearly full (>95%), "ok" = fine.
 */
export function getStorageStatus(): { fraction: number; level: "ok" | "warn" | "critical" } {
  try {
    let total = 0
    for (const key of Object.keys(localStorage)) {
      total += (localStorage.getItem(key)?.length ?? 0) * 2
    }
    const fraction = total / (5 * 1024 * 1024)
    const level = fraction > STORAGE_CRITICAL_THRESHOLD
      ? "critical"
      : fraction > STORAGE_WARN_THRESHOLD
      ? "warn"
      : "ok"
    return { fraction, level }
  } catch {
    return { fraction: 0, level: "ok" }
  }
}

/**
 * Returns all receipts sorted by the given field and direction.
 * Defaults: rating descending (highest first).
 */
export function getReceipts(
  sortBy: ReceiptSortBy = "rating",
  dir: ReceiptSortDir = "desc"
): SavedReceipt[] {
  const all = readAll()
  return [...all].sort((a, b) => {
    let delta: number
    if (sortBy === "rating") {
      const ra = parseFloat(a.rating) || 0
      const rb = parseFloat(b.rating) || 0
      delta = rb - ra // desc by default
    } else {
      // latest: sort by updatedAt
      delta = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    }
    return dir === "asc" ? -delta : delta
  })
}

/** Returns a single receipt by id, or null if not found. */
export function getReceiptById(id: string): SavedReceipt | null {
  return readAll().find((r) => r.id === id) ?? null
}

/** Permanently deletes a receipt. */
export function deleteReceipt(id: string): void {
  const all = readAll().filter((r) => r.id !== id)
  writeAll(all)
}

/** Returns true if a receipt with this id already exists in the store. */
export function receiptExists(id: string): boolean {
  return readAll().some((r) => r.id === id)
}

/**
 * Computes aggregate stats across all receipts.
 * Used by the history page stats bar.
 */
export function getStats(): {
  totalRanked: number
  avgScore: number | null
  uniqueCafes: number
  uniqueCities: number
} {
  const all = readAll()
  if (all.length === 0) {
    return { totalRanked: 0, avgScore: null, uniqueCafes: 0, uniqueCities: 0 }
  }
  const scores = all.map((r) => parseFloat(r.rating)).filter((n) => !isNaN(n))
  const avg = scores.length > 0
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    : null
  const cafes = new Set(all.map((r) => r.cafeName.trim().toLowerCase()).filter(Boolean))
  const cities = new Set(all.map((r) => r.location.trim().toLowerCase()).filter(Boolean))
  return {
    totalRanked: all.length,
    avgScore: avg,
    uniqueCafes: cafes.size,
    uniqueCities: cities.size,
  }
}

/**
 * Returns unique café names with drink counts, sorted by count descending.
 * Used by the café filter drawer.
 */
export function getCafeOptions(): Array<{ name: string; count: number }> {
  const all = readAll()
  const map = new Map<string, number>()
  for (const r of all) {
    const name = r.cafeName.trim()
    if (!name) continue
    map.set(name, (map.get(name) ?? 0) + 1)
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Returns unique location/city strings with drink counts, sorted by count descending.
 * Used by the location filter drawer.
 */
export function getLocationOptions(): Array<{ name: string; count: number }> {
  const all = readAll()
  const map = new Map<string, number>()
  for (const r of all) {
    const loc = r.location.trim()
    if (!loc) continue
    map.set(loc, (map.get(loc) ?? 0) + 1)
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}