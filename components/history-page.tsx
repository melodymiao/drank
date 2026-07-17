"use client"

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { Bree_Serif, Permanent_Marker, Domine } from "next/font/google"
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

const _breeSerif = Bree_Serif({ variable: "--font-bree-serif", subsets: ["latin"], weight: "400" })
const _permanentMarker = Permanent_Marker({ variable: "--font-permanent-marker", subsets: ["latin"], weight: "400" })
const _domine = Domine({ variable: "--font-domine", subsets: ["latin"], weight: "700" })

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
   Cup placeholder SVGs (when no photo) — 3 variants, picked by index
─────────────────────────────────────────────────────────────── */
const CUP_SVGS = [
  // cup_1 — pink, tall boba cup
  (
    <svg viewBox="0 0 99 144" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3.137 24.0125C7.07079 24.0125 23.8587 23.5858 34.5447 22.8491C41.4896 22.3703 65.2899 21.8866 79.1468 22.8776C85.1953 23.3101 90.9097 23.7088 95.752 23.1975C97.6299 22.9992 96.3299 19.2569 95.6639 16.9157C95.0529 14.7681 91.7346 14.6499 89.5691 13.9353C85.3228 12.5339 86.8549 6.62385 85.7371 4.73053C83.3526 0.691785 72.3278 2.17524 65.0895 2.71594C59.132 3.16098 49.5079 3.89809 41.9284 3.28435C36.8237 2.871 27.3409 1.84976 19.698 3.06698C15.0445 3.8081 10.636 5.50465 7.61673 8.65506C6.64928 13.9127 4.51949 16.5765 2.92891 18.1379C2.29926 19.0591 2.03003 20.2421 2 22.5327" stroke="#F884A3" strokeWidth="4" strokeLinecap="round"/>
      <path d="M10.3806 26.1785C10.3806 30.0721 10.967 41.6108 11.7471 47.3481C12.4264 52.3436 13.551 58.0068 14.4079 63.1576C15.2666 68.3191 18.564 84.6545 20.917 95.999C21.9702 101.077 22.363 105.813 23.1975 111.347C23.9528 116.357 24.5391 121.513 25.4058 126.475C25.9294 129.472 26.647 132.544 27.6852 134.836C29.7353 139.361 40.8212 138.174 51.1081 140.133C66.5797 143.079 78.4104 140.201 80.5551 139.243C81.6179 138.769 82.408 137.884 82.662 136.845C84.5639 129.062 82.8439 117.725 84.0628 112.072C85.528 105.275 85.8244 99.3233 86.3739 93.4398C86.7833 83.6086 87.0707 63.5962 87.3661 37.8698C87.5675 28.7601 87.8737 27.661 89.0295 24.4453" stroke="#F884A3" strokeWidth="4" strokeLinecap="round"/>
    </svg>
  ),
  // cup_2 — yellow/green, tall cup with straw
  (
    <svg viewBox="0 0 97 188" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 68.2795C15.117 68.2795 45.2181 68.0356 52.0777 67.1815C60.245 66.1647 69.7872 64.1332 79.6414 63.7317C83.5496 63.5724 89.2341 63.5266 92.1889 62.3077C95.1436 61.0889 95.199 58.7921 94.7084 57.0999C93.8418 54.1111 89.5927 53.3406 85.7999 52.5146C80.1228 51.2783 79.0926 43.0375 74.7383 39.1732C70.2908 35.2261 64.5312 32.4445 58.4951 30.3383C52.0111 28.0759 45.0039 27.5516 30.9709 27.4545C23.3278 27.4016 19.0624 33.1225 14.1461 38.2784C9.83203 42.8027 9.58379 49.9031 6.19104 54.4201C5.33227 55.5635 3.65929 55.8323 3.07655 56.8754C2.4938 57.9185 2.75803 59.4337 3.0161 60.958C3.27417 62.4822 3.51808 63.9697 3.76938 66.8964" stroke="#E0DE96" strokeWidth="4" strokeLinecap="round"/>
      <path d="M9.26221 66.5721C9.77219 71.679 11.2954 84.8188 12.1406 91.0492C13.1287 98.333 13.0137 108.898 15.1132 123.135C16.2852 131.083 19.5446 140.465 21.4495 148.522C23.3126 156.404 23.3068 162.931 24.4448 169.29C25.0051 172.421 25.2576 175.562 25.9679 178.392C29.7096 193.301 69.8712 181.32 74.8213 178.067C79.6083 174.921 77.5217 166.711 78.036 158.276C78.4648 151.243 79.3363 144.24 81.2589 131.379C82.6973 121.758 83.6392 110.89 84.2946 100.754C84.7648 82.2531 86.053 75.0171 86.9082 68.6906C87.2404 66.0025 87.366 64.3746 88.005 61.0176" stroke="#E0DE96" strokeWidth="4" strokeLinecap="round"/>
      <path d="M41.2488 28.2352C41.4722 26.4039 41.7048 15.8296 42.6268 5.90259C42.951 2.41288 44.9088 2.37996 46.3974 2.2009C47.8861 2.02183 49.3384 1.77793 50.0247 2.40155C49.7778 7.46826 48.3935 13.4587 48.5681 18.9277C48.7427 21.25 49.0919 22.6524 50.1013 27.1938" stroke="#E0DE96" strokeWidth="4" strokeLinecap="round"/>
    </svg>
  ),
  // cup_3 — blue, wide cup with handle
  (
    <svg viewBox="0 0 169 113" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M93.1383 6.95878C90.6715 6.75726 80.3823 4.64683 65.9237 2.65385C42.3581 -0.594443 23.7042 9.07027 14.4667 13.4928C8.73337 16.2377 4.61224 19.8674 2.46128 21.6657C1.49679 22.4721 2.19688 24.2309 3.08728 25.2824C6.87974 29.7608 14.6368 30.1318 23.9985 33.9704C38.0972 39.7514 73.4053 32.3144 86.5135 29.2873C94.1904 27.5144 103.789 24.2929 108.302 19.1131C110.652 16.415 109.371 12.2609 108.662 9.65316C106.536 7.63114 103.605 6.56683 100.646 6.1492C99.1574 5.91636 97.6958 5.64104 93.3567 4.74706" stroke="#9BCFEC" strokeWidth="4" strokeLinecap="round"/>
      <path d="M2.62573 27.4131C2.62573 31.6054 3.35006 43.7899 4.62949 51.2928C6.31048 61.1506 8.3369 70.5735 9.64265 78.072C10.7463 84.4098 11.8409 90.5311 12.9091 96.5735C13.1934 98.1813 13.5745 99.8564 14.2201 101.295C14.8658 102.734 15.7897 103.882 17.7327 104.486C26.7309 107.283 33.7299 108.133 40.0675 109.84C47.1425 111.745 71.6497 110.904 89.9646 108.791C99.7126 107.667 104.594 102.365 107.526 99.6895C112.729 94.9413 111.366 85.4076 114.064 76.8953C118.526 62.8198 117.098 54.7088 117.368 32.5598C116.505 26.2242 115.382 23.185 114.526 20.3263C114.155 18.8848 113.911 17.462 113.66 15.3242" stroke="#9BCFEC" strokeWidth="4" strokeLinecap="round"/>
      <path d="M121.65 41.5794C123.464 40.4576 130.53 37.1555 143.588 36.865C147.85 36.7702 150.343 40.5994 152.512 44.1605C156.356 50.4703 154.921 60.7039 151.354 69.5364C146.41 73.7859 141.726 75.0315 136.151 75.5775C131.95 75.7631 124.966 75.7631 115.933 73.4842" stroke="#9BCFEC" strokeWidth="4" strokeLinecap="round"/>
      <path d="M121.739 34.395C123.36 33.8093 130.178 31.7775 139.02 30.7804C146.191 29.9717 153.24 28.8349 159.099 31.7874C165.219 34.871 165.668 43.0664 166.156 65.1162C166.291 71.2209 164.038 73.7573 162.072 75.9824C158.151 80.4211 151.608 81.7906 143.439 82.2886C139.867 82.8346 136.219 83.5737 130.414 84.1852C126.614 84.4328 121.08 84.5529 112.898 82.0394" stroke="#9BCFEC" strokeWidth="4" strokeLinecap="round"/>
    </svg>
  ),
]

