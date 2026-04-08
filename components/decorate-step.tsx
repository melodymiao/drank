"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { TextInput } from "@/components/ui/text-input"
import { OptionGroup } from "@/components/ui/option-button"
import { ToppingTags } from "@/components/ui/topping-tags"
import { ArrowLeft, ChevronUp, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { ERRORS, pickError } from "@/lib/errors"

export interface ReceiptData {
  cafeName: string
  drinkName: string
  rating: string
  comments: string
  location: string
  date: string
  time: string
  iceTemp: string
  iceLevel: string
  sugarLevel: string
  milk: string
  otherMilk: string
  toppings: string[]
  otherCustomizations: string
}

export interface StickerItem {
  id: string
  text: string
  color: string
  x: number
  y: number
  rotation: number
}

interface DecorateStepProps {
  data: ReceiptData
  image: string | null
  stickers: StickerItem[]
  onStickersChange: (stickers: StickerItem[]) => void
  onUpdate: (data: Partial<ReceiptData>) => void
  onNext: () => void
  onBack: () => void
}

type FormErrors = Partial<Record<keyof ReceiptData, string>>

export function DecorateStep({
  data,
  onUpdate,
  onNext,
  onBack,
}: DecorateStepProps) {
  // Desktop: only one section open at a time (accordion). Mobile: both start open, each toggles independently.
  const [openSection, setOpenSection] = useState<"basics" | "customizations" | null>("basics")
  const [mobileOpenSections, setMobileOpenSections] = useState<Set<"basics" | "customizations">>(
    new Set(["basics", "customizations"])
  )
  const [errors, setErrors] = useState<FormErrors>({})

  const toggleSection = (section: "basics" | "customizations") => {
    setOpenSection(openSection === section ? null : section)
  }

  const toggleMobileSection = (section: "basics" | "customizations") => {
    setMobileOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }

  const formatRating = (val: string) => {
    const num = parseFloat(val)
    if (isNaN(num)) return ""
    const clamped = Math.min(10, Math.max(0, num))
    return clamped.toFixed(1)
  }

  const handleRatingBlur = () => {
    if (data.rating) {
      const formatted = formatRating(data.rating)
      onUpdate({ rating: formatted })
      // Clear range error if it's now valid
      if (formatted) setErrors((prev) => ({ ...prev, rating: undefined }))
    }
  }

  const validate = (): boolean => {
    const next: FormErrors = {}

    if (!data.rating) {
      next.rating = pickError(ERRORS.rating)
    } else {
      const num = parseFloat(data.rating)
      if (isNaN(num) || num < 0 || num > 10) {
        next.rating = pickError(ERRORS.ratingRange)
      }
    }

    if (!data.cafeName.trim()) next.cafeName = pickError(ERRORS.cafeName)
    if (!data.drinkName.trim()) next.drinkName = pickError(ERRORS.drinkName)

    if (!data.date) {
      next.date = pickError(ERRORS.date)
    } else {
      const selected = new Date(data.date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (selected > today) next.date = pickError(ERRORS.dateFuture)
    }

    if (!data.time) next.time = pickError(ERRORS.time)

    setErrors(next)

    if (Object.keys(next).length > 0) {
      // Open BASICS accordion so the user can see the errors
      setOpenSection("basics")
      setMobileOpenSections((prev) => new Set([...prev, "basics"]))
      return false
    }
    return true
  }

  const handleNext = () => {
    if (validate()) onNext()
  }

  // Clear a field's error as soon as the user starts typing
  const clearError = (field: keyof ReceiptData) => {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto md:overflow-hidden">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col px-4 pt-3 md:h-full md:overflow-hidden md:px-6">
        {/* Mobile: natural page scroll. Desktop: fully fixed, no page scroll */}
        <div className="flex flex-col md:h-full md:flex-row md:gap-8 md:overflow-hidden">

          {/* Left column — desktop only (receipt preview + finish button) */}
          <div className="hidden md:flex md:h-full md:w-[400px] md:min-h-0 md:flex-col">

            {/* Row 1: Back button — h-[40px] matches share-step back button row */}
            <div className="h-[40px] shrink-0 items-center flex">
              <button
                onClick={onBack}
                className="flex items-center gap-1.5 font-sans text-sm text-green-dark transition-colors hover:opacity-70"
              >
                <ArrowLeft className="size-4" />
                Back
              </button>
            </div>

            {/* Row 2: Canvas — flex-1, receipt centered */}
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
              <ReceiptPreview data={data} />
            </div>

            {/* Row 3: Bottom section — fixed h-[120px], same as share-step. */}
            <div className="h-[120px] shrink-0 flex flex-col items-center justify-end pb-16">
              <Button
                size="lg"
                className="w-full max-w-[200px] bg-brown px-8 font-sans text-sm text-white hover:bg-brown/90"
                style={{ paddingTop: 24, paddingBottom: 24 }}
                onClick={handleNext}
              >
                Finish Ranking
              </Button>
            </div>
          </div>

          {/* Right column - Accordion sections (full width on mobile, flex-1 on desktop) */}
          <div className="flex flex-col gap-3 pb-28 pt-0 md:min-h-0 md:flex-1 md:overflow-hidden md:pb-6">

            {/* Mobile back button — top of form, only on mobile */}
            <button
              onClick={onBack}
              className="mb-1 flex shrink-0 items-center gap-1.5 self-start py-2 font-sans text-sm text-green-dark transition-colors hover:opacity-70 md:hidden"
            >
              <ArrowLeft className="size-4" />
              Back
            </button>

            {/* BASICS — desktop: single accordion. Mobile: independently toggleable, starts open */}
            <AccordionSection
              title="BASICS"
              isOpen={openSection === "basics"}
              mobileIsOpen={mobileOpenSections.has("basics")}
              onToggle={() => toggleSection("basics")}
              onMobileToggle={() => toggleMobileSection("basics")}
            >
              <div className="flex flex-col gap-4">
                <TextInput
                  label="Rank"
                  placeholder="10.0"
                  value={data.rating}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.]/g, "")
                    const parts = val.split(".")
                    const sanitized = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : val
                    onUpdate({ rating: sanitized })
                    clearError("rating")
                  }}
                  onBlur={handleRatingBlur}
                  error={errors.rating}
                  required
                />

                <TextInput
                  label="Cafe / Spot"
                  placeholder="HeyTea"
                  value={data.cafeName}
                  onChange={(e) => { onUpdate({ cafeName: e.target.value }); clearError("cafeName") }}
                  maxLength={30}
                  error={errors.cafeName}
                  required
                />

                <TextInput
                  label="Beverage"
                  placeholder="Coconut Mango Boom"
                  value={data.drinkName}
                  onChange={(e) => { onUpdate({ drinkName: e.target.value }); clearError("drinkName") }}
                  maxLength={40}
                  error={errors.drinkName}
                  required
                />

                <TextInput
                  label="Location / City"
                  placeholder="Del Mar"
                  value={data.location}
                  onChange={(e) => onUpdate({ location: e.target.value })}
                  maxLength={30}
                />

                <div className="grid grid-cols-2 gap-3">
                  <TextInput
                    label="Date"
                    type="date"
                    placeholder="YYYY / MM / DD"
                    value={data.date}
                    onChange={(e) => { onUpdate({ date: e.target.value }); clearError("date") }}
                    error={errors.date}
                    required
                  />
                  <TextInput
                    label="Time"
                    type="time"
                    placeholder="12:01 PM"
                    value={data.time}
                    onChange={(e) => { onUpdate({ time: e.target.value }); clearError("time") }}
                    error={errors.time}
                    required
                  />
                </div>

                <div>
                  <TextInput
                    label="Notes"
                    placeholder="the tastiest drink ever. everyone needs to try at least once."
                    value={data.comments}
                    onChange={(e) => onUpdate({ comments: e.target.value })}
                    variant="long"
                    maxLength={150}
                  />
                  <span className="-mt-1 block text-right font-mono text-[10px] text-muted-foreground">
                    {data.comments.length}/150
                  </span>
                </div>
              </div>
            </AccordionSection>

            <AccordionSection
              title="CUSTOMIZATIONS"
              isOpen={openSection === "customizations"}
              mobileIsOpen={mobileOpenSections.has("customizations")}
              onToggle={() => toggleSection("customizations")}
              onMobileToggle={() => toggleMobileSection("customizations")}
            >
              <div className="flex flex-col gap-4">
                <OptionGroup
                  label=""
                  options={["Iced", "Hot"]}
                  value={data.iceTemp}
                  onChange={(val) => {
                    onUpdate({ iceTemp: val })
                    if (val === "hot") {
                      onUpdate({ iceLevel: "" })
                    }
                  }}
                  colorScheme="green"
                  columns={2}
                />

                <TextInput
                  label="Ice Level"
                  placeholder="Light, 25%, Regular"
                  value={data.iceLevel}
                  onChange={(e) => onUpdate({ iceLevel: e.target.value })}
                  maxLength={30}
                  disabled={data.iceTemp === "hot"}
                  innerLabel="Ice"
                />

                <TextInput
                  label="Sugar Level"
                  placeholder="Half, 50%, Extra"
                  value={data.sugarLevel}
                  onChange={(e) => onUpdate({ sugarLevel: e.target.value })}
                  maxLength={30}
                  innerLabel="Sugar"
                />

                <OptionGroup
                  label="Milk Base"
                  options={["Whole", "Oat", "Soy", "Almond"]}
                  value={data.milk}
                  onChange={(val) => {
                    onUpdate({ milk: val })
                    if (val !== "other") {
                      onUpdate({ otherMilk: "" })
                    }
                  }}
                  colorScheme="blue"
                  columns={3}
                  withOther
                  otherValue={data.otherMilk}
                  onOtherChange={(val) => onUpdate({ otherMilk: val })}
                />

                <ToppingTags
                  label="TOPPINGS"
                  value={data.toppings}
                  onChange={(val) => onUpdate({ toppings: val })}
                />

                <TextInput
                  label="Other Customizations"
                  placeholder="Shaken, Decaf, On the rocks, Half pour"
                  value={data.otherCustomizations}
                  onChange={(e) => onUpdate({ otherCustomizations: e.target.value })}
                  variant="long"
                  maxLength={100}
                />
              </div>
            </AccordionSection>
          </div>
        </div>
      </div>

      {/* Mobile fixed bottom button */}
      {/* Mobile fixed bottom button — full width, no background */}
      <div className="fixed inset-x-0 bottom-0 z-20 p-4 md:hidden">
      <Button
  size="lg"
  className="w-full bg-brown px-8 font-sans text-sm text-white hover:bg-brown/90"
  style={{ paddingTop: 24, paddingBottom: 24 }}
  onClick={handleNext}
