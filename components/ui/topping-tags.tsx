"use client"

import { useCallback, useRef, useState, useEffect } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface ToppingTagsProps {
  label?: string
  value: string[]
  onChange: (toppings: string[]) => void
  className?: string
}

export function ToppingTags({ label, value, onChange, className }: ToppingTagsProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState("")

  const handleAddClick = useCallback(() => {
    const newIndex = value.length
    onChange([...value, ""])
    setEditingIndex(newIndex)
    setEditValue("")
  }, [value, onChange])

  const handleConfirmEdit = useCallback(
    (index: number) => {
      const trimmed = editValue.trim()
      if (trimmed) {
        const updated = [...value]
        updated[index] = trimmed
        onChange(updated)
      } else {
        const updated = value.filter((_, i) => i !== index)
        onChange(updated)
      }
      setEditingIndex(null)
      setEditValue("")
    },
    [editValue, value, onChange]
  )

  const handleRemove = useCallback(
    (index: number) => {
      onChange(value.filter((_, i) => i !== index))
    },
    [value, onChange]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      if (e.key === "Enter") {
        e.preventDefault()
        handleConfirmEdit(index)
      } else if (e.key === "Escape") {
        const updated = value.filter((_, i) => i !== index)
        onChange(updated)
        setEditingIndex(null)
        setEditValue("")
      }
    },
    [handleConfirmEdit, value, onChange]
  )

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <span className="text-sm font-semibold text-foreground">{label}</span>
      )}
      <div className="flex flex-wrap gap-2">
        {value.map((tag, index) =>
          editingIndex === index ? (
            <EditingTag
              key={index}
              value={editValue}
              onChange={setEditValue}
              onBlur={() => handleConfirmEdit(index)}
              onKeyDown={(e) => handleKeyDown(e, index)}
            />
          ) : (
            <ConfirmedTag
              key={index}
              label={tag}
              onRemove={() => handleRemove(index)}
            />
          )
        )}
        <AddButton onClick={handleAddClick} />
      </div>
    </div>
  )
}

/* ================= Confirmed Tag ================= */

function ConfirmedTag({
  label,
  onRemove,
}: {
  label: string
  onRemove: () => void
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E0DE96] px-3 py-1 text-xs font-mono text-foreground">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="flex items-center justify-center hover:opacity-70 transition-opacity"
        aria-label={`Remove ${label}`}
      >
        <X className="size-3.5" />
      </button>
    </span>
  )
}

/* ================= Add Button ================= */

function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full border-2 border-solid border-[#E0DE96] px-3 py-1 text-xs font-mono text-[#A7A442] hover:bg-[#E0DE96]/20 transition-colors"
    >
      + Add
    </button>
  )
}

/* ================= Editing Tag ================= */

function EditingTag({
  value,
  onChange,
  onBlur,
  onKeyDown,
}: {
  value: string
  onChange: (val: string) => void
  onBlur: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const mirrorRef = useRef<HTMLSpanElement>(null)
  const [inputWidth, setInputWidth] = useState(60)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (mirrorRef.current) {
      const width = mirrorRef.current.offsetWidth
      setInputWidth(Math.max(60, width + 4))
    }
  }, [value])

  const hasText = value.length > 0

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-solid border-[#E0DE96] bg-[#E0DE96] px-3 py-1">
      {/* Hidden mirror for measuring text width */}
      <span
        ref={mirrorRef}
        className="absolute invisible whitespace-pre text-xs font-mono"
        aria-hidden="true"
      >
        {value || "Topping"}
      </span>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 50))}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        placeholder="Topping"
        className={cn(
          "bg-transparent text-xs font-mono outline-none",
          hasText ? "text-foreground" : "text-[#A7A442] placeholder:text-[#A7A442]/60"
        )}
        style={{ width: inputWidth }}
        maxLength={50}
      />
      <X className="size-3.5 text-foreground/50" />
    </span>
  )
}