function CupPlaceholder({ idx }: { idx: number }) {
  const svg = CUP_SVGS[idx % 3]
  return (
    <div className="size-20 shrink-0 flex items-center justify-center">
      <div className="size-10 flex items-center justify-center [&>svg]:max-h-full [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:w-auto">
        {svg}
      </div>
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
/* ─────────────────────────────────────────────────────────────
   Stat stickers — hand-placed, die-cut style stats
─────────────────────────────────────────────────────────────── */

function CafesRankedSticker({ value, visible, delay }: { value: string; visible: boolean; delay: number }) {
  return (
    <div
      className="relative min-w-0 flex-1"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "rotate(5deg) translateY(0)" : "rotate(5deg) translateY(8px)",
        transition: `opacity 0.35s ease ${delay}ms, transform 0.35s ease ${delay}ms`,
      }}
    >
      <svg viewBox="0 0 260 130" className="h-auto w-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <path id="cafes-ranked-curve" d="M 20 70 Q 130 30 240 70" fill="none" />
        </defs>
        <text
          fontFamily="var(--font-domine), serif"
          fontWeight={700}
          fontSize="30"
          letterSpacing="-1"
          stroke="#D9D88A"
          fill="#D9D88A"
          strokeWidth="20"
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ paintOrder: "stroke" }}
        >
          <textPath href="#cafes-ranked-curve" startOffset="50%" textAnchor="middle">
            <tspan fontFamily="var(--font-permanent-marker), cursive">{value}</tspan> cafes ranked
          </textPath>
        </text>
        <text
          fontFamily="var(--font-domine), serif"
          fontWeight={700}
          fontSize="30"
          letterSpacing="-1"
          fill="#481D0F"
        >
          <textPath href="#cafes-ranked-curve" startOffset="50%" textAnchor="middle">
            <tspan fontFamily="var(--font-permanent-marker), cursive">{value}</tspan> cafes ranked
          </textPath>
        </text>
      </svg>
    </div>
  )
}

