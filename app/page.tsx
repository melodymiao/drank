"use client"

import { useState, useCallback } from "react"
import Image from "next/image"
import { StepIndicator } from "@/components/step-indicator"
import { UploadStep } from "@/components/upload-step"
import { DecorateStep, type ReceiptData, type StickerItem } from "@/components/decorate-step"
import { ShareStep } from "@/components/share-step"

const defaultReceiptData: ReceiptData = {
  cafeName: "",
  drinkName: "",
  rating: "",
  comments: "",
  location: "",
  date: "",
  time: "",
  iceTemp: "",
  iceLevel: "",
  sugarLevel: "",
  milk: "",
  otherMilk: "",
  toppings: [],
  otherCustomizations: "",
}

export default function DrankApp() {
  const [step, setStep] = useState(1)
  const [image, setImage] = useState<string | null>(null)
  const [receiptData, setReceiptData] = useState<ReceiptData>(defaultReceiptData)
  const [stickers, setStickers] = useState<StickerItem[]>([])

  const handleImageUpload = useCallback((img: string, exifDate?: string, exifLocation?: string) => {
    setImage(img || null)
    const updates: Partial<ReceiptData> = {}
    if (exifDate) {
      const [datePart, timePart] = exifDate.split("T")
      updates.date = datePart || ""
      updates.time = timePart || ""
    }
    if (exifLocation) {
      updates.location = exifLocation
    }
    if (Object.keys(updates).length > 0) {
      setReceiptData((prev) => ({ ...prev, ...updates }))
    }
  }, [])

  const handleReceiptUpdate = useCallback((updates: Partial<ReceiptData>) => {
    setReceiptData((prev) => ({ ...prev, ...updates }))
  }, [])

  const handleReset = useCallback(() => {
    setStep(1)
    setImage(null)
    setReceiptData(defaultReceiptData)
    setStickers([])
  }, [])

  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-background">
      {/* Header - compact */}
      <header className="flex shrink-0 flex-col items-center gap-2 px-4 pb-2 pt-4">
        <Image
          src="/logo.png"
          alt="drank"
          width={80}
          height={24}
          className="h-6 w-auto"
          priority
        />
        <StepIndicator currentStep={step} totalSteps={3} />
      </header>

      {/* Content - fills remaining space, no scroll */}
      <div className="flex min-h-0 flex-1 flex-col">
        {step === 1 && (
          <UploadStep
            image={image}
            onImageUpload={handleImageUpload}
            onNext={() => {
              if (!receiptData.date) {
                const now = new Date()
                const y = now.getFullYear()
                const m = String(now.getMonth() + 1).padStart(2, "0")
                const d = String(now.getDate()).padStart(2, "0")
                const datePart = `${y}-${m}-${d}`
                const timePart = now.toTimeString().slice(0, 5)
                setReceiptData((prev) => ({
                  ...prev,
                  date: datePart,
                  time: timePart,
                }))
              }
              setStep(2)
            }}
            onSkip={() => {
              // Set current date/time when skipping
              const now = new Date()
              const y = now.getFullYear()
              const m = String(now.getMonth() + 1).padStart(2, "0")
              const d = String(now.getDate()).padStart(2, "0")
              const datePart = `${y}-${m}-${d}`
              const timePart = now.toTimeString().slice(0, 5)
              setReceiptData((prev) => ({
                ...prev,
                date: datePart,
                time: timePart,
              }))
              setStep(2)
            }}
          />
        )}

        {step === 2 && (
          <DecorateStep
            data={receiptData}
            image={image}
            stickers={stickers}
            onStickersChange={setStickers}
            onUpdate={handleReceiptUpdate}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && (
          <ShareStep
            data={receiptData}
            image={image}
            stickers={stickers}
            onReset={handleReset}
            onBack={() => setStep(2)}
            onImageUpload={handleImageUpload}
          />
        )}
      </div>
    </main>
  )
}