"use client"

import { useState, useCallback } from "react"
import Image from "next/image"
import { StepIndicator } from "@/components/step-indicator"
import { UploadStep } from "@/components/upload-step"
import { DecorateStep, type ReceiptData, type StickerItem } from "@/components/decorate-step"
import { ShareStep } from "@/components/share-step"
import { saveReceipt } from "@/lib/receipt-store"

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
  otherIceLevel: "",
  sugarLevel: "",
  otherSugarLevel: "",
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
  const [receiptId, setReceiptId] = useState<string | null>(null)

  const goToRank = useCallback(() => {
    setReceiptId(crypto.randomUUID())
    setStep(2)
  }, [])

  const goToShare = useCallback(async () => {
    if (receiptId) {
      await saveReceipt(receiptId, receiptData, image)
    }
    setStep(3)
  }, [receiptId, receiptData, image])

  const handleImageUpload = useCallback(
    (img: string, exifDate?: string, exifLocation?: string, exifCafe?: string) => {
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
      if (exifCafe) {
        updates.cafeName = exifCafe
      }
      if (Object.keys(updates).length > 0) {
        setReceiptData((prev) => ({ ...prev, ...updates }))
      }
    },
    []
  )

  const handleReceiptUpdate = useCallback((updates: Partial<ReceiptData>) => {
    setReceiptData((prev) => ({ ...prev, ...updates }))
  }, [])

  const handleReset = useCallback(() => {
    setStep(1)
    setImage(null)
    setReceiptData(defaultReceiptData)
    setStickers([])
    setReceiptId(null)
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
              goToRank()
            }}
            onSkip={() => {
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
              goToRank()
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
            onNext={goToShare}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && (
          <ShareStep
            data={receiptData}
            image={image}
            stickers={stickers}
            receiptId={receiptId!}
            onReset={handleReset}
            onBack={() => setStep(2)}
            onImageUpload={handleImageUpload}
          />
        )}
      </div>
    </main>
  )
}