function AvgScoreSticker({ value, visible, delay }: { value: string; visible: boolean; delay: number }) {
  return (
    <div
      className="relative flex min-w-0 flex-1 items-center justify-center"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "rotate(-3deg) translateY(0)" : "rotate(-3deg) translateY(8px)",
        transition: `opacity 0.35s ease ${delay}ms, transform 0.35s ease ${delay}ms`,
      }}
    >
      <svg viewBox="0 0 220 220" className="h-auto w-full max-w-[150px]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <path id="avg-score-top" d="M 28,110 A 82,82 0 0 1 192,110" fill="none" />
          <path id="avg-score-bottom" d="M 192,110 A 82,82 0 0 1 28,110" fill="none" />
        </defs>
        <circle cx="110" cy="110" r="110" fill="#CB446A" />
        <text fontFamily="var(--font-ibm-plex-mono), monospace" fontWeight={500} fontSize="15" fill="#481D0F">
          <textPath href="#avg-score-top" startOffset="0%" textLength="257" lengthAdjust="spacing">avg score &#183; avg score &#183;</textPath>
        </text>
        <text fontFamily="var(--font-ibm-plex-mono), monospace" fontWeight={500} fontSize="15" fill="#481D0F">
          <textPath href="#avg-score-bottom" startOffset="0%" textLength="257" lengthAdjust="spacing">avg score &#183; avg score &#183;</textPath>
        </text>
        <text x="108" y="128" textAnchor="middle" fontFamily="var(--font-permanent-marker), cursive" fontSize="68" fill="#FEFCF4">
          <tspan rotate="-6,3,-4">{value}</tspan>
        </text>
      </svg>
    </div>
  )
}

