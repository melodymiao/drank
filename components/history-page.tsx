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
   Stats bar — flat cards spanning full width, animate in on mount
─────────────────────────────────────────────────────────────── */

function useCountUp(target: number | null, duration = 600): number | null {
  const [value, setValue] = useState<number | null>(null)
  useEffect(() => {
    if (target === null) { setValue(null); return }
    const start = Date.now()
    const tick = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(target * eased * 10) / 10)
      if (progress < 1) requestAnimationFrame(tick)
      else setValue(target)
    }
    requestAnimationFrame(tick)
  }, [target, duration])
  return value
}

/* ─────────────────────────────────────────────────────────────
   Squiggly stat card — real SVG paths that stretch only horizontally.
   The path is drawn in its natural coordinate space (nativeW × nativeH).
   We render the SVG at the card's actual pixel width × nativeH, and use
   a <g transform="scale(xScale, 1)"> so only x-coordinates stretch while
   the stroke width stays constant.
─────────────────────────────────────────────────────────────── */
const SQUIGGLY_CONFIGS = {
  pink: {
    nativeW: 118,
    nativeH: 71,
    stroke: "#F884A3",
    path: "M2.47933 5.6639C2.47933 7.24963 2.31723 11.3081 2.08988 13.3041C1.72222 16.5319 2.53068 19.0074 2.79093 21.0128C3.01264 22.7212 3.28411 24.3883 2.99406 26.2575C2.72636 27.9827 2.3425 30.3012 2.29967 35.9337C2.2788 38.6778 3.41395 40.8321 3.56884 46.521C3.64499 49.3176 3.12263 50.9451 3.06598 56.0735C3.03442 58.9314 3.80052 60.7246 4.3121 62.6455C4.45952 63.199 4.43569 63.8846 4.6088 64.3568C4.7819 64.8291 5.09029 65.0804 5.45867 65.0322C7.27453 64.7947 9.11782 63.9126 10.9097 64.3539C13.4318 64.9751 17.4502 64.7816 19.3589 65.1004C21.6197 65.478 24.643 65.8397 31.3237 65.9148C33.9149 65.944 35.7024 65.4233 39.9513 65.1928C43.8636 64.9805 50.1538 64.9199 53.1935 65.2557C54.9564 65.4505 56.703 66.3457 58.6851 66.9835C61.4079 67.8597 63.1981 68.0376 67.5073 68.087C69.7203 68.1124 71.3493 67.5096 73.6413 66.9669C76.4115 66.3109 78.1804 66.2203 79.8632 65.9664C82.0494 65.6366 84.1225 65.202 86.964 64.9904C94.1682 64.4539 96.5218 65.2289 98.8548 65.4263C101.218 65.6263 107.971 65.9763 112.217 65.569C113.947 65.4032 115.083 64.5774 115.496 64.0697C115.906 63.5653 114.47 62.5007 113.287 61.4292C111.386 59.7075 113.932 55.7562 114.419 52.1645C115.842 41.6613 113.978 39.9354 113.439 37.4049C112.053 30.8985 113.747 28.7685 114.338 24.9239C114.825 21.7601 114.396 18.195 113.496 16.3071C112.502 14.2223 112.768 12.2118 112.476 6.82841C112.413 5.66116 111.844 5.29581 111.438 5.06186C106.796 2.38968 96.2738 4.39894 93.1659 3.78667C90.9305 3.3463 89.1865 3.06706 87.2592 2.60376C85.2553 2.12206 82.1911 1.84618 79.5907 2.09084C76.1728 2.41243 71.1132 2.72775 67.5334 3.41786C61.5139 4.57829 54.0006 4.05203 50.0217 3.94994C47.4742 3.88457 44.9604 3.49734 41.9801 2.90873C37.8402 2.09108 31.4957 2.72781 25.9178 2.66256C22.479 2.62233 20.4869 3.4594 17.718 3.83235C15.8216 4.08779 14.2967 4.73113 12.5654 5.37049C9.7717 5.39846 8.13184 5.24326 6.81275 5.22029C6.1079 5.19936 5.33105 5.1596 3.65483 4.73246",
  },
  green: {
    nativeW: 115,
    nativeH: 68,
    stroke: "#E0DE96",
    path: "M2.00049 4.87294C2.18055 5.3454 2.69684 7.02558 2.92115 9.13777C3.12701 11.0763 2.72088 16.0851 2.92052 20.0785C3.03727 22.4141 3.48668 23.9363 3.62822 33.7436C3.69948 38.6815 4.06737 40.6638 4.27907 44.0179C4.62091 49.4337 4.40017 55.066 4.32196 58.3129C4.28493 59.8502 4.17194 61.5087 4.42649 63.4447C4.63997 65.0683 8.06678 63.5633 12.3058 64.3395C14.461 64.7341 16.4396 64.3621 19.7569 64.0249C21.6032 63.8372 28.2361 63.4095 33.4121 63.7519C35.9198 63.9178 37.4361 64.8247 43.1616 64.5158C51.6683 64.0568 57.6611 64.3698 58.6603 64.2679C59.5797 64.1741 60.3497 64.395 62.514 64.6197C72.9256 65.7004 77.2449 64.7491 78.6385 65.0908C79.985 65.421 81.8755 64.8365 83.4489 64.4269C84.8443 64.0636 86.467 63.15 89.3649 62.9692C91.0625 62.8633 92.7224 63.3838 94.4702 63.5447C96.4909 63.7307 98.5096 63.9856 99.8655 63.4643C102.313 62.5233 106.348 63.1929 107.228 62.9918C109.364 62.5036 107.515 57.3139 108.011 55.8459C108.904 53.2025 110.476 48.439 110.909 46.4861C111.264 44.88 111.772 42.9148 112.195 40.8166C112.929 37.1718 112.622 31.9456 112.472 31.1475C112.167 29.5314 111.246 27.6468 110.302 22.3375C109.811 19.5781 108.828 18.2426 107.96 16.9495C106.412 14.6421 108.393 9.21664 108.618 7.47247C108.664 7.12081 108.796 6.79863 108.846 6.4648C108.895 6.13097 108.895 5.80234 108.506 5.70072C103.484 4.38862 96.0769 5.71028 93.968 5.51741C92.4934 5.38255 91.2255 4.34806 89.0216 3.96494C83.9082 3.07603 81.6575 4.45463 79.7591 4.96105C77.9243 5.45048 74.2485 6.18643 72.2048 5.69872C70.8374 5.37237 69.6162 4.93277 68.7452 3.71453C67.7944 2.38482 63.4568 3.72647 60.8306 4.17444C58.9526 4.49479 56.7369 4.59689 54.9245 4.74756C53.233 4.88817 51.6311 5.00671 49.9985 5.64321C47.3854 6.66202 42.7112 5.52566 39.8611 5.22848C37.718 5.00501 33.7131 3.92456 30.8763 3.61147C27.617 3.25175 25.2994 3.08234 23.4168 2.86407C21.8775 2.6856 20.2636 2.38999 17.5872 2.19167C9.39227 1.58441 7.54697 2.57853 5.46974 2.98156C5.01614 3.06595 4.66112 3.12682 4.28518 3.22225C3.90924 3.31767 3.52314 3.4458 3.03762 4.00093",
  },
  blue: {
    nativeW: 116,
    nativeH: 71,
    stroke: "#9BCFEC",
    path: "M3.13988 7.249C3.13988 7.74643 2.98772 15.5082 3.27234 21.9862C3.48357 26.794 4.30349 28.3571 4.41203 30.6739C4.63791 35.4956 4.19818 40.9842 3.88746 44.494C3.73889 46.1722 2.72157 47.622 2.12276 49.2907C1.52902 50.9453 3.25258 52.9105 3.64103 54.7783C4.08959 56.935 3.96115 58.8577 4.29176 60.7203C4.66024 62.7963 5.2648 63.906 5.62954 64.5642C6.4321 66.0123 16.8591 64.9005 22.2083 65.7306C23.8182 65.9804 25.283 66.6664 29.5648 66.6325C31.8424 66.6145 38.6434 66.002 43.04 66.4106C44.9932 66.5922 47.3637 66.5624 51.6222 66.6299C53.7545 66.6636 55.4677 67.4743 57.1351 67.8164C58.9421 68.1872 61.3818 68.4717 63.0767 67.7423C65.0489 66.8936 67.8106 66.8048 69.8807 66.6697C72.5537 66.4952 76.424 66.7179 85.6589 67.1766C90.1374 67.399 92.6053 67.6732 94.9206 67.3205C97.1446 66.9818 99.059 66.611 100.646 66.1491C102.704 65.5497 105.805 65.4586 110.02 65.0403C111.945 64.8493 111.374 60.9262 111.75 58.7828C112.254 55.91 113.442 53.018 113.455 50.786C113.481 46.1176 112.878 43.4326 112.81 36.4064C112.785 33.8055 112.011 32.3013 110.283 29.5362C109.549 28.3622 109.348 27.3071 109.121 26.4465C108.866 25.4756 109.515 23.9919 110.068 22.0784C110.671 19.9931 110.84 13.5143 110.696 5.42495C110.647 2.64912 110.13 2.59307 109.343 2.56151C105.781 2.41863 104.074 2.79848 102.157 3.03256C100.334 3.25515 98.637 3.56714 96.3745 4.05811C94.4236 4.48146 91.2787 4.63108 88.9835 4.36201C87.4666 4.18417 85.3957 4.7889 79.4904 4.85348C76.693 4.88407 72.1424 4.47357 69.0671 4.1353C67.0127 3.90933 64.9631 2.97468 61.901 2.86691C59.5953 2.78575 57.3474 3.7348 55.7183 4.08042C53.7117 4.50612 51.112 4.6174 48.407 4.56089C46.6138 4.52343 44.9442 2.71756 42.8551 2.17613C40.32 1.5191 37.5657 2.89784 34.6311 3.09101C31.1701 3.31884 24.8813 3.40243 22.0005 3.70925C19.0034 4.02846 15.113 4.07479 10.8149 4.21085C9.04999 4.41227 7.9295 4.68134 6.5755 4.89495C5.62128 4.97786 4.12475 5.00901 2.58288 5.0411",
  },
} as const

