"use client"

import { useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

/* ─────────────────────────────────────────────────────────────
   Icons
─────────────────────────────────────────────────────────────── */

function RankIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="2"/>
      <text
        x="16" y="16"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="11"
        fontWeight="500"
        fontFamily="'IBM Plex Mono', monospace"
        fill="currentColor"
      >
        10
      </text>
    </svg>
  )
}

function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="2"/>
      <path d="M16 10v6l4 2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

/* ─────────────────────────────────────────────────────────────
   Nav items — profile removed
─────────────────────────────────────────────────────────────── */
const NAV_ITEMS = [
  { label: "rank",    href: "/",        Icon: RankIcon,    disabled: false },
  { label: "history", href: "/history", Icon: HistoryIcon, disabled: false },
] as const

/* ─────────────────────────────────────────────────────────────
   Props
─────────────────────────────────────────────────────────────── */
interface NavDrawerProps {
  open: boolean
  onClose: () => void
  onNavigate?: (href: string) => boolean
}

/* ─────────────────────────────────────────────────────────────
   NavDrawer — mobile slide-in only
─────────────────────────────────────────────────────────────── */
export function NavDrawer({ open, onClose, onNavigate }: NavDrawerProps) {
  const pathname = usePathname()

  useEffect(() => {
    if (!open) return
    const handle = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handle)
    return () => document.removeEventListener("keydown", handle)
  }, [open, onClose])

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  const handleLink = (e: React.MouseEvent, href: string, disabled: boolean) => {
    if (disabled) { e.preventDefault(); return }
    if (onNavigate) {
      const ok = onNavigate(href)
      if (!ok) { e.preventDefault(); return }
    }
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 md:hidden",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer panel */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 px-4 py-5 shadow-xl transition-transform duration-200 ease-in-out md:hidden",
          "bg-[oklch(0.935_0.012_85)]",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <span className="font-sans text-xs uppercase tracking-widest text-muted-foreground">
            menu
          </span>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-border/60 hover:text-foreground"
            aria-label="Close menu"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex flex-col gap-2">
          {NAV_ITEMS.map(({ label, href, Icon, disabled }) => {
            const isActive = pathname === href
            return (
              <Link
                key={href}
                href={disabled ? "#" : href}
                onClick={(e) => handleLink(e, href, disabled)}
                aria-disabled={disabled}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-3 transition-colors",
                  isActive
                    ? "bg-[#E0DE96] text-foreground"
                    : disabled
                      ? "cursor-not-allowed text-muted-foreground/40"
                      : "text-foreground hover:bg-border/60"
                )}
              >
                <Icon className="size-7 shrink-0" />
                {/* Changed from font-mono to font-sans */}
                <span className="flex flex-1 items-center font-sans text-sm tracking-wide">
                  {label}
                </span>
              </Link>
            )
          })}
        </nav>
      </div>
    </>
  )
}

/* ─────────────────────────────────────────────────────────────
   DesktopNav — horizontal inline links for page headers
─────────────────────────────────────────────────────────────── */
export function DesktopNav({ onNavigate }: { onNavigate?: (href: string) => boolean }) {
  const pathname = usePathname()

  const handleClick = (e: React.MouseEvent, href: string) => {
    if (!onNavigate) return
    const ok = onNavigate(href)
    if (!ok) e.preventDefault()
  }

  return (
    <nav className="hidden items-center gap-4 md:flex">
      <Link
        href="/"
        onClick={(e) => handleClick(e, "/")}
        className="font-sans text-sm text-green-dark transition-colors hover:opacity-70"
      >
        Rank
      </Link>
      <Link
        href="/history"
        onClick={(e) => handleClick(e, "/history")}
        className="font-sans text-sm text-green-dark transition-colors hover:opacity-70"
      >
        History
      </Link>
    </nav>
  )
}

/* ─────────────────────────────────────────────────────────────
   HamburgerButton — placed in the header by page.tsx (mobile only)
─────────────────────────────────────────────────────────────── */
interface HamburgerProps {
  onClick: () => void
  className?: string
}

export function HamburgerButton({ onClick, className }: HamburgerProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-border/60",
        className
      )}
      aria-label="Open menu"
    >
      <svg width="16" height="12" viewBox="0 0 16 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 1h14M1 6h14M1 11h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    </button>
  )
}