function CitiesVisitedSticker({ value, visible, delay }: { value: string; visible: boolean; delay: number }) {
  return (
    <div
      className="relative flex min-w-0 flex-1 items-center justify-center"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "rotate(-5deg) translateY(0)" : "rotate(-5deg) translateY(8px)",
        transition: `opacity 0.35s ease ${delay}ms, transform 0.35s ease ${delay}ms`,
      }}
    >
      <svg viewBox="0 0 220 220" className="h-auto w-full max-w-[150px]" xmlns="http://www.w3.org/2000/svg">
        {/* outline pass — dotless "i" swapped for "l" so the halo fuses into one shape with no notch */}
        <text x="110" y="70" textAnchor="middle" fontFamily="var(--font-permanent-marker), cursive" fontSize="56" letterSpacing="-1" stroke="#F5A85C" fill="#F5A85C" strokeWidth="30" strokeLinejoin="round" strokeLinecap="round" style={{ paintOrder: "stroke" }}>{value}</text>
        <text x="110" y="114" textAnchor="middle" fontFamily="var(--font-bree-serif), serif" fontSize="34" letterSpacing="-2" stroke="#F5A85C" fill="#F5A85C" strokeWidth="30" strokeLinejoin="round" strokeLinecap="round" style={{ paintOrder: "stroke" }}>cltles</text>
        <text x="110" y="152" textAnchor="middle" fontFamily="var(--font-bree-serif), serif" fontSize="34" letterSpacing="-2" stroke="#F5A85C" fill="#F5A85C" strokeWidth="30" strokeLinejoin="round" strokeLinecap="round" style={{ paintOrder: "stroke" }}>vlslted</text>
        {/* fill pass — real spelling */}
        <text x="110" y="70" textAnchor="middle" fontFamily="var(--font-permanent-marker), cursive" fontSize="56" letterSpacing="-1" fill="#481D0F">{value}</text>
        <text x="110" y="114" textAnchor="middle" fontFamily="var(--font-bree-serif), serif" fontSize="34" letterSpacing="-2" fill="#481D0F">cities</text>
        <text x="110" y="152" textAnchor="middle" fontFamily="var(--font-bree-serif), serif" fontSize="34" letterSpacing="-2" fill="#481D0F">visited</text>
      </svg>
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
    <div className={`flex items-center gap-3 ${_breeSerif.variable} ${_permanentMarker.variable} ${_domine.variable}`}>
      {/* avg score — circle badge, now leftmost */}
      <AvgScoreSticker
        value={animAvg !== null ? animAvg.toFixed(1) : "—"}
        visible={visible}
        delay={0}
      />
      {/* cafés ranked — curved die-cut, now in the middle */}
      <CafesRankedSticker
        value={animCafes !== null ? String(Math.round(animCafes)) : "0"}
        visible={visible}
        delay={60}
      />
      {/* cities visited — stacked die-cut */}
      <CitiesVisitedSticker
        value={animCities !== null ? String(Math.round(animCities)) : "0"}
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
          "flex shrink-0 items-center gap-1.5 rounded-md border-2 px-4 py-2 font-mono text-xs transition-all hover:scale-[1.02] active:scale-[0.98]",
          active || isOpen
            ? "border-brown bg-brown font-medium text-card"
            : "border-border text-foreground"
        )}
      >
        All
        {activeFilterCount > 0 && (
          <span className="flex size-4 items-center justify-center rounded-full bg-current/15 text-[9px]">
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
                    className="font-sans text-[11px] text-brown underline"
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
                      cafeFilter.has(name) ? "bg-brown/10 text-brown" : "text-foreground hover:bg-brown/10"
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
                    className="font-sans text-[11px] text-brown underline"
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
                      locationFilter.has(name) ? "bg-brown/10 text-brown" : "text-foreground hover:bg-brown/10"
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
            "flex shrink-0 items-center gap-1.5 rounded-md border-2 px-4 py-2 font-mono text-xs transition-all hover:scale-[1.02] active:scale-[0.98]",
            active || isOpen
            ? "border-brown bg-brown font-medium text-card"
            : "border-border text-foreground"
        )}
        >
        {label}
        {count !== undefined && count > 0 && (
          <span className="flex size-4 items-center justify-center rounded-full bg-current/15 text-[9px]">
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
              <button onClick={onSelectAll} className="font-sans text-[11px] text-brown underline">
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
                    ? "bg-brown/10 text-brown"
                    : "text-foreground hover:bg-brown/10"
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={handleBackdropClick}
    >
      <div
        className="flex w-full max-w-[340px] flex-col gap-4 rounded-md p-4 shadow-xl"
        style={{ backgroundColor: "oklch(0.958 0.012 85)" }}
      >
        <div className="flex flex-col gap-1.5">
          <p className="font-sans text-sm font-medium text-foreground">Delete this receipt?</p>
          <p className="font-sans text-sm text-muted-foreground">This can&apos;t be undone.</p>
        </div>
        <div className="flex gap-3">
          <button
            className="flex-1 rounded-full bg-brown py-2.5 font-sans text-sm text-white transition-colors hover:bg-brown/90"
            onClick={onCancel}
          >
            Keep Receipt
          </button>
          <button
            className="flex-1 rounded-full bg-pink-dark py-2.5 font-sans text-sm text-white transition-colors hover:bg-pink-dark/90"
            onClick={onConfirm}
          >
            Delete
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
              <CupPlaceholder idx={idx} />
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
        <button onClick={() => setSortBy("rating")} className={cn("rounded-md px-3 py-1.5 font-mono text-xs transition-colors", sortBy === "rating" ? "bg-brown text-card font-medium" : "text-muted-foreground hover:text-foreground")}>Ranking</button>
        <button onClick={() => setSortBy("latest")} className={cn("rounded-md px-3 py-1.5 font-mono text-xs transition-colors", sortBy === "latest" ? "bg-brown text-card font-medium" : "text-muted-foreground hover:text-foreground")}>Latest</button>
      </div>
      <button onClick={() => setSortDir((d) => d === "desc" ? "asc" : "desc")} className="flex items-center justify-center p-1 text-brown transition-opacity hover:opacity-70" aria-label={sortDir === "desc" ? "Sort ascending" : "Sort descending"}>
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
        <button onClick={() => setSortBy("rating")} className={cn("rounded-md px-3 py-1.5 font-mono text-xs transition-colors", sortBy === "rating" ? "bg-brown text-card font-medium" : "text-muted-foreground hover:text-foreground")}>Ranking</button>
        <button onClick={() => setSortBy("latest")} className={cn("rounded-md px-3 py-1.5 font-mono text-xs transition-colors", sortBy === "latest" ? "bg-brown text-card font-medium" : "text-muted-foreground hover:text-foreground")}>Latest</button>
      </div>
      <button onClick={() => setSortDir((d) => d === "desc" ? "asc" : "desc")} className="flex items-center justify-center p-1 text-brown transition-opacity hover:opacity-70" aria-label={sortDir === "desc" ? "Sort ascending" : "Sort descending"}>
        <ArrowUpDown className="size-5" />
      </button>
    </div>
  </div>

</div>
            {/* Empty state */}
            {filteredReceipts.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                {receipts.length === 0 ? (
                  <div className="size-12 flex items-center justify-center">
                    {CUP_SVGS[0]}
                  </div>
                ) : null}
                <p className="text-sm text-muted-foreground">
                  {receipts.length === 0 ? "no drinks ranked yet" : "no matches"}
                </p>
                {receipts.length === 0 && (
                  <Link
                    href="/"
                    className="rounded-full bg-brown px-5 py-2.5 font-sans text-sm text-white hover:bg-brown/90"
                  >
                    Rank a Drink
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