>
  Finish Ranking
</Button>
      </div>
    </div>
  )
}

/* ================= Accordion Section ================= */

function AccordionSection({
  title,
  isOpen,
  mobileIsOpen,
  onToggle,
  onMobileToggle,
  children,
}: {
  title: string
  isOpen: boolean
  mobileIsOpen?: boolean
  onToggle: () => void
  onMobileToggle?: () => void
  children: React.ReactNode
}) {
  const mobileOpen = mobileIsOpen ?? isOpen
  return (
    <div className={cn(
      "flex flex-col rounded-xl border border-border bg-card overflow-hidden",
      isOpen && "md:min-h-0 md:flex-1"
    )}>
      {/* Mobile header — independently toggleable, no sticky */}
      <div className="block md:hidden">
        <button
          onClick={onMobileToggle ?? onToggle}
          className="flex w-full items-center justify-between px-4 py-3"
        >
          <div className="flex flex-col items-start">
            <span className={cn(
              "font-mono text-xs font-semibold uppercase tracking-widest text-green-dark transition-opacity",
              !mobileOpen && "opacity-50"
            )}>
              {title}
            </span>
            {mobileOpen && <SquigglyUnderline title={title} />}
          </div>
          {mobileOpen
            ? <ChevronUp className="size-5 text-muted-foreground" />
            : <ChevronDown className="size-5 text-muted-foreground" />}
        </button>
        {mobileOpen && <div className="mx-4 border-t border-dashed border-border" />}
      </div>

      {/* Desktop header — single-accordion behavior */}
      <div className="hidden md:block">
        <button
          onClick={onToggle}
          className="flex w-full items-center justify-between px-4 py-3"
        >
          <div className="flex flex-col items-start">
            <span className={cn(
              "font-mono text-xs font-semibold uppercase tracking-widest text-green-dark transition-opacity",
              !isOpen && "opacity-50"
            )}>
              {title}
            </span>
            {isOpen && <SquigglyUnderline title={title} />}
          </div>
          {isOpen
            ? <ChevronUp className="size-5 text-muted-foreground" />
            : <ChevronDown className="size-5 text-muted-foreground" />}
        </button>
        {isOpen && <div className="mx-4 border-t border-dashed border-border" />}
      </div>

      {/* Mobile content — shows when mobileOpen */}
      <div className={cn("p-4 pb-6 md:hidden", !mobileOpen && "hidden")}>
        {children}
      </div>
      {/* Desktop content — shows when isOpen */}
      <div className={cn("hidden p-4 pb-6 md:min-h-0 md:flex-1 md:overflow-y-auto", isOpen ? "md:block" : "md:hidden")}>
        {children}
      </div>
    </div>
  )
}

