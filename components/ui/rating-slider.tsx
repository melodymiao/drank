"use client"

import { useState } from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { cn } from "@/lib/utils"

interface RatingSliderProps {
  value: string
  onChange: (val: string) => void
  error?: string
}

export function RatingSlider({ value, onChange, error }: RatingSliderProps) {
  const numVal = value === "" ? 5.0 : parseFloat(value)
  const safeVal = isNaN(numVal) ? 5.0 : Math.min(10, Math.max(0, numVal))
  const [pressing, setPressing] = useState(false)

  const handleSlider = (vals: number[]) => {
    onChange(vals[0].toFixed(1))
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, "")
    const parts = raw.split(".")
    const sanitized = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : raw
    onChange(sanitized)
  }

  const handleTextBlur = () => {
    if (value === "") return
    const num = parseFloat(value)
    if (!isNaN(num)) {
      onChange(Math.min(10, Math.max(0, num)).toFixed(1))
    }
  }

  const pct = (safeVal / 10) * 100

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-foreground">
        Rank
        <span className="ml-1 text-pink-dark">*</span>
      </label>

      <div className="flex items-center gap-3">
        {/* Radix slider */}
        <SliderPrimitive.Root
          min={0}
          max={10}
          step={0.1}
          value={[safeVal]}
          onValueChange={handleSlider}
          className="relative flex flex-1 touch-none select-none items-center"
        >
          <SliderPrimitive.Track className="relative h-[6px] w-full grow overflow-hidden rounded-full bg-border">
            <SliderPrimitive.Range
              className="absolute h-full rounded-full"
              style={{ backgroundColor: "#E0DE96" }}
            />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb
            onPointerDown={() => setPressing(true)}
            onPointerUp={() => setPressing(false)}
            onPointerLeave={() => setPressing(false)}
            className="block size-[22px] rounded-full border-2 border-white shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E0DE96]/50"
            style={{
              backgroundColor: "#E0DE96",
              transition: "transform 0.1s ease",
              transform: pressing ? "scaleX(1.35) scaleY(0.75)" : "scale(1)",
            }}
          />
        </SliderPrimitive.Root>

        {/* Numeric text input */}
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={handleTextChange}
          onBlur={handleTextBlur}
          placeholder="5.0"
          className={cn(
            "w-16 shrink-0 rounded-lg border-2 border-border bg-secondary px-2 py-3",
            "text-center font-mono text-sm text-foreground placeholder:text-muted-foreground",
            "outline-none transition-all duration-200",
            "focus:border-foreground/50 focus:ring-2 focus:ring-foreground/5",
            error && "border-destructive"
          )}
        />
      </div>

      {error && (
        <p className="font-sans text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}