function SquigglyStatCard({
  label,
  value,
  color,
  visible,
  delay,
}: {
  label: string
  value: string
  color: "pink" | "green" | "blue"
  visible: boolean
  delay: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerW, setContainerW] = useState<number | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      setContainerW(entries[0].contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { nativeW, nativeH, stroke, path } = SQUIGGLY_CONFIGS[color]
  // Scale x-axis so the path fills the container width, y stays native
  const xScale = containerW != null ? containerW / nativeW : 1

  return (
    <div
      ref={containerRef}
      className="relative min-w-0 flex-1"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
        transition: `opacity 0.35s ease ${delay}ms, transform 0.35s ease ${delay}ms`,
      }}
    >
      {/* SVG — fixed height, full width; only path x-axis scales */}
      <svg
        width={containerW ?? nativeW}
        height={nativeH}
        viewBox={`0 0 ${containerW ?? nativeW} ${nativeH}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0 left-0 top-0 w-full"
        style={{ height: nativeH }}
      >
        <g transform={`scale(${xScale}, 1)`}>
          <path
            d={path}
            stroke={stroke}
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </svg>
      {/* Content — padded to sit inside the squiggly border */}
      <div
        className="relative flex flex-col items-center justify-center"
        style={{ height: nativeH }}
      >
        <span className="font-mono text-lg font-medium leading-tight text-[#473C23]">{value}</span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-[#473C23]/70">{label}</span>
      </div>
    </div>
  )
}

function StatsBar() {
  const [stats, setStats] = useState({ avgScore: null as number | null, uniqueCafes: 0, uniqueCities: 0 })
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const s = getStats()
    setStats({ avgScore: s.avgScore, uniqueCafes: s.uniqueCafes, uniqueCities: s.uniqueCities })
    const t = setTimeout(() => setVisible(true), 60)
    return () => clearTimeout(t)
  }, [])

  const animAvg = useCountUp(stats.avgScore, 700)
  const animCafes = useCountUp(stats.uniqueCafes, 600)
  const animCities = useCountUp(stats.uniqueCities, 650)

  return (
    <div className="flex gap-3">
      {/* cafés — pink */}
      <SquigglyStatCard
        label="cafés"
        value={animCafes !== null ? String(Math.round(animCafes)) : "0"}
        color="pink"
        visible={visible}
        delay={0}
      />
      {/* avg score — green (middle, most important) */}
      <SquigglyStatCard
        label="avg score"
        value={animAvg !== null ? animAvg.toFixed(1) : "—"}
        color="green"
        visible={visible}
        delay={60}
      />
      {/* cities — blue */}
      <SquigglyStatCard
        label="cities"
        value={animCities !== null ? String(Math.round(animCities)) : "0"}
        color="blue"
        visible={visible}
        delay={120}
      />
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
            ? "border-green-light bg-green-light font-medium text-foreground"
            : "border-green-light bg-green-light/25 text-green-dark"
        )}
      >
        All
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
                  Clear all
                </button>
              )}
              <button
                onClick={() => setSubMenu("cafe")}
                className="flex w-full items-center justify-between px-3 py-3.5 font-sans text-xs text-foreground hover:bg-border/40"
              >
                <span>Café {cafeFilter.size > 0 && <span className="ml-1 text-[10px] text-muted-foreground">({cafeFilter.size})</span>}</span>
                <ChevronDown className="-rotate-90 size-3 opacity-50" />
              </button>
              <button
                onClick={() => setSubMenu("location")}
                className="flex w-full items-center justify-between px-3 py-3.5 font-sans text-xs text-foreground hover:bg-border/40"
              >
                <span>Location {locationFilter.size > 0 && <span className="ml-1 text-[10px] text-muted-foreground">({locationFilter.size})</span>}</span>
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
                <span className="font-mono text-xs font-medium">Café</span>
                <div className="flex gap-3">
                  <button
                    onClick={() => { cafeOptions.forEach(o => onToggleCafe(o.name)) }}
                    className="font-sans text-[11px] text-green-dark underline"
                  >
                    All
                  </button>
                  <button
                    onClick={() => { cafeOptions.forEach(o => { if (cafeFilter.has(o.name)) onToggleCafe(o.name) }) }}
                    className="font-sans text-[11px] text-muted-foreground underline"
                  >
                    Clear
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
                <span className="font-mono text-xs font-medium">Location</span>
                <div className="flex gap-3">
                  <button
                    onClick={() => { locationOptions.forEach(o => onToggleLocation(o.name)) }}
                    className="font-sans text-[11px] text-green-dark underline"
                  >
                    All
                  </button>
                  <button
                    onClick={() => { locationOptions.forEach(o => { if (locationFilter.has(o.name)) onToggleLocation(o.name) }) }}
                    className="font-sans text-[11px] text-muted-foreground underline"
                  >
                    Clear
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
            ? "border-green-light bg-green-light font-medium text-foreground"
            : "border-green-light text-green-dark"
        )}
        >
        {label}
        {count !== undefined && count > 0 && (
          <span className="flex size-4 items-center justify-center rounded-full bg-foreground/15 text-[9px]">
            {count}
          </span>
        )}
        {label !== "All" && (
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
                All
              </button>
              <button onClick={onClear} className="font-sans text-[11px] text-muted-foreground underline">
                Clear
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
            <span className="line-clamp-2 font-mono text-md font-medium text-foreground">
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
        <button onClick={() => setSortBy("rating")} className={cn("rounded-md px-3 py-1.5 font-mono text-xs transition-colors", sortBy === "rating" ? "bg-green-light font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}>Ranking</button>
        <button onClick={() => setSortBy("latest")} className={cn("rounded-md px-3 py-1.5 font-mono text-xs transition-colors", sortBy === "latest" ? "bg-green-light font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}>Latest</button>
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
        label="All"
        active={activeFilterCount === 0}
        onClick={() => { setCafeFilter(new Set()); setLocationFilter(new Set()); setOpenFilter(null) }}
      />
      <FilterChip
        label="Café"
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
        label="Location"
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
        <button onClick={() => setSortBy("rating")} className={cn("rounded-md px-3 py-1.5 font-mono text-xs transition-colors", sortBy === "rating" ? "bg-green-light font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}>Ranking</button>
        <button onClick={() => setSortBy("latest")} className={cn("rounded-md px-3 py-1.5 font-mono text-xs transition-colors", sortBy === "latest" ? "bg-green-light font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}>Latest</button>
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