/* ================= Squiggly Underlines (Figma originals) ================= */

function SquigglyUnderline({ title }: { title: string }) {
  if (title === "BASICS") {
    return (
      <svg
        width="52"
        height="6"
        viewBox="0 0 59 6"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="mt-0.5"
      >
        <path d="M2 3.12035C2.9083 3.12035 5.51113 2.92571 6.72976 2.76524C7.94068 2.60579 9.62688 2.19481 11.6288 2.09692C13.5315 2.00389 15.0134 3.35705 16.9429 3.43872C21.5093 3.632 22.998 2.88817 24.9845 2.20944C27.7966 1.24861 30.2635 3.85937 36.6086 3.99465C39.7889 4.06245 41.5805 2.92727 43.9687 2.52163C46.9193 2.0205 49.5848 2.86002 52.5641 2.97897C53.076 2.99941 53.2216 3.61458 53.4552 3.78732C53.9912 3.85492 54.8864 3.40177 55.9241 2.85405C56.378 2.65117 56.6844 2.60071 57 2.54872" stroke="#727025" strokeWidth="4" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg
      width="119"
      height="8"
      viewBox="0 0 119 8"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="mt-0.5"
    >
      <path
        d="M2 4.37499C3.58288 4.37499 9.54441 4.00256 13.63 4.02149C16.2957 4.03384 22.5385 6.17422 27.6165 5.6839C30.3741 5.41764 36.3277 4.59354 41.3096 4.25254C47.8651 3.80383 57.7928 4.36433 61.2589 4.74062C63.9328 5.03091 66.6083 4.13125 72.381 2.97056C86.9072 0.0498772 89.4917 4.55415 91.5886 5.58457C94.5049 7.0177 99.3412 4.32932 103.315 3.74911C106.37 3.20086 108.785 2.82666 111.877 2.66632C112.942 2.63744 114.357 2.57968 117 3.67747"
        stroke="#727025"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  )
}

/* ================= Receipt Preview ================= */

const TEXT_COLOR = "#473C23"

// Capitalizes the first letter, lowercases the rest
function toTitleCase(str: string): string {
  if (!str) return ""
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

function ReceiptPreview({ data }: { data: ReceiptData }) {
  // Build customizations — iceTemp first, then the rest
  const customizations: string[] = []

  if (data.iceTemp) {
    customizations.push(toTitleCase(data.iceTemp))
  }

  if (data.iceLevel) {
    customizations.push(`${toTitleCase(data.iceLevel)} Ice`)
  }

  if (data.sugarLevel) {
    customizations.push(`${toTitleCase(data.sugarLevel)} Sugar`)
  }

  const milkDisplay = data.milk === "other" && data.otherMilk
    ? data.otherMilk
    : data.milk
  if (milkDisplay) {
    customizations.push(`${toTitleCase(milkDisplay)} Milk`)
  }

  if (data.toppings.length > 0) {
    customizations.push(...data.toppings.map(toTitleCase))
  }

  if (data.otherCustomizations) {
    customizations.push(toTitleCase(data.otherCustomizations))
  }

  // Format date as YYYYMMDD
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "YYYYMMDD"
    return dateStr.replace(/-/g, "")
  }

  // Format time as 12:00 AM
  const formatTime = (timeStr: string) => {
    if (!timeStr) return "12:00 AM"
    const [hours, minutes] = timeStr.split(":")
    const h = parseInt(hours, 10)
    const ampm = h >= 12 ? "PM" : "AM"
    const h12 = h % 12 || 12
    return `${h12}:${minutes} ${ampm}`
  }

  return (
    // Mobile: scale down to fit screen width. Desktop: fixed at 359×522.
    <div
      className="relative mx-auto flex items-center justify-center"
      style={{ width: "min(359px, 100%)", aspectRatio: "359 / 522" }}
    >
      {/* Squiggly border — scales with wrapper on mobile */}
      <div className="absolute inset-0 pointer-events-none">
        <svg
          viewBox="0 0 359 522"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="pointer-events-none h-full w-full"
        >
          <path
            d="M5.96748 32.9781C5.95608 42.1204 5.73755 70.7878 5.7661 101.173C5.77559 111.275 3.69791 131.095 5.54229 152.072C6.46891 162.61 9.12923 168.948 9.13488 199.274C9.13788 215.346 7.34902 233.861 8.49242 249.847C9.21612 259.965 8.76806 270.007 8.06387 280.923C7.18042 294.618 9.05917 310.492 11.0821 326.559C15.2014 359.275 10.7358 369.518 9.64203 376.352C8.49639 383.51 8.77003 400.764 9.15834 412.022C9.37227 418.224 11.7736 424.181 14.6133 433.019C16.9656 440.339 16.7185 449.266 17.4192 501.866C17.5514 511.789 18.4694 510.552 19.5636 509.915C25.2935 506.577 33.6387 510.437 40.9995 512.637C51.4711 515.767 63.6581 515.569 75.0355 515.995C82.3874 516.27 89.4128 519.687 94.4326 519.988C99.4488 520.288 103.762 515.048 109.025 513.338C114.074 511.697 119.562 508.594 127.347 510.145C133.64 511.399 139.727 511.456 145.424 512.662C154.827 514.653 168.315 514.095 177.375 513.518C184.76 513.048 191.902 509.906 213.679 508.79C228.501 508.03 237.648 509.08 241.874 512.811C248.081 518.291 255.789 512.616 261.908 511.526C269.243 510.218 279.181 510.994 294.438 511.273C302.089 511.413 307.582 511.77 312.854 512.413C324.464 513.829 341.654 512.703 344.183 511.178C345.426 510.428 346.574 509.699 346.739 508.028C347.165 503.715 344.644 497.568 344.176 491.601C343.628 484.61 350.519 478.37 353.387 465.279C359.02 439.567 356.36 423.159 356.452 403.102C356.498 393.158 352.523 373.768 350.528 361.389C349.273 353.6 349.342 340.553 349.985 326.875C351.463 295.434 351.946 287.699 351.501 268.772C351.29 259.752 351.277 252.944 351.951 245.574C353.162 232.312 348.627 226.265 347.34 212.039C343.83 173.266 346.012 167.201 347.619 161.254C349.349 154.855 346.977 149.117 345.858 143.343C344.647 137.09 344.331 130.28 343.336 124.113C342.093 116.399 344.265 110.018 345.254 104.031C346.612 95.8097 345.254 83.9833 344.786 76.5974C344.195 67.255 343.762 56.6641 342.484 50.14C341.203 43.5967 340.718 33.619 340.041 24.2919C339.521 17.1379 339.43 11.3536 338.102 9.11157C335.311 4.39764 317.196 6.89516 304.559 8.7068C287.644 11.1319 281.368 8.40142 275.595 7.15735C269.789 5.90601 265.13 3.18534 254.357 2.56724C220.376 0.617687 214.273 4.27899 208.268 4.77712C202.943 5.21878 196.708 6.88322 189.381 7.61991C185.418 8.01845 181.982 8.1129 179.303 8.3679C176.627 8.62267 153.642 8.76012 119.861 8.8068C93.5059 8.84321 70.6441 9.79826 64.4299 10.5245C54.3227 11.7056 42.7259 11.583 35.0346 12.3277C21.9552 12.6858 16.1885 13.7051 7.56054 14.7525C5.79666 15.3788 4.95975 16.5638 2.00049 18.137"
            stroke="#9BCFEC"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div
        className="shake-on-hover relative rounded-sm px-5 py-6 shadow-md md:w-[280px]"
        style={{
          width: "78%", // ~280/359 — matches the desktop proportion at any scale
          transform: "rotate(1deg)",
          backgroundColor: "#FEFCF4",
        }}
      >
        {/* Rating circle */}
        <div className="mb-3 flex justify-center">
          <div
            className="flex size-14 items-center justify-center rounded-full border-2"
            style={{ borderColor: TEXT_COLOR }}
          >
            <span
              className="font-mono text-lg font-normal"
              style={{ color: TEXT_COLOR }}
            >
              {data.rating || "10.0"}
            </span>
          </div>
        </div>

        {/* Cafe name */}
        <p
          className="mb-3 break-words text-center font-mono text-xs font-medium"
          style={{ color: TEXT_COLOR }}
        >
          {data.cafeName || "Cafe"}
        </p>

        {/* Drink name */}
        <h3
          className="mb-3 break-words text-center font-mono text-lg font-medium leading-tight"
          style={{ color: TEXT_COLOR }}
        >
          {data.drinkName || "Beverage"}
        </h3>

        {/* Customizations - centered, one line, comma separated */}
        {customizations.length > 0 && (
          <p
            className="mb-3 break-words text-center font-mono text-xs font-medium"
            style={{ color: TEXT_COLOR }}
          >
            {customizations.join(", ")}
          </p>
        )}

        {/* Notes */}
        {data.comments && (
          <p
            className="mb-3 break-words font-mono text-xs font-light"
            style={{ color: TEXT_COLOR }}
          >
            Notes: {data.comments}
          </p>
        )}

        {/* Location */}
        {data.location && (
          <p
            className="break-words font-mono text-xs font-light"
            style={{ color: TEXT_COLOR }}
          >
            {data.location}
          </p>
        )}

        {/* Date/Time */}
        <p
          className="mb-3 font-mono text-xs font-light"
          style={{ color: TEXT_COLOR }}
        >
          {formatDate(data.date)} {formatTime(data.time)}
        </p>

        {/* Divider */}
        <div
          className="mb-3 border-t"
          style={{ borderColor: TEXT_COLOR, opacity: 0.2 }}
        />

        {/* Footer */}
        <p
          className="text-center font-mono text-xs font-normal"
          style={{ color: TEXT_COLOR }}
        >
          Ranked with <span className="font-medium">drank</span>
        </p>
      </div>
    </div>
  )
}