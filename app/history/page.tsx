"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, LayoutList, LayoutGrid, SlidersHorizontal, X, ChevronDown, Trash2, Pencil, Share2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getReceipts,
  deleteReceipt,
  getStats,
  getCafeOptions,
  getLocationOptions,
  type SavedReceipt,
} from "@/lib/receipt-store"
import type { ReceiptData } from "@/components/decorate-step"
import { NavDrawer, HamburgerButton } from "@/components/ui/nav-drawer"

/* ─────────────────────────────────────────────────────────────
   Helpers
─────────────────────────────────────────────────────────────── */

function formatDate(dateStr: string): string {
  if (!dateStr) return ""
  // YYYY-MM-DD → YYYYMMDD
  return dateStr.replace(/-/g, "")
}

function formatTime(timeStr: string): string {
  if (!timeStr) return ""
  const [h, m] = timeStr.split(":").map(Number)
  const ampm = h >= 12 ? "pm" : "am"
  const hour = ((h % 12) || 12)
  return `${hour}:${String(m).padStart(2, "0")}${ampm}`
}

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
   Stats bar
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
    <div className="flex gap-3 overflow-x-auto pb-1">
      {items.map(({ label, value }) => (
        <div key={label} className="flex shrink-0 flex-col items-center rounded-xl border border-border bg-card px-4 py-2.5">
          <span className="font-mono text-lg font-medium text-foreground leading-tight">{value}</span>
          <span className="font-sans text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Filter chip
─────────────────────────────────────────────────────────────── */
interface FilterChipProps {
  label: string
  active: boolean
  count?: number
  onClick: () => void
}

function FilterChip({ label, active, count, onClick }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-xs transition-colors",
        active
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
      {(label !== "all") && <ChevronDown className="size-3 opacity-50" />}
    </button>
  )
}

/* ─────────────────────────────────────────────────────────────
   Filter drawer (bottom sheet)
─────────────────────────────────────────────────────────────── */
interface FilterDrawerProps {
  title: string
  options: Array<{ name: string; count: number }>
  selected: Set<string>
  onToggle: (name: string) => void
  onSelectAll: () => void
  onClear: () => void
  onDone: () => void
}

function FilterDrawer({ title, options, selected, onToggle, onSelectAll, onClear, onDone }: FilterDrawerProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onDone} />
      <div className="relative z-10 flex max-h-[70vh] flex-col rounded-t-2xl bg-card shadow-xl">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <span className="font-mono text-sm font-medium text-foreground">{title}</span>
          <div className="flex gap-3">
            <button onClick={onSelectAll} className="font-sans text-xs text-green-dark underline">
              select all
            </button>
            <button onClick={onClear} className="font-sans text-xs text-muted-foreground underline">
              clear
            </button>
          </div>
        </div>

        {/* Options grid */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="flex flex-wrap gap-2">
            {options.map(({ name, count }) => (
              <button
                key={name}
                onClick={() => onToggle(name)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-xs transition-colors",
                  selected.has(name)
                    ? "bg-[#E0DE96] text-foreground"
                    : "border border-border bg-background text-foreground hover:bg-border/60"
                )}
              >
                {name}
                <span className="opacity-60">({count})</span>
              </button>
            ))}
            {options.length === 0 && (
              <p className="font-sans text-sm text-muted-foreground">no options yet</p>
            )}
          </div>
        </div>

        {/* Done button */}
        <div className="border-t border-border p-4">
          <button
            onClick={onDone}
            className="w-full rounded-full bg-brown py-3 font-mono text-sm uppercase tracking-wider text-white hover:bg-brown/90"
          >
            done
          </button>
        </div>
      </div>
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
   Mini receipt preview (for detail sheet)
─────────────────────────────────────────────────────────────── */
function MiniReceipt({ receipt }: { receipt: SavedReceipt }) {
  function toTitleCase(s: string) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : ""
  }

  const customizations: string[] = []
  if (receipt.iceTemp) customizations.push(toTitleCase(receipt.iceTemp))
  if (receipt.iceLevel) customizations.push(`${toTitleCase(receipt.iceLevel)} Ice`)
  if (receipt.sugarLevel) customizations.push(`${toTitleCase(receipt.sugarLevel)} Sugar`)
  const milkDisplay = receipt.milk === "other" && receipt.otherMilk ? receipt.otherMilk : receipt.milk
  if (milkDisplay) customizations.push(`${toTitleCase(milkDisplay)} Milk`)
  if (receipt.toppings?.length) customizations.push(...receipt.toppings.map(toTitleCase))
  if (receipt.otherCustomizations) customizations.push(toTitleCase(receipt.otherCustomizations))

  const dateFormatted = receipt.date ? receipt.date.replace(/-/g, "") : ""
  const timeFormatted = receipt.time ? formatTime(receipt.time) : ""

  return (
    <div
      className="mx-auto w-[240px] rounded-sm px-4 py-5 shadow-md"
      style={{ backgroundColor: "#FEFCF4", color: "#473C23", fontFamily: "'IBM Plex Mono', monospace" }}
    >
      {/* Rating circle */}
      <div className="mb-2 flex justify-center">
        <div
          className="flex size-12 items-center justify-center rounded-full border-2 text-base font-normal"
          style={{ borderColor: "#473C23" }}
        >
          {receipt.rating || "—"}
        </div>
      </div>

      {/* Café */}
      {receipt.cafeName && (
        <p className="mb-1 text-center text-xs font-medium">{receipt.cafeName}</p>
      )}

      {/* Drink */}
      <p className="mb-2 text-center text-base font-medium leading-tight">
        {receipt.drinkName || "Beverage"}
      </p>

      {/* Customizations */}
      {customizations.length > 0 && (
        <p className="mb-2 text-center text-xs font-medium">{customizations.join(", ")}</p>
      )}

      {/* Notes */}
      {receipt.comments?.trim() && (
        <p className="mb-2 text-xs font-light">Notes: {receipt.comments.trim()}</p>
      )}

      {/* Location */}
      {receipt.location?.trim() && (
        <p className="text-xs font-light">{receipt.location.trim()}</p>
      )}

      {/* Date/time */}
      <p className="mb-2 text-xs font-light">
        {dateFormatted}{timeFormatted ? ` · ${timeFormatted}` : ""}
      </p>

      {/* Divider */}
      <div className="mb-2 border-t opacity-20" />

      {/* Footer */}
      <p className="text-center text-xs">
        Ranked with <span className="font-medium">drank</span>
      </p>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Receipt detail bottom sheet
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
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] flex-col rounded-t-2xl bg-card shadow-xl">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <MiniReceipt receipt={receipt} />
        </div>

        {/* Action row */}
        <div className="flex gap-2 border-t border-border px-4 py-4">
          <button
            onClick={() => onEdit(receipt)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border py-2.5 font-mono text-xs text-foreground transition-colors hover:bg-border/60"
          >
            <Pencil className="size-3.5" />
            edit
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-pink-dark/40 py-2.5 font-mono text-xs text-pink-dark transition-colors hover:bg-pink-dark/10"
          >
            <Trash2 className="size-3.5" />
            delete
          </button>
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
   Main page
─────────────────────────────────────────────────────────────── */
export default function HistoryPage() {
  const router = useRouter()
  const [receipts, setReceipts] = useState<SavedReceipt[]>([])
  const [view, setView] = useState<"list" | "gallery">("list")
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Filter state
  const [cafeFilter, setCafeFilter] = useState<Set<string>>(new Set())
  const [locationFilter, setLocationFilter] = useState<Set<string>>(new Set())
  const [openFilter, setOpenFilter] = useState<"cafe" | "location" | null>(null)

  // Detail sheet
  const [detailReceipt, setDetailReceipt] = useState<SavedReceipt | null>(null)

  // Load receipts on mount
  useEffect(() => {
    setReceipts(getReceipts())
  }, [])

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
    setReceipts(getReceipts())
    setDetailReceipt(null)
  }, [])

  const handleEdit = useCallback((receipt: SavedReceipt) => {
    // Store receipt data in sessionStorage for page.tsx to pick up
    sessionStorage.setItem("drank_edit_receipt", JSON.stringify(receipt))
    router.push("/")
  }, [router])

  const activeFilterCount = cafeFilter.size + locationFilter.size

  return (
    <div className="flex h-dvh bg-background">
      {/* Nav drawer */}
      <NavDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex shrink-0 items-center px-4 pt-4 pb-3 md:px-6">
          <div className="w-9 md:hidden">
            <HamburgerButton onClick={() => setDrawerOpen(true)} />
          </div>
          <div className="flex flex-1 justify-center">
            <Image src="/logo.png" alt="drank" width={80} height={24} className="h-6 w-auto" priority />
          </div>
          <div className="w-9 md:hidden" />
        </header>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[700px] px-4 pb-20 md:px-6">
            {/* Stats */}
            <div className="mb-4">
              <StatsBar />
            </div>

            {/* Toolbar: filters + view toggle */}
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex gap-2 overflow-x-auto pb-1">
                <FilterChip
                  label="all"
                  active={activeFilterCount === 0}
                  onClick={() => { setCafeFilter(new Set()); setLocationFilter(new Set()) }}
                />
                <FilterChip
                  label="café"
                  active={cafeFilter.size > 0}
                  count={cafeFilter.size}
                  onClick={() => setOpenFilter("cafe")}
                />
                <FilterChip
                  label="location"
                  active={locationFilter.size > 0}
                  count={locationFilter.size}
                  onClick={() => setOpenFilter("location")}
                />
              </div>

              {/* View toggle */}
              <div className="flex shrink-0 overflow-hidden rounded-lg border border-border bg-card">
                <button
                  onClick={() => setView("list")}
                  className={cn(
                    "p-2 transition-colors",
                    view === "list" ? "bg-[#E0DE96] text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-label="List view"
                >
                  <LayoutList className="size-4" />
                </button>
                <button
                  onClick={() => setView("gallery")}
                  className={cn(
                    "p-2 transition-colors",
                    view === "gallery" ? "bg-[#E0DE96] text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-label="Gallery view"
                >
                  <LayoutGrid className="size-4" />
                </button>
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
                  <button
                    key={receipt.id}
                    onClick={() => setDetailReceipt(receipt)}
                    className="flex items-center gap-3 py-3 text-left transition-colors hover:bg-border/30"
                  >
                    {/* Rank number */}
                    <span className="w-5 shrink-0 font-mono text-xs text-muted-foreground">
                      {idx + 1}
                    </span>

                    {/* Thumbnail */}
                    {receipt.thumbnailDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={receipt.thumbnailDataUrl}
                        alt={receipt.drinkName}
                        className="size-9 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <CupPlaceholder className="size-9 shrink-0 rounded-md" />
                    )}

                    {/* Info */}
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate font-mono text-sm font-medium text-foreground">
                        {receipt.drinkName || "Beverage"}
                      </span>
                      <span className="truncate font-sans text-xs text-muted-foreground">
                        {[receipt.cafeName, receipt.location].filter(Boolean).join(" · ")}
                      </span>
                    </div>

                    {/* Rating badge */}
                    <div
                      className="flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-xs font-medium"
                      style={{ backgroundColor: getRatingColor(receipt.rating), color: "#473C23" }}
                    >
                      {receipt.rating || "—"}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Gallery view */}
            {view === "gallery" && filteredReceipts.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {filteredReceipts.map((receipt) => (
                  <button
                    key={receipt.id}
                    onClick={() => setDetailReceipt(receipt)}
                    className="relative aspect-square overflow-hidden rounded-xl bg-border/30 transition-transform hover:scale-[0.98]"
                  >
                    {receipt.thumbnailDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={receipt.thumbnailDataUrl}
                        alt={receipt.drinkName}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <CupPlaceholder className="absolute inset-0 h-full w-full" />
                    )}

                    {/* Overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

                    {/* Rating badge top-right */}
                    <div
                      className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full font-mono text-xs font-medium shadow"
                      style={{ backgroundColor: getRatingColor(receipt.rating), color: "#473C23" }}
                    >
                      {receipt.rating || "—"}
                    </div>

                    {/* Drink name bottom */}
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
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Filter drawers */}
      {openFilter === "cafe" && (
        <FilterDrawer
          title="filter by café"
          options={cafeOptions}
          selected={cafeFilter}
          onToggle={(name) => setCafeFilter((prev) => {
            const next = new Set(prev)
            next.has(name) ? next.delete(name) : next.add(name)
            return next
          })}
          onSelectAll={() => setCafeFilter(new Set(cafeOptions.map((o) => o.name)))}
          onClear={() => setCafeFilter(new Set())}
          onDone={() => setOpenFilter(null)}
        />
      )}

      {openFilter === "location" && (
        <FilterDrawer
          title="filter by location"
          options={locationOptions}
          selected={locationFilter}
          onToggle={(name) => setLocationFilter((prev) => {
            const next = new Set(prev)
            next.has(name) ? next.delete(name) : next.add(name)
            return next
          })}
          onSelectAll={() => setLocationFilter(new Set(locationOptions.map((o) => o.name)))}
          onClear={() => setLocationFilter(new Set())}
          onDone={() => setOpenFilter(null)}
        />
      )}

      {/* Detail sheet */}
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