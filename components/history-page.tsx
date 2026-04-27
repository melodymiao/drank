"use client"

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LayoutList, LayoutGrid, ChevronDown, Trash2, Pencil, ArrowUpDown } from "lucide-react"
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
function StatsBar() {
  const [stats, setStats] = useState({ totalRanked: 0, avgScore: null as number | null, uniqueCafes: 0, uniqueCities: 0 })

  useEffect(() => {
    setStats(getStats())
  }, [])

  const items = [
    { label: "ranked", value: stats.totalRanked },
    { label: "avg score", value: stats.avgScore !== null ? stats.avgScore.toFixed(1) : "—" },
    { label: "cafés", value: stats.uniqueCafes },
    { label: "cities", value: stats.uniqueCities },
  ]

  return (
    <div className="flex gap-3 overflow-x-auto pb-1 md:overflow-x-visible">
      {items.map(({ label, value }) => (
        <div key={label} className="flex shrink-0 flex-col items-center rounded-xl border border-border bg-card px-4 py-6 md:flex-1 md:shrink">
          <span className="font-mono text-lg font-medium text-foreground leading-tight">{value}</span>
          <span className="font-sans text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        </div>
      ))}
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
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        onClose?.()
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [isOpen, onClose])

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <button
        onClick={onClick}
        className={cn(
          "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-xs transition-colors",
          active || isOpen
            ? "bg-[#E0DE96] text-foreground"
            : "border border-border bg-card text-foreground hover:bg-border/60"
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

      {isOpen && options && selected && onToggle && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-72 rounded-xl border border-border bg-card shadow-lg">
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

          <div className="max-h-60 overflow-y-auto px-2 py-2">
            {options.length === 0 && (
              <p className="px-1 py-1 font-sans text-xs text-muted-foreground">no options yet</p>
            )}
            {options.map(({ name, count: optCount }) => (
              <button
                key={name}
                onClick={() => onToggle(name)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-3 font-mono text-xs transition-colors",
                  selected.has(name)
                    ? "bg-green-light text-foreground"
                    : "text-foreground hover:bg-border/50"
                )}
              >
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
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

      <p className="mb-3 break-words text-center text-xs font-medium" style={{ ...IBM_PLEX, color: RECEIPT_TEXT_COLOR }}>
        {receipt.cafeName || "cafe"}
      </p>

      <h3 className="mb-3 break-words text-center text-2xl font-medium leading-tight" style={{ ...IBM_PLEX, color: RECEIPT_TEXT_COLOR }}>
        {receipt.drinkName || "Beverage"}
      </h3>

      {customizations.length > 0 && (
        <p className="mb-3 break-words text-center text-sm font-medium" style={{ ...IBM_PLEX, color: RECEIPT_TEXT_COLOR }}>
          {customizations.join(", ")}
        </p>
      )}

      {receipt.comments?.trim() && (
        <p className="mb-3 break-words text-xs font-light" style={{ ...IBM_PLEX, color: RECEIPT_TEXT_COLOR }}>
          Notes: {receipt.comments.trim()}
        </p>
      )}

      {receipt.location?.trim() && (
        <p className="break-words text-xs font-light" style={{ ...IBM_PLEX, color: RECEIPT_TEXT_COLOR }}>
          {receipt.location.trim()}
        </p>
      )}

      <p className="mb-3 text-xs font-light" style={{ ...IBM_PLEX, color: RECEIPT_TEXT_COLOR }}>
        {receiptFormatDate(receipt.date)} {receiptFormatTime(receipt.time)}
      </p>

      <div className="mb-3 border-t" style={{ borderColor: RECEIPT_TEXT_COLOR, opacity: 0.2 }} />

      <p className="text-center text-xs font-normal" style={{ ...IBM_PLEX, color: RECEIPT_TEXT_COLOR }}>
        Ranked with <span className="font-medium" style={IBM_PLEX}>drank</span>
      </p>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Receipt detail modal
─────────────────────────────────────────────────────────────── */
interface DetailSheetProps {
  receipt: SavedReceipt
  onClose: () => void
  onEdit: (receipt: SavedReceipt) => void
  onDelete: (id: string) => void
}

function DetailSheet({ receipt, onClose, onEdit, onDelete }: DetailSheetProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
      <div
        className="flex w-full max-w-[340px] flex-col gap-4 rounded-md p-4 shadow-xl"
        style={{ backgroundColor: "oklch(0.958 0.012 85)" }}
      >
        <div className="text-center">
          <p className="font-sans text-sm text-foreground">
            {receipt.drinkName || "Beverage"}
          </p>
          {receipt.cafeName && (
            <p className="font-sans text-xs text-muted-foreground">{receipt.cafeName}</p>
          )}
        </div>

        {/* Scrollable content: saved canvas image if available, else DOM receipt */}
        <div className="max-h-[60vh] overflow-y-auto">
          {receipt.savedCanvasDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={receipt.savedCanvasDataUrl}
              alt={receipt.drinkName || "Saved receipt"}
              className="mx-auto w-full max-w-[280px] rounded-sm shadow-md"
            />
          ) : (
            <MiniReceipt receipt={receipt} />
          )}
        </div>

        <div className="flex gap-3">
          <Button
            size="lg"
            className="flex-1 rounded-full border-2 border-border font-sans text-sm text-foreground hover:brightness-95"
            style={{ backgroundColor: "oklch(0.958 0.012 85)" }}
            onClick={onClose}
          >
            Close
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
        <button
          onClick={() => setConfirmDelete(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-full border border-pink-dark/40 py-2 font-sans text-sm text-pink-dark transition-colors hover:bg-pink-dark/10"
        >
          <Trash2 className="size-3.5" />
          delete
        </button>
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
   List item with long-press / right-click delete
─────────────────────────────────────────────────────────────── */
interface ListItemProps {
  receipt: SavedReceipt
  idx: number
  onClick: () => void
  onDelete: () => void
}

function ListItem({ receipt, idx, onClick, onDelete }: ListItemProps) {
  const [showContextDelete, setShowContextDelete] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = useRef(false)

  const handleTouchStart = () => {
    didLongPress.current = false
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true
      setShowContextDelete(true)
    }, 500)
  }

  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
  }

  const handleClick = () => {
    if (didLongPress.current) return
    onClick()
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setShowContextDelete(true)
  }

  return (
    <>
      <button
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onContextMenu={handleContextMenu}
        className="flex items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-border/30 w-full"
      >
        {/* Rank number */}
        <span className="w-5 shrink-0 font-mono text-xs text-muted-foreground">
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
                "size-12 shrink-0 rounded-md",
                receipt.bgRemovedImageDataUrl ? "object-contain" : "object-cover"
              )}
            />
          ) : (
            <CupPlaceholder className="size-12 shrink-0 rounded-md" />
          )
        })()}

        {/* Info */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate font-mono text-sm font-medium text-foreground">
            {receipt.drinkName || "Beverage"}
          </span>
          <span className="truncate font-sans text-xs text-muted-foreground">
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

      {/* Context delete overlay */}
      {showContextDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl bg-card p-6 shadow-lg">
            <div className="flex flex-col gap-1.5">
              <p className="font-mono text-sm font-medium text-foreground">delete this receipt?</p>
              <p className="font-sans text-sm text-muted-foreground">
                {receipt.drinkName || "Beverage"}{receipt.cafeName ? ` · ${receipt.cafeName}` : ""}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                className="flex-1 rounded-full border border-border py-2.5 font-mono text-sm text-foreground transition-colors hover:bg-border/60"
                onClick={() => setShowContextDelete(false)}
              >
                keep it
              </button>
              <button
                className="flex-1 rounded-full bg-pink-dark py-2.5 font-mono text-sm text-white transition-colors hover:bg-pink-dark/90"
                onClick={() => {
                  setShowContextDelete(false)
                  onDelete()
                }}
              >
                delete
              </button>
            </div>
          </div>
        </div>
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
      <NavDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
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

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[700px] px-4 pb-20 md:px-6">
            <div className="mb-4">
              <StatsBar />
            </div>

            {/* Toolbar: filters + sort + view toggle */}
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex gap-2">
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
                  onToggle={(name) => setCafeFilter((prev) => {
                    const next = new Set(prev)
                    next.has(name) ? next.delete(name) : next.add(name)
                    return next
                  })}
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
                  onToggle={(name) => setLocationFilter((prev) => {
                    const next = new Set(prev)
                    next.has(name) ? next.delete(name) : next.add(name)
                    return next
                  })}
                  onSelectAll={() => setLocationFilter(new Set(locationOptions.map((o) => o.name)))}
                  onClear={() => setLocationFilter(new Set())}
                  isOpen={openFilter === "location"}
                  onClose={() => setOpenFilter(null)}
                  onClick={() => setOpenFilter(openFilter === "location" ? null : "location")}
                />
              </div>

              {/* Sort + View toggles — right side */}
              <div className="flex shrink-0 items-center gap-2">
                {/* Sort toggle */}
                <div className="flex overflow-hidden rounded-full border border-border bg-card">
                  <button
                    onClick={() => setSortBy("rating")}
                    className={cn(
                      "px-3 py-1.5 font-mono text-xs transition-colors",
                      sortBy === "rating" ? "bg-[#D9D88A] text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    ranking
                  </button>
                  <button
                    onClick={() => setSortBy("latest")}
                    className={cn(
                      "px-3 py-1.5 font-mono text-xs transition-colors",
                      sortBy === "latest" ? "bg-[#D9D88A] text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    latest
                  </button>
                </div>

                {/* Flip direction */}
                <button
                  onClick={() => setSortDir((d) => d === "desc" ? "asc" : "desc")}
                  className={cn(
                    "flex items-center justify-center rounded-full border border-border bg-card p-1.5 transition-colors hover:text-foreground",
                    sortDir === "asc" ? "text-foreground" : "text-muted-foreground"
                  )}
                  aria-label={sortDir === "desc" ? "Sort ascending" : "Sort descending"}
                  title={sortDir === "desc" ? "Sort ascending" : "Sort descending"}
                >
                  <ArrowUpDown className={cn("size-3.5 transition-transform", sortDir === "asc" && "rotate-180")} />
                </button>

                {/* View toggle */}
                <div className="flex overflow-hidden rounded-full border border-border bg-card">
                  <button
                    onClick={() => setView("list")}
                    className={cn(
                      "p-1.5 transition-colors",
                      view === "list" ? "bg-[#D9D88A] text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                    aria-label="List view"
                  >
                    <LayoutList className="size-4" />
                  </button>
                  <button
                    onClick={() => setView("gallery")}
                    className={cn(
                      "p-1.5 transition-colors",
                      view === "gallery" ? "bg-[#D9D88A] text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                    aria-label="Gallery view"
                  >
                    <LayoutGrid className="size-4" />
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

            {/* Gallery view */}
            {view === "gallery" && filteredReceipts.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {filteredReceipts.map((receipt) => {
                  const thumb = receipt.bgRemovedImageDataUrl ?? receipt.thumbnailDataUrl
                  return (
                    <button
                      key={receipt.id}
                      onClick={() => setDetailReceipt(receipt)}
                      className="relative aspect-square overflow-hidden rounded-xl bg-border/30 transition-transform hover:scale-[0.98]"
                    >
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt={receipt.drinkName}
                          className={cn(
                            "absolute inset-0 h-full w-full",
                            receipt.bgRemovedImageDataUrl ? "object-contain p-3" : "object-cover"
                          )}
                        />
                      ) : (
                        <CupPlaceholder className="absolute inset-0 h-full w-full" />
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

                      <div
                        className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full font-mono text-xs font-medium shadow"
                        style={{ backgroundColor: getRatingColor(receipt.rating), color: "#473C23" }}
                      >
                        {receipt.rating || "—"}
                      </div>

                      <div className="absolute bottom-0 left-0 right-0 px-2 py-2">
                        <p className="truncate font-mono text-xs font-medium text-white">
                          {receipt.drinkName || "Beverage"}
                        </p>
                        {receipt.cafeName && (
                          <p className="truncate font-sans text-[10px] text-white/70">
                            {receipt.cafeName}
                          </p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </main>

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