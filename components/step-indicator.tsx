"use client"

import { cn } from "@/lib/utils"

interface StepIndicatorProps {
  currentStep: number
  totalSteps: number
}

const stepColors = {
  1: { bg: "bg-pink", text: "text-foreground" },
  2: { bg: "bg-[#E0DE96]", text: "text-foreground" },
  3: { bg: "bg-[#9BCFEC]", text: "text-foreground" },
}

const stepLabels = ["UPLOAD", "RANK", "CUSTOMIZE"]

export function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-2" role="navigation" aria-label="Progress">
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1
        const isActive = step === currentStep
        const isCompleted = step < currentStep
        const isVisible = isActive || isCompleted
        const colors = stepColors[step as keyof typeof stepColors]

        return (
          <div key={step} className="flex items-center gap-2">
            <div className={cn(
              "flex items-center gap-1.5 transition-opacity duration-300",
              isVisible ? "opacity-100" : "opacity-30"
            )}>
              <div
                className={cn(
                  "flex size-5 items-center justify-center rounded-full font-mono text-[10px] font-bold",
                  colors.bg,
                  colors.text
                )}
                aria-current={isActive ? "step" : undefined}
              >
                {step}
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-foreground">
                {stepLabels[i]}
              </span>
            </div>
            {step < totalSteps && (
              <div className="h-px w-6 bg-foreground/40" />
            )}
          </div>
        )
      })}
    </div>
  )
}
