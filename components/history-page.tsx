"use client"

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronDown, Trash2, Pencil, ArrowUpDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getReceipts,
  deleteReceipt,
  getStats,
  getCafeOptions,
  getLocationOptions,
  type SavedReceipt,
  type ReceiptSortBy,
  type ReceiptSortDir,
} from "@/lib/receipt-store"
import { NavDrawer, HamburgerButton, DesktopNav } from "@/components/ui/nav-drawer"
import { Button } from "@/components/ui/button"

/* ─────────────────────────────────────────────────────────────
   Helpers
─────────────────────────────────────────────────────────────── */


function getRatingColor(rating: string): string {
  const n = parseFloat(rating)
  if (isNaN(n)) return "#E0DE96"
  if (n >= 8) return "#9BCFEC"
  if (n >= 6) return "#E0DE96"
  if (n >= 4) return "#FFB1D0"
  return "#FF7347"
}

/* ─────────────────────────────────────────────────────────────
   Cup placeholder SVG (when no photo)
─────────────────────────────────────────────────────────────── */
function CupPlaceholder({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center bg-border/40", className)}>
      <svg width="20" height="24" viewBox="0 0 20 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 2h14l-2 16A2 2 0 0 1 13 20H7a2 2 0 0 1-2-2L3 2Z" stroke="#473C23" strokeWidth="1.4" strokeOpacity="0.35" strokeLinejoin="round"/>
        <path d="M1 2h18" stroke="#473C23" strokeWidth="1.4" strokeOpacity="0.35" strokeLinecap="round"/>
        <path d="M8 22.5h4" stroke="#473C23" strokeWidth="1.4" strokeOpacity="0.35" strokeLinecap="round"/>
      </svg>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Stats bar — scrollable on mobile, fills width on desktop
─────────────────────────────────────────────────────────────── */
// Alternating tilt patterns: L/R/L or R/L/R, decided randomly each mount.
const TILT_PATTERNS = [
  [-1,  1, -1],  // left, right, left
  [ 1, -1,  1],  // right, left, right
]

function StatsBar() {
  const [stats, setStats] = useState({ avgScore: null as number | null, uniqueCafes: 0, uniqueCities: 0 })

  // Start neutral during SSR — populated after mount to avoid hydration mismatch.
  const [transforms, setTransforms] = useState<Array<{ rotate: number; translateY: number }>>([
    { rotate: 0, translateY: 0 },
    { rotate: 0, translateY: 0 },
    { rotate: 0, translateY: 0 },
  ])

  useEffect(() => {
    const s = getStats()
    setStats({ avgScore: s.avgScore, uniqueCafes: s.uniqueCafes, uniqueCities: s.uniqueCities })

    // Pick a random alternating pattern (L/R/L or R/L/R)
    const signs = TILT_PATTERNS[Math.random() < 0.5 ? 0 : 1]
    setTransforms(signs.map((sign) => ({
      rotate: sign * (1.5 + Math.random() * 2),
      translateY: Math.random() * 6,
    })))
  }, [])

  const items = [
    { label: "avg score", value: stats.avgScore !== null ? stats.avgScore.toFixed(1) : "—", bg: "#F884A3", border: "#e06a8a" },
    { label: "cafés",     value: stats.uniqueCafes,  bg: "#E0DE96", border: "#b8b65a" },
    { label: "cities",    value: stats.uniqueCities,  bg: "#9BCFEC", border: "#68a9cc" },
  ]

  return (
    // py-3 gives rotated cards room to breathe without clipping into header or sibling rows
    <div className="flex gap-3 overflow-y-visible px-1 py-3">
      {items.map(({ label, value, bg, border }, i) => (
        <div
          key={label}
          className="flex min-w-0 flex-1 flex-col items-center rounded-xl px-4 py-6"
          style={{
            backgroundColor: bg,
            border: `1.5px solid ${border}`,
            transform: `rotate(${transforms[i].rotate}deg) translateY(${transforms[i].translateY}px)`,
            transition: "transform 0.2s ease",
          }}
        >
          <span className="font-mono text-lg font-medium leading-tight text-[#473C23]">{value}</span>
          <span className="font-sans text-[10px] uppercase tracking-wider text-[#473C23]/70">{label}</span>
        </div>
      ))}
    </div>
  )
}


/* ─────────────────────────────────────────────────────────────
   Mobile "all" filter chip — two-level dropdown for café + location
─────────────────────────────────────────────────────────────── */
interface MobileAllFilterChipProps {
  activeFilterCount: number
  cafeOptions: Array<{ name: string; count: number }>
  locationOptions: Array<{ name: string; count: number }>
  cafeFilter: Set<string>
  locationFilter: Set<string>
  onToggleCafe: (name: string) => void
  onToggleLocation: (name: string) => void
  onClearAll: () => void
}

function MobileAllFilterChip({
  activeFilterCount,
  cafeOptions,
  locationOptions,
  cafeFilter,
  locationFilter,
  onToggleCafe,
  onToggleLocation,
  onClearAll,
}: MobileAllFilterChipProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [subMenu, setSubMenu] = useState<"cafe" | "location" | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})

  useEffect(() => {
    if (!isOpen || !buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const panelWidth = 220
    const left = Math.min(rect.left, window.innerWidth - panelWidth - 8)
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 6,
      left: Math.max(8, left),
      width: panelWidth,
      zIndex: 9999,
    })
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    function handlePointer(e: MouseEvent | TouchEvent) {
      const target = e instanceof TouchEvent ? e.touches[0]?.target : (e.target as Node)
      if (!target) return
      if (
        buttonRef.current?.contains(target as Node) ||
        dropdownRef.current?.contains(target as Node)
      ) return
      setIsOpen(false)
      setSubMenu(null)
    }
    document.addEventListener("mousedown", handlePointer)
    document.addEventListener("touchstart", handlePointer)
    return () => {
      document.removeEventListener("mousedown", handlePointer)
      document.removeEventListener("touchstart", handlePointer)
    }
  }, [isOpen])

  const active = activeFilterCount > 0

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        onClick={() => { setIsOpen((o) => !o); setSubMenu(null) }}
        className={cn(
          "flex shrink-0 items-center gap-1.5 rounded-md border-2 px-3 py-1.5 font-mono text-xs transition-all hover:scale-[1.02] active:scale-[0.98]",
          active || isOpen
            ? "border-green-light bg-green-light text-foreground"
            : "border-green-light bg-green-light/25 text-green-dark"
        )}
      >
        all
        {activeFilterCount > 0 && (
          <span className="flex size-4 items-center justify-center rounded-full bg-foreground/15 text-[9px]">
            {activeFilterCount}
          </span>
        )}
        <ChevronDown className={cn("size-3 opacity-50 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div ref={dropdownRef} style={dropdownStyle} className="rounded-xl border border-border bg-card shadow-lg">
          {/* Top-level menu */}
          {!subMenu && (
            <div className="py-1.5">
              {activeFilterCount > 0 && (
                <button
                  onClick={() => { onClearAll(); setIsOpen(false) }}
                  className="flex w-full items-center px-3 py-2 font-sans text-xs text-muted-foreground hover:bg-border/40"
                >
                  clear all
                </button>
              )}
              <button
                onClick={() => setSubMenu("cafe")}
                className="flex w-full items-center justify-between px-3 py-3.5 font-sans text-xs text-foreground hover:bg-border/40"
              >
                <span>café {cafeFilter.size > 0 && <span className="ml-1 text-[10px] text-muted-foreground">({cafeFilter.size})</span>}</span>
                <ChevronDown className="-rotate-90 size-3 opacity-50" />
              </button>
              <button
                onClick={() => setSubMenu("location")}
                className="flex w-full items-center justify-between px-3 py-3.5 font-sans text-xs text-foreground hover:bg-border/40"
              >
                <span>location {locationFilter.size > 0 && <span className="ml-1 text-[10px] text-muted-foreground">({locationFilter.size})</span>}</span>
                <ChevronDown className="-rotate-90 size-3 opacity-50" />
              </button>
            </div>
          )}

          {/* Sub-menu: café */}
          {subMenu === "cafe" && (
            <div>
              <div className="flex items-center justify-between border-b border-border pl-1 pr-3 py-1">
                <button onClick={() => setSubMenu(null)} className="flex items-center justify-center p-2.5 text-muted-foreground hover:text-foreground">
                  <ChevronDown className="size-4 rotate-90" />
                </button>
                <span className="font-mono text-xs font-medium">café</span>
                <div className="flex gap-3">
                  <button
                    onClick={() => { cafeOptions.forEach(o => onToggleCafe(o.name)) }}
                    className="font-sans text-[11px] text-green-dark underline"
                  >
                    all
                  </button>
                  <button
                    onClick={() => { cafeOptions.forEach(o => { if (cafeFilter.has(o.name)) onToggleCafe(o.name) }) }}
                    className="font-sans text-[11px] text-muted-foreground underline"
                  >
                    clear
                  </button>
                </div>
              </div>
              <div className="max-h-52 overflow-y-auto px-2 py-2">
                {cafeOptions.length === 0 && <p className="px-1 py-1 font-sans text-xs text-muted-foreground">no cafés yet</p>}
                {cafeOptions.map(({ name, count }) => (
                  <button
                    key={name}
                    onClick={() => onToggleCafe(name)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-3 font-sans text-xs transition-colors",
                      cafeFilter.has(name) ? "bg-green-light text-foreground" : "text-foreground hover:bg-green-light/50"
                    )}
                  >
                    <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-none border", cafeFilter.has(name) ? "border-foreground bg-foreground" : "border-border bg-card")}>
                      {cafeFilter.has(name) && <svg viewBox="0 0 10 8" className="size-2.5" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </span>
                    <span className="truncate">{name}</span>
                    <span className="ml-auto shrink-0 opacity-50">({count})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sub-menu: location */}
          {subMenu === "location" && (
            <div>
              <div className="flex items-center justify-between border-b border-border pl-1 pr-3 py-1">
                <button onClick={() => setSubMenu(null)} className="flex items-center justify-center p-2.5 text-muted-foreground hover:text-foreground">
                  <ChevronDown className="size-4 rotate-90" />
                </button>
                <span className="font-mono text-xs font-medium">location</span>
                <div className="flex gap-3">
                  <button
                    onClick={() => { locationOptions.forEach(o => onToggleLocation(o.name)) }}
                    className="font-sans text-[11px] text-green-dark underline"
                  >
                    all
                  </button>
                  <button
                    onClick={() => { locationOptions.forEach(o => { if (locationFilter.has(o.name)) onToggleLocation(o.name) }) }}
                    className="font-sans text-[11px] text-muted-foreground underline"
                  >
                    clear
                  </button>
                </div>
              </div>
              <div className="max-h-52 overflow-y-auto px-2 py-2">
                {locationOptions.length === 0 && <p className="px-1 py-1 font-sans text-xs text-muted-foreground">no locations yet</p>}
                {locationOptions.map(({ name, count }) => (
                  <button
                    key={name}
                    onClick={() => onToggleLocation(name)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-3 font-sans text-xs transition-colors",
                      locationFilter.has(name) ? "bg-green-light text-foreground" : "text-foreground hover:bg-green-light/50"
                    )}
                  >
                    <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-none border", locationFilter.has(name) ? "border-foreground bg-foreground" : "border-border bg-card")}>
                      {locationFilter.has(name) && <svg viewBox="0 0 10 8" className="size-2.5" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </span>
                    <span className="truncate">{name}</span>
                    <span className="ml-auto shrink-0 opacity-50">({count})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Filter chip with inline dropdown
─────────────────────────────────────────────────────────────── */
interface FilterChipProps {
  label: string
  active: boolean
  count?: number
  options?: Array<{ name: string; count: number }>
  selected?: Set<string>
  onToggle?: (name: string) => void
  onSelectAll?: () => void
  onClear?: () => void
  onClick: () => void
  isOpen?: boolean
  onClose?: () => void
}

function FilterChip({
  label,
  active,
  count,
  options,
  selected,
  onToggle,
  onSelectAll,
  onClear,
  onClick,
  isOpen,
  onClose,
}: FilterChipProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})

  // Position the dropdown via fixed coords so it escapes overflow-x-auto clipping
  useEffect(() => {
    if (!isOpen || !buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const panelWidth = 288 // w-72
    // Clamp left edge so it doesn't overflow the right of the viewport
    const left = Math.min(rect.left, window.innerWidth - panelWidth - 8)
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 6,
      left: Math.max(8, left),
      width: panelWidth,
      zIndex: 9999,
    })
  }, [isOpen])

  // Close on outside click/touch
  useEffect(() => {
    if (!isOpen) return
    function handlePointer(e: MouseEvent | TouchEvent) {
      const target = e instanceof TouchEvent ? e.touches[0]?.target : (e.target as Node)
      if (!target) return
      if (
        buttonRef.current?.contains(target as Node) ||
        dropdownRef.current?.contains(target as Node)
      ) return
      onClose?.()
    }
    document.addEventListener("mousedown", handlePointer)
    document.addEventListener("touchstart", handlePointer)
    return () => {
      document.removeEventListener("mousedown", handlePointer)
      document.removeEventListener("touchstart", handlePointer)
    }
  }, [isOpen, onClose])

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        onClick={onClick}
        className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-md border-2 px-3 py-1.5 font-mono text-xs transition-all hover:scale-[1.02] active:scale-[0.98]",
            active || isOpen
            ? "border-green-light bg-green-light text-foreground"
            : "border-green-light bg-green-light/25 text-green-dark"
        )}
        >
        {label}
        {count !== undefined && count > 0 && (
          <span className="flex size-4 items-center justify-center rounded-full bg-foreground/15 text-[9px]">
            {count}
          </span>
        )}
        {label !== "all" && (
          <ChevronDown className={cn("size-3 opacity-50 transition-transform", isOpen && "rotate-180")} />
        )}
      </button>

      {/* Dropdown panel — rendered with fixed positioning to escape overflow clipping */}
      {isOpen && options && selected && onToggle && (
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="rounded-xl border border-border bg-card shadow-lg"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <span className="font-mono text-xs font-medium text-foreground">{label}</span>
            <div className="flex gap-3">
              <button onClick={onSelectAll} className="font-sans text-[11px] text-green-dark underline">
                all
              </button>
              <button onClick={onClear} className="font-sans text-[11px] text-muted-foreground underline">
                clear
              </button>
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-60 overflow-y-auto px-2 py-2">
            {options.length === 0 && (
              <p className="px-1 py-1 font-sans text-xs text-muted-foreground">no options yet</p>
            )}
            {options.map(({ name, count: optCount }) => (
              <button
                key={name}
                onClick={() => onToggle(name)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-3 font-sans text-xs transition-colors",
                  selected.has(name)
                    ? "bg-green-light text-foreground"
                    : "text-foreground hover:bg-green-light/50"
                )}
              >
                {/* Checkbox */}
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-none border",
                    selected.has(name) ? "border-foreground bg-foreground" : "border-border bg-card"
                  )}
                >
                  {selected.has(name) && (
                    <svg viewBox="0 0 10 8" className="size-2.5" fill="none">
                      <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="truncate">{name}</span>
                <span className="ml-auto shrink-0 opacity-50">({optCount})</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Delete confirm modal
─────────────────────────────────────────────────────────────── */
function DeleteModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  // Close on backdrop tap
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onCancel()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={handleBackdropClick}
    >
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl bg-card p-6 shadow-lg">
        <div className="flex flex-col gap-1.5">
          <p className="font-mono text-sm font-medium text-foreground">delete this receipt?</p>
          <p className="font-sans text-sm text-muted-foreground">this can&apos;t be undone.</p>
        </div>
        <div className="flex gap-3">
          <button
            className="flex-1 rounded-full border border-border py-2.5 font-mono text-sm text-foreground transition-colors hover:bg-border/60"
            onClick={onCancel}
          >
            keep it
          </button>
          <button
            className="flex-1 rounded-full bg-pink-dark py-2.5 font-mono text-sm text-white transition-colors hover:bg-pink-dark/90"
            onClick={onConfirm}
          >
            delete
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Receipt preview — pixel-exact replica of share-step ReceiptContent
─────────────────────────────────────────────────────────────── */
const RECEIPT_TEXT_COLOR = "#473C23"
const IBM_PLEX: React.CSSProperties = { fontFamily: "'IBM Plex Mono', monospace" }

function receiptFormatDate(dateStr: string) {
  if (!dateStr) return "YYYYMMDD"
  return dateStr.replace(/-/g, "")
}

function receiptFormatTime(timeStr: string) {
  if (!timeStr) return "12:00 AM"
  const [hours, minutes] = timeStr.split(":")
  const h = parseInt(hours, 10)
  const ampm = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 || 12
  return `${h12}:${minutes} ${ampm}`
}

function toTitleCase(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : ""
}

function buildCustomizations(receipt: SavedReceipt): string[] {
  const out: string[] = []
  if (receipt.iceTemp) out.push(toTitleCase(receipt.iceTemp))
  const iceLevelDisplay = receipt.iceLevel === "other" && receipt.otherIceLevel
    ? receipt.otherIceLevel
    : receipt.iceLevel
  if (iceLevelDisplay && receipt.iceTemp !== "hot") out.push(`${toTitleCase(iceLevelDisplay)} Ice`)
  const sugarLevelDisplay = receipt.sugarLevel === "other" && receipt.otherSugarLevel
    ? receipt.otherSugarLevel
    : receipt.sugarLevel
  if (sugarLevelDisplay) out.push(`${toTitleCase(sugarLevelDisplay)} Sugar`)
  const milkDisplay = receipt.milk === "other" && receipt.otherMilk ? receipt.otherMilk : receipt.milk
  if (milkDisplay) out.push(`${toTitleCase(milkDisplay)} Milk`)
  if (receipt.toppings?.length) out.push(...receipt.toppings.map(toTitleCase))
  if (receipt.otherCustomizations) out.push(toTitleCase(receipt.otherCustomizations))
  return out
}

function MiniReceipt({ receipt }: { receipt: SavedReceipt }) {
  const customizations = buildCustomizations(receipt)

  return (
    <div
      className="mx-auto w-[280px] rounded-sm px-5 py-6 shadow-md"
      style={{ backgroundColor: "#FEFCF4" }}
    >
      {/* Rating circle */}
      <div className="mb-3 flex justify-center">
        <div
          className="flex size-14 items-center justify-center rounded-full border-2"
          style={{ borderColor: RECEIPT_TEXT_COLOR }}
        >
          <span className="text-lg font-normal" style={{ ...IBM_PLEX, color: RECEIPT_TEXT_COLOR }}>
            {receipt.rating || "5.0"}
          </span>
        </div>
      </div>

      {/* Cafe name */}
      <p className="mb-3 break-words text-center text-xs font-medium" style={{ ...IBM_PLEX, color: RECEIPT_TEXT_COLOR }}>
        {receipt.cafeName || "cafe"}
      </p>

      {/* Drink name */}
      <h3 className="mb-3 break-words text-center text-2xl font-medium leading-tight" style={{ ...IBM_PLEX, color: RECEIPT_TEXT_COLOR }}>
        {receipt.drinkName || "Beverage"}
      </h3>

      {/* Customizations */}
      {customizations.length > 0 && (
        <p className="mb-3 break-words text-center text-sm font-medium" style={{ ...IBM_PLEX, color: RECEIPT_TEXT_COLOR }}>
          {customizations.join(", ")}
        </p>
      )}

      {/* Drink sticker — shown when bg-removed image was saved */}
      {receipt.showDrinkSticker && receipt.bgRemovedImageDataUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={receipt.bgRemovedImageDataUrl}
          alt="drink"
          className="mx-auto my-3 block max-h-32 w-auto object-contain"
        />
      )}

      {/* Notes */}
      {receipt.comments?.trim() && (
        <p className="mb-3 break-words text-xs font-light" style={{ ...IBM_PLEX, color: RECEIPT_TEXT_COLOR }}>
          Notes: {receipt.comments.trim()}
        </p>
      )}

      {/* Location */}
      {receipt.location?.trim() && (
        <p className="break-words text-xs font-light" style={{ ...IBM_PLEX, color: RECEIPT_TEXT_COLOR }}>
          {receipt.location.trim()}
        </p>
      )}

      {/* Date/Time */}
      <p className="mb-3 text-xs font-light" style={{ ...IBM_PLEX, color: RECEIPT_TEXT_COLOR }}>
        {receiptFormatDate(receipt.date)} {receiptFormatTime(receipt.time)}
      </p>

      {/* Divider */}
      <div className="mb-3 border-t" style={{ borderColor: RECEIPT_TEXT_COLOR, opacity: 0.2 }} />

      {/* Footer */}
      <p className="text-center text-xs font-normal" style={{ ...IBM_PLEX, color: RECEIPT_TEXT_COLOR }}>
        Ranked with <span className="font-medium" style={IBM_PLEX}>drank</span>
      </p>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Receipt detail modal (centered, matches share-step modal style)
─────────────────────────────────────────────────────────────── */
interface DetailSheetProps {
  receipt: SavedReceipt
  onClose: () => void
  onEdit: (receipt: SavedReceipt) => void
  onDelete: (id: string) => void
}

function DetailSheet({ receipt, onClose, onEdit, onDelete }: DetailSheetProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Close when tapping the backdrop (but not the modal card itself)
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4"
      onClick={handleBackdropClick}
    >
      <div
        className="relative flex w-full max-w-[340px] flex-col gap-4 rounded-md p-4 shadow-xl"
        style={{ backgroundColor: "oklch(0.958 0.012 85)" }}
      >
        {/* X close — top right, no border */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 text-muted-foreground transition-opacity hover:opacity-70"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>

        {/* Header text */}
        <div className="text-center">
          <p className="font-sans text-sm text-foreground">
            {receipt.drinkName || "Beverage"}
          </p>
          {receipt.cafeName && (
            <p className="font-sans text-xs text-muted-foreground">{receipt.cafeName}</p>
          )}
        </div>

        {/* Scrollable content: always render the DOM receipt (with drink sticker if saved) */}
        <div className="max-h-[60vh] overflow-y-auto">
          <MiniReceipt receipt={receipt} />
        </div>

        {/* Action row: Delete (left) + Edit (right) */}
        <div className="flex gap-3">
          <Button
            size="lg"
            className="flex-1 rounded-full border-2 border-border font-sans text-sm text-foreground hover:brightness-95"
            style={{ backgroundColor: "oklch(0.958 0.012 85)" }}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-4" />
            Delete
          </Button>
          <Button
            size="lg"
            className="flex-1 rounded-full bg-brown font-sans text-sm text-card hover:bg-brown/90"
            onClick={() => onEdit(receipt)}
          >
            <Pencil className="size-4" />
            Edit
          </Button>
        </div>
      </div>

      {confirmDelete && (
        <DeleteModal
          onConfirm={() => {
            setConfirmDelete(false)
            onDelete(receipt.id)
            onClose()
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   List item — right-click / two-finger-tap shows inline delete button
─────────────────────────────────────────────────────────────── */
interface ListItemProps {
  receipt: SavedReceipt
  idx: number
  onClick: () => void
  onDelete: () => void
}

function ListItem({ receipt, idx, onClick, onDelete }: ListItemProps) {
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const rowRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)


  // Close desktop menu when clicking outside
  useEffect(() => {
    if (!menuPos) return
    function handleOutside(e: MouseEvent | TouchEvent) {
      const target = e instanceof TouchEvent ? e.touches[0]?.target : (e.target as Node)
      if (!target) return
      if (menuRef.current?.contains(target as Node)) return
      setMenuPos(null)
    }
    document.addEventListener("mousedown", handleOutside)
    document.addEventListener("touchstart", handleOutside)
    return () => {
      document.removeEventListener("mousedown", handleOutside)
      document.removeEventListener("touchstart", handleOutside)
    }
  }, [menuPos])

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setMenuPos({ x: e.clientX, y: e.clientY })
  }

  const triggerDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuPos(null)
    setConfirmDelete(true)
  }

  return (
    <>
      <div ref={rowRef} className="relative">
        <button
          onClick={onClick}
          onContextMenu={handleContextMenu}
          className="flex items-center gap-3 px-4 py-4 text-left transition-colors rounded-md hover:bg-border/30 w-full"
        >
          {/* Rank number */}
          <span className="w-2 shrink-0 font-mono text-xs text-muted-foreground">
            {idx + 1}
          </span>

          {/* Thumbnail */}
          {(() => {
            const thumb = receipt.bgRemovedImageDataUrl ?? receipt.thumbnailDataUrl
            return thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumb}
                alt={receipt.drinkName}
                className={cn(
                  "size-20 shrink-0 rounded-sm",
                  receipt.bgRemovedImageDataUrl ? "object-contain" : "object-cover"
                )}
              />
            ) : (
              <CupPlaceholder className="size-20 shrink-0 rounded-md" />
            )
          })()}

          {/* Info */}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate font-mono text-md font-medium text-foreground">
              {receipt.drinkName || "Beverage"}
            </span>
            <span className="truncate font-sans text-sm text-muted-foreground">
              {[receipt.cafeName, receipt.location].filter(Boolean).join(" · ")}
            </span>
          </div>

          {/* Rating badge */}
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-full font-mono text-md font-medium"
            style={{ backgroundColor: getRatingColor(receipt.rating), color: "#473C23" }}
          >
            {receipt.rating || "—"}
          </div>
        </button>

      </div>

      {/* Desktop context menu — fixed, anchored below the row's left edge */}
      {menuPos && (
        <div
          ref={menuRef}
          className="fixed z-50 rounded-lg overflow-hidden"
          style={{ top: menuPos.y, left: menuPos.x }}
        >
          <button
            onClick={triggerDelete}
            className="flex items-center gap-2 rounded-lg border-0 px-3 py-2 no-underline shadow-none outline-none focus:outline-none focus-visible:outline-none transition-opacity hover:opacity-80"
            style={{ backgroundColor: "#F1C5BE", textDecoration: "none", borderBottom: "none", boxShadow: "none" }}
          >
            <Trash2 className="size-3.5 shrink-0" style={{ color: "#E85B5B" }} />
            <span className="font-sans text-sm" style={{ color: "#E85B5B", textDecoration: "none" }}>delete</span>
          </button>
        </div>
      )}

      {confirmDelete && (
        <DeleteModal
          onConfirm={() => {
            setConfirmDelete(false)
            onDelete()
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  )
}

/* ─────────────────────────────────────────────────────────────
   Main page
─────────────────────────────────────────────────────────────── */
export default function HistoryPage() {
  const router = useRouter()
  const [receipts, setReceipts] = useState<SavedReceipt[]>([])
  const [view, setView] = useState<"list" | "gallery">("list")
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [sortBy, setSortBy] = useState<ReceiptSortBy>("rating")
  const [sortDir, setSortDir] = useState<ReceiptSortDir>("desc")

  // Filter state
  const [cafeFilter, setCafeFilter] = useState<Set<string>>(new Set())
  const [locationFilter, setLocationFilter] = useState<Set<string>>(new Set())
  const [openFilter, setOpenFilter] = useState<"cafe" | "location" | null>(null)

  // Detail sheet
  const [detailReceipt, setDetailReceipt] = useState<SavedReceipt | null>(null)

  // Load receipts on mount
  useEffect(() => {
    setReceipts(getReceipts(sortBy, sortDir))
  }, [])

  // Re-sort when sort settings change
  useEffect(() => {
    setReceipts(getReceipts(sortBy, sortDir))
  }, [sortBy, sortDir])

  const cafeOptions = useMemo(() => getCafeOptions(), [receipts])
  const locationOptions = useMemo(() => getLocationOptions(), [receipts])

  const filteredReceipts = useMemo(() => {
    return receipts.filter((r) => {
      if (cafeFilter.size > 0 && !cafeFilter.has(r.cafeName.trim())) return false
      if (locationFilter.size > 0 && !locationFilter.has(r.location.trim())) return false
      return true
    })
  }, [receipts, cafeFilter, locationFilter])

  const handleDelete = useCallback((id: string) => {
    deleteReceipt(id)
    setReceipts(getReceipts(sortBy, sortDir))
    setDetailReceipt(null)
  }, [sortBy, sortDir])

  const handleEdit = useCallback((receipt: SavedReceipt) => {
    sessionStorage.setItem("drank_edit_receipt", JSON.stringify(receipt))
    router.push("/")
  }, [router])

  const activeFilterCount = cafeFilter.size + locationFilter.size

  return (
    <div className="flex h-dvh bg-background">
      {/* Nav drawer — mobile only */}
      <NavDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header — matches rank page exactly */}
        <header className="relative flex shrink-0 items-center justify-center px-4 pb-4 pt-4 md:px-6">
        <div className="absolute left-4 md:hidden">
            <HamburgerButton onClick={() => setDrawerOpen(true)} />
        </div>

        <Link href="/" aria-label="drank — go to rank">
            <Image
            src="/logo.png"
            alt="drank"
            width={80}
            height={24}
            className="h-6 w-auto transition-opacity hover:opacity-70"
            priority
            />
        </Link>

        <div className="absolute right-4 hidden md:block">
            <DesktopNav />
        </div>
        </header>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[700px] px-4 pb-20 md:px-6">
            {/* Stats */}
            <div className="mb-4">
              <StatsBar />
            </div>

            {/* Toolbar */}
<div className="mb-4">

  {/* Mobile: single row — collapsed "all" filter + sort controls */}
  <div className="flex items-center gap-2 md:hidden">
    <MobileAllFilterChip
      activeFilterCount={activeFilterCount}
      cafeOptions={cafeOptions}
      locationOptions={locationOptions}
      cafeFilter={cafeFilter}
      locationFilter={locationFilter}
      onToggleCafe={(name) => setCafeFilter((prev) => { const next = new Set(prev); next.has(name) ? next.delete(name) : next.add(name); return next })}
      onToggleLocation={(name) => setLocationFilter((prev) => { const next = new Set(prev); next.has(name) ? next.delete(name) : next.add(name); return next })}
      onClearAll={() => { setCafeFilter(new Set()); setLocationFilter(new Set()) }}
    />
    <div className="ml-auto flex items-center gap-2">
      <div className="flex rounded-xl border-2 border-border bg-transparent p-1">
        <button onClick={() => setSortBy("rating")} className={cn("rounded-md px-3 py-1.5 font-mono text-xs transition-colors", sortBy === "rating" ? "bg-green-light text-foreground" : "text-muted-foreground hover:text-foreground")}>ranking</button>
        <button onClick={() => setSortBy("latest")} className={cn("rounded-md px-3 py-1.5 font-mono text-xs transition-colors", sortBy === "latest" ? "bg-green-light text-foreground" : "text-muted-foreground hover:text-foreground")}>latest</button>
      </div>
      <button onClick={() => setSortDir((d) => d === "desc" ? "asc" : "desc")} className="flex items-center justify-center p-1 text-green-dark transition-opacity hover:opacity-70" aria-label={sortDir === "desc" ? "Sort ascending" : "Sort descending"}>
        <ArrowUpDown className="size-5" />
      </button>
    </div>
  </div>

  {/* Desktop: single row — filter chips + sort controls */}
  <div className="hidden md:flex md:items-center md:justify-between md:gap-3">
    <div className="flex items-center gap-2">
      <FilterChip
        label="all"
        active={activeFilterCount === 0}
        onClick={() => { setCafeFilter(new Set()); setLocationFilter(new Set()); setOpenFilter(null) }}
      />
      <FilterChip
        label="café"
        active={cafeFilter.size > 0}
        count={cafeFilter.size}
        options={cafeOptions}
        selected={cafeFilter}
        onToggle={(name) => setCafeFilter((prev) => { const next = new Set(prev); next.has(name) ? next.delete(name) : next.add(name); return next })}
        onSelectAll={() => setCafeFilter(new Set(cafeOptions.map((o) => o.name)))}
        onClear={() => setCafeFilter(new Set())}
        isOpen={openFilter === "cafe"}
        onClose={() => setOpenFilter(null)}
        onClick={() => setOpenFilter(openFilter === "cafe" ? null : "cafe")}
      />
      <FilterChip
        label="location"
        active={locationFilter.size > 0}
        count={locationFilter.size}
        options={locationOptions}
        selected={locationFilter}
        onToggle={(name) => setLocationFilter((prev) => { const next = new Set(prev); next.has(name) ? next.delete(name) : next.add(name); return next })}
        onSelectAll={() => setLocationFilter(new Set(locationOptions.map((o) => o.name)))}
        onClear={() => setLocationFilter(new Set())}
        isOpen={openFilter === "location"}
        onClose={() => setOpenFilter(null)}
        onClick={() => setOpenFilter(openFilter === "location" ? null : "location")}
      />
    </div>
    <div className="flex items-center gap-3">
      <div className="flex rounded-xl border-2 border-border bg-transparent p-1">
        <button onClick={() => setSortBy("rating")} className={cn("rounded-md px-3 py-1.5 font-mono text-xs transition-colors", sortBy === "rating" ? "bg-green-light text-foreground" : "text-muted-foreground hover:text-foreground")}>ranking</button>
        <button onClick={() => setSortBy("latest")} className={cn("rounded-md px-3 py-1.5 font-mono text-xs transition-colors", sortBy === "latest" ? "bg-green-light text-foreground" : "text-muted-foreground hover:text-foreground")}>latest</button>
      </div>
      <button onClick={() => setSortDir((d) => d === "desc" ? "asc" : "desc")} className="flex items-center justify-center p-1 text-green-dark transition-opacity hover:opacity-70" aria-label={sortDir === "desc" ? "Sort ascending" : "Sort descending"}>
        <ArrowUpDown className="size-5" />
      </button>
    </div>
  </div>

</div>
            {/* Empty state */}
            {filteredReceipts.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <div className="text-4xl">🧋</div>
                <p className="font-mono text-sm text-muted-foreground">
                  {receipts.length === 0 ? "no drinks ranked yet" : "no matches"}
                </p>
                {receipts.length === 0 && (
                  <Link
                    href="/"
                    className="rounded-full bg-brown px-5 py-2.5 font-mono text-sm uppercase tracking-wider text-white hover:bg-brown/90"
                  >
                    rank a drink
                  </Link>
                )}
              </div>
            )}

            {/* List view */}
            {view === "list" && filteredReceipts.length > 0 && (
              <div className="flex flex-col divide-y divide-border">
                {filteredReceipts.map((receipt, idx) => (
                  <ListItem
                    key={receipt.id}
                    receipt={receipt}
                    idx={idx}
                    onClick={() => setDetailReceipt(receipt)}
                    onDelete={() => handleDelete(receipt.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Detail modal */}
      {detailReceipt && (
        <DetailSheet
          receipt={detailReceipt}
          onClose={() => setDetailReceipt(null)}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}