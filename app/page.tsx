"use client"

import { useState, useCallback } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { StepIndicator } from "@/components/step-indicator"
import { UploadStep } from "@/components/upload-step"
import { DecorateStep, type ReceiptData, type StickerItem } from "@/components/decorate-step"
import { ShareStep } from "@/components/share-step"
import { NavDrawer, HamburgerButton } from "@/components/ui/nav-drawer"
import { Button } from "@/components/ui/button"
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

function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export default function DrankApp() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [image, setImage] = useState<string | null>(null)
  const [receiptData, setReceiptData] = useState<ReceiptData>(defaultReceiptData)
  const [stickers, setStickers] = useState<StickerItem[]>([])
  const [receiptId] = useState(() => generateId())

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [leaveTarget, setLeaveTarget] = useState<string | null>(null)

  const handleImageUpload = useCallback(
    (img: string, exifDate?: string, exifLocation?: string, exifCafe?: string) => {
      setImage(img || null)
      const updates: Partial<ReceiptData> = {}
      if (exifDate) {
        const [datePart, timePart] = exifDate.split("T")
        updates.date = datePart || ""
        updates.time = timePart || ""
      }
      if (exifLocation) updates.location = exifLocation
      if (exifCafe) updates.cafeName = exifCafe
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
  }, [])

  // Returns true = navigate, false = block and show modal
  const handleNavRequest = useCallback((href: string): boolean => {
    if (step === 2) {
      setLeaveTarget(href)
      return false
    }
    return true
  }, [step])

  const handleLeaveConfirm = useCallback(() => {
    if (!leaveTarget) return
    const target = leaveTarget
    setLeaveTarget(null)
    router.push(target)
  }, [leaveTarget, router])

  const handleEnterShare = useCallback(async () => {
    let data = receiptData
    if (!data.date) {
      const now = new Date()
      const y = now.getFullYear()
      const m = String(now.getMonth() + 1).padStart(2, "0")
      const d = String(now.getDate()).padStart(2, "0")
      data = { ...data, date: `${y}-${m}-${d}`, time: now.toTimeString().slice(0, 5) }
      setReceiptData(data)
    }
    try { await saveReceipt(receiptId, data, image) } catch { /* non-critical */ }
    setStep(3)
  }, [receiptId, receiptData, image])

  const stampDate = useCallback(() => {
    if (receiptData.date) return
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, "0")
    const d = String(now.getDate()).padStart(2, "0")
    setReceiptData((prev) => ({
      ...prev,
      date: `${y}-${m}-${d}`,
      time: now.toTimeString().slice(0, 5),
    }))
  }, [receiptData.date])



  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-background">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="relative flex shrink-0 items-center justify-center px-4 pb-2 pt-4 md:px-6">

        {/* Mobile: hamburger left */}
        <div className="absolute left-4 md:hidden">
          <HamburgerButton onClick={() => setDrawerOpen(true)} />
        </div>

        {/* Logo — always centered, acts as home/rank link */}
        <Link
          href="/"
          onClick={(e) => { if (step === 2) { e.preventDefault(); setLeaveTarget("/") } }}
          aria-label="drank — go to rank"
        >
          <Image
            src="/logo.png"
            alt="drank"
            width={80}
            height={24}
            className="h-6 w-auto transition-opacity hover:opacity-70"
            priority
          />
        </Link>

        {/* Desktop: history link right. Mobile: hidden (lives in drawer). */}
        <div className="absolute right-4 hidden md:block">
          <Link
            href="/history"
            onClick={(e) => { if (step === 2) { e.preventDefault(); setLeaveTarget("/history") } }}
            className="font-sans text-sm text-green-dark transition-colors hover:opacity-70"
          >
            History
          </Link>
        </div>
      </header>

      {/* Step indicator */}
      <div className="flex shrink-0 justify-center pb-2">
        <StepIndicator currentStep={step} totalSteps={3} />
      </div>

      {/* Step content */}
      <div className="flex min-h-0 flex-1 flex-col">
        {step === 1 && (
          <UploadStep
            image={image}
            onImageUpload={handleImageUpload}
            onNext={() => { stampDate(); setStep(2) }}
            onSkip={() => { stampDate(); setStep(2) }}
          />
        )}

        {step === 2 && (
          <DecorateStep
            data={receiptData}
            image={image}
            stickers={stickers}
            onStickersChange={setStickers}
            onUpdate={handleReceiptUpdate}
            onNext={handleEnterShare}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && (
          <ShareStep
            data={receiptData}
            image={image}
            stickers={stickers}
            receiptId={receiptId}
            onReset={handleReset}
            onBack={() => setStep(2)}
            onImageUpload={handleImageUpload}
          />
        )}
      </div>

      {/* Mobile nav drawer */}
      <NavDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onNavigate={handleNavRequest}
      />

      {/* Leave-receipt modal */}
      {leaveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl bg-card p-6 shadow-lg">
            <div className="flex flex-col gap-1.5">
              <p className="font-mono text-sm font-medium text-foreground">
                Leave this receipt?
              </p>
              <p className="font-sans text-sm text-muted-foreground">
                Your ranking progress will be lost.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 rounded-full border-border font-mono text-sm"
                onClick={() => setLeaveTarget(null)}
              >
                stay
              </Button>
              <Button
                className="flex-1 rounded-full bg-pink-dark font-mono text-sm text-white hover:bg-pink-dark/90"
                onClick={handleLeaveConfirm}
              >
                leave
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}