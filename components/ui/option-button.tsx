"use client"

import { cn } from "@/lib/utils"
import { forwardRef } from "react"

export type OptionColorScheme = "green" | "blue"

interface OptionButtonProps {
  label: string
  selected: boolean
  colorScheme: OptionColorScheme
  onClick: () => void
  className?: string
}

const colorStyles = {
  green: {
    selected: "bg-[#E0DE96] border-[#E0DE96] text-foreground",
    notSelected: "bg-[#E0DE96]/25 border-[#E0DE96] text-[#A7A442]",
  },
  blue: {
    selected: "bg-[#9BCFEC] border-[#9BCFEC] text-foreground",
    notSelected: "bg-[#9BCFEC]/25 border-[#9BCFEC] text-[#57A0CA]",
  },
}

export const OptionButton = forwardRef<HTMLButtonElement, OptionButtonProps>(
  ({ label, selected, colorScheme, onClick, className }, ref) => {
    const styles = colorStyles[colorScheme]

    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        className={cn(
          "rounded-md border-2 px-2 py-3 font-mono text-sm font-medium transition-all text-center",
          "hover:scale-[1.02] active:scale-[0.98]",
          selected ? styles.selected : styles.notSelected,
          className
        )}
        aria-pressed={selected}
      >
        {label}
      </button>
    )
  }
)
OptionButton.displayName = "OptionButton"

/* ============================================
   Option Input - for "Other" field
   ============================================ */

interface OptionInputProps {
  value: string
  onChange: (value: string) => void
  selected: boolean
  colorScheme: OptionColorScheme
  placeholder?: string
  className?: string
  onSelect: () => void    // called when input is clicked/focused to select "other"
  onDeselect: () => void  // called to deselect "other"
}

const inputColorStyles = {
  green: {
    selected: "bg-[#E0DE96] border-[#E0DE96] text-foreground placeholder:text-[#A7A442]/60",
    notSelectedEmpty: "bg-transparent border-[#E0DE96] text-[#A7A442]/25 placeholder:text-[#A7A442]/25",
    notSelectedFilled: "bg-transparent border-[#E0DE96] text-[#A7A442] placeholder:text-[#A7A442]/25",
  },
  blue: {
    selected: "bg-[#9BCFEC] border-[#9BCFEC] text-foreground placeholder:text-[#57A0CA]/60",
    notSelectedEmpty: "bg-transparent border-[#9BCFEC] text-[#57A0CA]/25 placeholder:text-[#57A0CA]/25",
    notSelectedFilled: "bg-transparent border-[#9BCFEC] text-[#57A0CA] placeholder:text-[#57A0CA]/25",
  },
}

export function OptionInput({
  value,
  onChange,
  selected,
  colorScheme,
  placeholder = "Other",
  className,
  onSelect,
  onDeselect,
}: OptionInputProps) {
  const styles = inputColorStyles[colorScheme]

  let stateStyle = styles.notSelectedEmpty
  if (selected) {
    stateStyle = styles.selected
  } else if (value) {
    stateStyle = styles.notSelectedFilled
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => {
        onChange(e.target.value)
        // auto-select "other" as soon as user types something
        if (e.target.value && !selected) {
          onSelect()
        }
      }}
      onFocus={() => {
        // clicking into the input selects it (preserving any existing text)
        onSelect()
      }}
      placeholder={placeholder}
      className={cn(
        "rounded-md border-2 px-6 py-3 font-mono text-sm font-medium transition-all text-center",
        "outline-none focus:ring-2 focus:ring-offset-1",
        colorScheme === "green" ? "focus:ring-[#A7A442]/30" : "focus:ring-[#57A0CA]/30",
        stateStyle,
        className
      )}
      maxLength={30}
    />
  )
}

/* ============================================
   Option Button Group
   ============================================ */

interface OptionGroupProps {
  label: string
  options: string[]
  value: string
  onChange: (value: string) => void
  colorScheme: OptionColorScheme
  withOther?: boolean
  otherValue?: string
  onOtherChange?: (value: string) => void
  columns?: 2 | 3
  className?: string
}

export function OptionGroup({
  label,
  options,
  value,
  onChange,
  colorScheme,
  withOther = false,
  otherValue = "",
  onOtherChange,
  columns = 2,
  className,
}: OptionGroupProps) {
  const isOtherSelected = value === "other"

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <div
        className={cn(
          "grid gap-2",
          columns === 2 ? "grid-cols-2" : "grid-cols-3"
        )}
      >
        {options.map((option) => (
          <OptionButton
            key={option}
            label={option}
            selected={value === option.toLowerCase()}
            colorScheme={colorScheme}
            onClick={() => {
              // deselect if already selected, otherwise select
              if (value === option.toLowerCase()) {
                onChange("")
              } else {
                onChange(option.toLowerCase())
              }
            }}
          />
        ))}
        {withOther && (
          <OptionInput
            value={otherValue || ""}
            onChange={(val) => {
              onOtherChange?.(val)
            }}
            selected={isOtherSelected}
            colorScheme={colorScheme}
            placeholder="Other"
            onSelect={() => onChange("other")}
            onDeselect={() => onChange("")}
          />
        )}
      </div>
    </div>
  )
}