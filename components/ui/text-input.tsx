import * as React from "react"
import { cn } from "@/lib/utils"

export interface TextInputProps {
  label?: string
  placeholder?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  onBlur?: () => void
  variant?: "short" | "long"
  error?: string
  maxLength?: number
  className?: string
  disabled?: boolean
  type?: string
  id?: string
  required?: boolean
  innerLabel?: string
}

function TextInput({
  label,
  placeholder,
  value,
  onChange,
  onBlur,
  variant = "short",
  error,
  maxLength,
  className,
  disabled,
  type = "text",
  id,
  required = false,
  innerLabel,
}: TextInputProps) {
  const inputId = id || React.useId()

  const baseFieldStyles = cn(
    // Layout
    "w-full px-4 py-3",
    // Typography
    "font-mono text-sm placeholder:text-muted-foreground",
    // Colors & background
    "bg-secondary text-foreground",
    // Border
    "border-2 border-border rounded-lg",
    // Focus state
    "outline-none transition-all duration-200",
    "focus:border-foreground/50 focus:ring-2 focus:ring-foreground/5",
    // Disabled state
    "disabled:cursor-not-allowed disabled:opacity-30",
    // Error state
    error && "border-destructive focus:border-destructive focus:ring-destructive/20"
  )

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label
          htmlFor={inputId}
          className={cn("text-sm font-semibold text-foreground", disabled && "opacity-30")}
        >
          {label}
          {required && (
            <span className="ml-1 text-destructive">*</span>
          )}
        </label>
      )}

      {variant === "short" ? (
        <div className="relative">
          <input
            id={inputId}
            type={type}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            maxLength={maxLength}
            disabled={disabled}
            className={cn(baseFieldStyles, innerLabel && "pr-14")}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : undefined}
            required={required}
          />
          {innerLabel && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono text-sm font-medium text-foreground pointer-events-none">
              {innerLabel}
            </span>
          )}
        </div>
      ) : (
        <textarea
          id={inputId}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          maxLength={maxLength}
          disabled={disabled}
          className={cn(baseFieldStyles, "min-h-[80px] max-h-[120px] resize-none overflow-y-auto")}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          required={required}
        />
      )}

      {error && (
        <p id={`${inputId}-error`} className="text-xs text-destructive font-sans">
          {error}
        </p>
      )}
    </div>
  )
}

export { TextInput }