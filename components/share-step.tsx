"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, RotateCcw, ArrowLeft, Upload, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ReceiptData, StickerItem } from "@/components/decorate-step"
import { removeBackground } from "@imgly/background-removal"
import { ERRORS, pickError } from "@/lib/errors"

/* ============================================================
   Sticker Definitions
   ============================================================ */

interface StickerDef {
  text: string
  bg: string
  textColor: string
  rotation: number
}

const STICKER_GROUPS: StickerDef[][] = [
  // Row 1: Positive → neutral
  [
    { text: "fire",            bg: "#FF7347", textColor: "#96003F",     rotation: -3 },
    { text: "my go-to",        bg: "#FFB1D0", textColor: "#96003F",     rotation:  4 },
    { text: "so good",         bg: "#FDE45F", textColor: "#FF7347",     rotation: -2 },
    { text: "highly recommend",bg: "#CADFF4", textColor: "#96003F",     rotation:  3 },
    { text: "solid",           bg: "#E3E91B", textColor: "#96003F",  rotation: -4 },
    { text: "good not great",  bg: "#96003F", textColor: "#CADFF4",     rotation:  2 },
  ],
  // Row 2: Mixed → negative
  [
    { text: "so-so",           bg: "#FDE45F", textColor: "#2A2A00",  rotation:  3 },
    { text: "meh",             bg: "#E3E91B", textColor: "#FF7347",     rotation: -3 },
    { text: "kinda mid",       bg: "#FF7347", textColor: "#CADFF4",     rotation:  4 },
    { text: "not for me",      bg: "#96003F", textColor: "#FFE657",  rotation: -2 },
    { text: "not worth",       bg: "#FFB1D0", textColor: "#3A1206",     rotation:  2 },
    { text: "never again",     bg: "#3A1206", textColor: "#CADFF4",     rotation: -4 },
  ],
]

/* ============================================================
   Placed Sticker Type
   ============================================================ */

interface PlacedSticker {
  id: string
  text: string
  bg: string
  textColor: string
  x: number // percentage 0-100
  y: number // percentage 0-100
  scale: number // 1 = default
  rotation: number // degrees
}

/* ============================================================
   Main Component
   ============================================================ */

interface ShareStepProps {
  data: ReceiptData
  image: string | null
  stickers: StickerItem[]
  onReset: () => void
  onBack: () => void
  onImageUpload: (image: string, exifDate?: string) => void
}

interface SelectionRect {
  x: number
  y: number
  width: number
  height: number
  containerWidth?: number
  containerHeight?: number
}

// Receipt constants — single source of truth used by both preview and canvas export
const RECEIPT_BG = "#FEFCF4"
const RECEIPT_RADIUS = 4 // px, small border radius on receipt in export
const TEXT_COLOR = "#473C23"

export function ShareStep({
  data,
  image,
  onReset,
  onBack,
  onImageUpload,
}: ShareStepProps) {
  const receiptCanvasRef = useRef<HTMLCanvasElement>(null)
  const storyCanvasRef = useRef<HTMLCanvasElement>(null)
  const storyPreviewRef = useRef<HTMLDivElement>(null)
  const receiptCaptureRef = useRef<HTMLCanvasElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const [storyUrl, setStoryUrl] = useState<string | null>(null)
  const [receiptCaptureUrl, setReceiptCaptureUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPhotoConverting, setIsPhotoConverting] = useState(false)

  // Drink sticker state
  const [showDrinkSticker, setShowDrinkSticker] = useState(false)
  const [bgRemovedImage, setBgRemovedImage] = useState<string | null>(null)
  const [isBgProcessing, setIsBgProcessing] = useState(false)
  const [bgError, setBgError] = useState<string | null>(null)
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null)
  const [showSelectionModal, setShowSelectionModal] = useState(false)
  const [hasEverSelected, setHasEverSelected] = useState(false)

  const [activeTab, setActiveTab] = useState<"story" | "receipt">("receipt")

  // Separate sticker arrays for each canvas
  const [receiptStickers, setReceiptStickers] = useState<PlacedSticker[]>([])
  const [storyStickers, setStoryStickers] = useState<PlacedSticker[]>([])
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null)

  const activeStickers = activeTab === "receipt" ? receiptStickers : storyStickers
  const setActiveStickers = activeTab === "receipt" ? setReceiptStickers : setStoryStickers

  // Generate images when data or sticker toggle changes
  useEffect(() => {
    generateImages()
  }, [data, showDrinkSticker, bgRemovedImage, receiptStickers, storyStickers, image])

  const generateImages = useCallback(async () => {
    setIsGenerating(true)

    // Load sticker image if needed
    let stickerImg: HTMLImageElement | null = null
    if (showDrinkSticker && bgRemovedImage) {
      stickerImg = new window.Image()
      stickerImg.crossOrigin = "anonymous"
      await new Promise<void>((resolve) => {
        stickerImg!.onload = () => resolve()
        stickerImg!.onerror = () => resolve()
        stickerImg!.src = bgRemovedImage
      })
    }

    // Generate receipt PNG (with placed stickers, for download)
    const rUrl = await generateReceiptCanvas(receiptCanvasRef.current, data, stickerImg, receiptStickers)
    setReceiptUrl(rUrl)

    // Generate clean receipt (no placed stickers) for story overlay — reuse generateReceiptCanvas
    // on a fresh canvas so the story receipt is always a clean, proportionally correct capture
    const cleanCanvas = document.createElement("canvas")
    await generateReceiptCanvas(cleanCanvas, data, stickerImg, [])
    receiptCaptureRef.current = cleanCanvas
    setReceiptCaptureUrl(cleanCanvas.toDataURL("image/png"))

    // Generate story PNG using the clean receipt canvas
    if (image) {
      const sUrl = await generateStoryCanvas(cleanCanvas, storyStickers, image, storyPreviewRef.current)
      setStoryUrl(sUrl)
    } else {
      setStoryUrl(null)
    }

    setIsGenerating(false)
  }, [data, showDrinkSticker, bgRemovedImage, image, receiptStickers, storyStickers])

  const handleToggleSticker = useCallback(() => {
    if (!showDrinkSticker) {
      if (!hasEverSelected) {
        setShowSelectionModal(true)
      } else {
        setShowDrinkSticker(true)
      }
    } else {
      setShowDrinkSticker(false)
    }
  }, [showDrinkSticker, hasEverSelected])

  const handleSelectionConfirm = useCallback(async (rect: SelectionRect) => {
    setShowSelectionModal(false)
    setSelectionRect(rect)
    setHasEverSelected(true)
    setIsBgProcessing(true)
    setBgError(null)

    try {
      if (!image) throw new Error("No image")

      const img = new window.Image()
      img.crossOrigin = "anonymous"
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error("Failed to load image"))
        img.src = image
      })

      const cropCanvas = document.createElement("canvas")
      const cropCtx = cropCanvas.getContext("2d")
      if (!cropCtx) throw new Error("No canvas context")

      // The selection modal uses object-contain, which letterboxes the image with black bars.
      // rect percentages are relative to the full container (including bars), so we must
      // map them back to the actual rendered image area inside the container.
      //
      // Compute the rendered image rect using object-contain logic:
      // scale = min(containerW/imgW, containerH/imgH), centered.
      let actualX: number, actualY: number, actualW: number, actualH: number

      const cW = rect.containerWidth
      const cH = rect.containerHeight

      if (cW && cH) {
        const imgScale = Math.min(cW / img.naturalWidth, cH / img.naturalHeight)
        const rendW = img.naturalWidth * imgScale
        const rendH = img.naturalHeight * imgScale
        const offX = (cW - rendW) / 2
        const offY = (cH - rendH) / 2

        // Convert container-% coords to container-pixel coords
        const selX = (rect.x / 100) * cW
        const selY = (rect.y / 100) * cH
        const selW = (rect.width / 100) * cW
        const selH = (rect.height / 100) * cH

        // Map to image-pixel coords (clamp to image bounds)
        const imgX = (selX - offX) / imgScale
        const imgY = (selY - offY) / imgScale
        const imgW2 = selW / imgScale
        const imgH2 = selH / imgScale

        // Add 5% padding in image pixels on each side
        const padPx = Math.max(imgW2, imgH2) * 0.05
        actualX = Math.max(0, imgX - padPx)
        actualY = Math.max(0, imgY - padPx)
        actualW = Math.min(img.naturalWidth - actualX, imgW2 + padPx * 2)
        actualH = Math.min(img.naturalHeight - actualY, imgH2 + padPx * 2)
      } else {
        // Fallback to simple percentage mapping with padding
        const PAD = 0.05
        const paddedX = Math.max(0, rect.x / 100 - PAD)
        const paddedY = Math.max(0, rect.y / 100 - PAD)
        const paddedW = Math.min(1 - paddedX, rect.width / 100 + PAD * 2)
        const paddedH = Math.min(1 - paddedY, rect.height / 100 + PAD * 2)
        actualX = paddedX * img.naturalWidth
        actualY = paddedY * img.naturalHeight
        actualW = paddedW * img.naturalWidth
        actualH = paddedH * img.naturalHeight
      }

      cropCanvas.width = actualW
      cropCanvas.height = actualH
      cropCtx.drawImage(img, actualX, actualY, actualW, actualH, 0, 0, actualW, actualH)

      const croppedBlob = await new Promise<Blob>((resolve, reject) => {
        cropCanvas.toBlob((blob) => {
          if (blob) resolve(blob)
          else reject(new Error("Failed to create blob"))
        }, "image/png")
      })

      const result = await removeBackground(croppedBlob)

      const reader = new FileReader()
      reader.onloadend = () => {
        setBgRemovedImage(reader.result as string)
        setShowDrinkSticker(true)
        setIsBgProcessing(false)
      }
      reader.readAsDataURL(result)
    } catch (error) {
      console.error("Background removal failed:", error)
      setBgError(pickError(ERRORS.bgRemovalFailed))
      setIsBgProcessing(false)
    }
  }, [image])

  const handleReselect = useCallback(() => {
    setShowSelectionModal(true)
  }, [])

  const handleDownloadReceipt = useCallback(() => {
    if (!receiptUrl) return
    const link = document.createElement("a")
    link.download = `drank-${data.drinkName?.replace(/\s+/g, "-").toLowerCase() || "receipt"}.png`
    link.href = receiptUrl
    link.click()
  }, [receiptUrl, data.drinkName])

  const handleDownloadStory = useCallback(() => {
    if (!storyUrl) return
    const link = document.createElement("a")
    link.download = `drank-${data.drinkName?.replace(/\s+/g, "-").toLowerCase() || "receipt"}-story.png`
    link.href = storyUrl
    link.click()
  }, [storyUrl, data.drinkName])

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      e.target.value = ""

      let dataUrl: string

      const isHeic =
        file.type.toLowerCase() === "image/heic" ||
        file.type.toLowerCase() === "image/heif" ||
        /\.(heic|heif)$/i.test(file.name)

      if (isHeic) {
        setIsPhotoConverting(true)
        try {
          const heic2any = (await import("heic2any")).default
          const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 })
          const jpegBlob = Array.isArray(blob) ? blob[0] : blob
          dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.onerror = () => reject(new Error("FileReader failed"))
            reader.readAsDataURL(jpegBlob)
          })
        } catch {
          setIsPhotoConverting(false)
          return
        }
        setIsPhotoConverting(false)
      } else {
        dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.readAsDataURL(file)
        })
      }

      setBgRemovedImage(null)
      setSelectionRect(null)
      setHasEverSelected(false)
      setShowDrinkSticker(false)

      onImageUpload(dataUrl)
    },
    [onImageUpload]
  )

  const handleAddSticker = useCallback((def: StickerDef) => {
    const newSticker: PlacedSticker = {
      id: `sticker-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      text: def.text,
      bg: def.bg,
      textColor: def.textColor,
      x: 50,
      y: 50,
      scale: 1,
      rotation: 0,
    }
    setActiveStickers((prev) => [...prev, newSticker])
    setSelectedStickerId(newSticker.id)
  }, [setActiveStickers])

  const handleUpdateSticker = useCallback((id: string, updates: Partial<PlacedSticker>) => {
    setActiveStickers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    )
  }, [setActiveStickers])

  const handleDeleteSticker = useCallback((id: string) => {
    setActiveStickers((prev) => prev.filter((s) => s.id !== id))
    if (selectedStickerId === id) {
      setSelectedStickerId(null)
    }
  }, [setActiveStickers, selectedStickerId])

  const handleCanvasClick = useCallback(() => {
    setSelectedStickerId(null)
  }, [])

  const hasImage = !!image
  const canShowStory = hasImage

  // Controls block — shared between desktop sidebar and mobile inline
  const DrinkStickerControl = (
    <div className="flex w-full items-center rounded-xl">
      {!hasImage ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 font-sans text-sm text-green-dark transition-colors hover:opacity-70"
        >
          Upload Photo For Sticker &amp; Story
          <Upload className="size-4" />
        </button>
      ) : isPhotoConverting ? (
        <span className="flex items-center gap-1.5 font-sans text-sm text-muted-foreground">
          converting photo…
          <div className="size-4 animate-spin rounded-full border-2 border-muted border-t-foreground" />
        </span>
      ) : isBgProcessing ? (
        <span className="flex items-center gap-1.5 font-sans text-sm text-muted-foreground">
          processing...
          <div className="size-4 animate-spin rounded-full border-2 border-muted border-t-foreground" />
        </span>
      ) : (
        <div className="flex w-full items-center justify-between">
          {/* Left: toggle + label */}
          <div className="flex items-center gap-2">
            <button
              role="switch"
              aria-checked={showDrinkSticker}
              onClick={handleToggleSticker}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
                showDrinkSticker ? "bg-pink-dark" : "bg-pink-dark/20"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none block size-5 rounded-full bg-white shadow-lg transition-transform",
                  showDrinkSticker ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
            <span className="font-sans text-sm text-pink-dark">Include Drink Sticker</span>
            {showDrinkSticker && (
              <button
                onClick={handleReselect}
                className="font-sans text-xs text-pink-dark underline transition-colors hover:opacity-70"
              >
                Re-select
              </button>
            )}
          </div>
          {/* Right: upload again */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 font-sans text-sm text-green-dark transition-colors hover:opacity-70"
          >
            Upload Again
            <Upload className="size-4" />
          </button>
        </div>
      )}
      {bgError && (
        <p className="mt-1 font-mono text-xs text-destructive">{bgError}</p>
      )}
    </div>
  )

  const TabSwitcher = (
    <div className="flex rounded-xl border-2 border-border bg-transparent p-1.5">
      <button
        onClick={() => canShowStory && setActiveTab("story")}
        disabled={!canShowStory}
        className={cn(
          "flex-1 rounded-md py-3 font-mono text-sm transition-colors",
          activeTab === "story" && canShowStory
            ? "bg-[#E0DE96] text-[#1A1208]"
            : "text-muted-foreground",
          !canShowStory && "cursor-not-allowed opacity-40"
        )}
      >
        {canShowStory ? "Story" : "Story Unavailable"}
      </button>
      <button
        onClick={() => setActiveTab("receipt")}
        className={cn(
          "flex-1 rounded-md py-3 font-mono text-sm transition-colors",
          activeTab === "receipt"
            ? "bg-[#E0DE96] text-[#1A1208]"
            : "text-muted-foreground"
        )}
      >
        Receipt
      </button>
    </div>
  )

  return (
    <div className="flex h-full flex-col overflow-y-auto md:overflow-hidden">
      {/* Hidden canvases for export */}
      <canvas ref={receiptCanvasRef} className="hidden" />
      <canvas ref={storyCanvasRef} className="hidden" />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Selection Modal */}
      {showSelectionModal && image && (
        <ForegroundSelectionModal
          image={image}
          initialRect={selectionRect}
          onConfirm={handleSelectionConfirm}
          onCancel={() => setShowSelectionModal(false)}
        />
      )}

      {/* Main scrollable content */}
      <div className="mx-auto flex w-full max-w-[1100px] flex-col px-4 pt-3 md:h-full md:overflow-hidden md:px-6">
        <div className="flex flex-col md:h-full md:flex-row md:gap-8 md:overflow-hidden">

          {/* Left column: Receipt/Story preview */}
          <div className="flex flex-col md:h-full md:w-[400px] md:min-h-0">

            {/* Row 1: Back button — fixed height, flush to top */}
            {/* Mobile */}
            <div className="flex items-center justify-between md:hidden">
              <button
                onClick={onBack}
                className="flex items-center gap-1.5 py-2 font-sans text-sm text-green-dark transition-colors hover:opacity-70"
              >
                <ArrowLeft className="size-4" />
                Back
              </button>
            </div>
            {/* Desktop — h-[40px] matches decorate-step back button row */}
            <div className="hidden h-[40px] shrink-0 items-center md:flex">
              <button
                onClick={onBack}
                className="flex items-center gap-1.5 font-sans text-sm text-green-dark transition-colors hover:opacity-70"
              >
                <ArrowLeft className="size-4" />
                Back
              </button>
            </div>

            {/* Row 2: Canvas — flex-1, receipt/story centered */}
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <InteractiveCanvas
                data={data}
                stickerImage={showDrinkSticker ? bgRemovedImage : null}
                isProcessing={isBgProcessing}
                placedStickers={activeStickers}
                selectedStickerId={selectedStickerId}
                onSelectSticker={setSelectedStickerId}
                onUpdateSticker={handleUpdateSticker}
                onDeleteSticker={handleDeleteSticker}
                onCanvasClick={handleCanvasClick}
                mode={activeTab}
                backgroundImage={activeTab === "story" && canShowStory ? image : null}
                storyPreviewRef={storyPreviewRef}
                storyReceiptUrl={receiptCaptureUrl}
              />
            </div>

            {/* Row 3: Bottom section — fixed h-[120px], same as decorate-step.
                Contains "Rank Another" + Download button, stacked, pinned to bottom. */}
            <div className="hidden h-[120px] shrink-0 flex-col items-center justify-end gap-0 pb-16 md:flex">
              <div className="flex justify-center py-2">
                <button
                  onClick={onReset}
                  className="flex items-center gap-2 font-sans text-sm text-pink-dark transition-colors hover:opacity-70"
                >
                  <RotateCcw className="size-4" />
                  Rank Another
                </button>
              </div>
              <Button
                size="lg"
                className="w-full max-w-[200px] bg-brown px-8 font-sans text-sm text-white hover:bg-brown/90"
                style={{ paddingTop: 24, paddingBottom: 24 }}
                onClick={activeTab === "story" ? handleDownloadStory : handleDownloadReceipt}
                disabled={isGenerating || (activeTab === "story" && !storyUrl)}
              >
                <Download className="size-4" />
                {activeTab === "story" ? "Download Story" : "Download Receipt"}
              </Button>
            </div>

            {/* Mobile-only: drink sticker control — pt-4 keeps it off the canvas above */}
            <div className="mb-2 flex justify-center pt-4 md:hidden">
              {DrinkStickerControl}
            </div>
          </div>

          {/* Right column: Controls */}
          <div className="flex flex-col gap-4 pb-24 md:min-h-0 md:flex-1 md:overflow-hidden md:pb-6">
            {/* Inner wrapper — vertically centers content on desktop, no padding/margin */}
            <div className="flex flex-col gap-4 md:flex-1 md:justify-center">
              {/* Desktop-only drink sticker control — centered above tab switcher */}
              <div className="hidden justify-center md:flex">
                {DrinkStickerControl}
              </div>

              {/* Tab switcher */}
              <div>
                {TabSwitcher}
              </div>

              {/* Stickers panel - single responsive wrapping group */}
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap justify-center gap-3">
                  {STICKER_GROUPS.flat().map((sticker) => (
                    <button
                      key={sticker.text}
                      onClick={() => handleAddSticker(sticker)}
                      className="rounded-full px-3.5 py-1.5 font-sans text-xs font-semibold transition-transform hover:scale-105 active:scale-95"
                      style={{
                        backgroundColor: sticker.bg,
                        color: sticker.textColor,
                        transform: `rotate(${sticker.rotation}deg)`,
                      }}
                    >
                      {sticker.text}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile fixed bottom button — full width, no background */}
      <div className="fixed inset-x-0 bottom-0 z-20 p-4 md:hidden">
      <Button
  size="lg"
  className="w-full bg-brown px-8 font-sans text-sm text-white hover:bg-brown/90"
  style={{ paddingTop: 32, paddingBottom: 32 }}
  onClick={activeTab === "story" ? handleDownloadStory : handleDownloadReceipt}
  disabled={isGenerating || (activeTab === "story" && !storyUrl)}
>
          <Download className="size-4" />
          {activeTab === "story" ? "Download Story" : "Download Receipt"}
        </Button>
      </div>
    </div>
  )
}

/* ============================================================
   Interactive Canvas with Stickers
   ============================================================ */

function toTitleCase(str: string): string {
  if (!str) return ""
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "YYYYMMDD"
  return dateStr.replace(/-/g, "")
}

function formatTime(timeStr: string): string {
  if (!timeStr) return "12:00 AM"
  const [hours, minutes] = timeStr.split(":")
  const h = parseInt(hours, 10)
  const ampm = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 || 12
  return `${h12}:${minutes} ${ampm}`
}

function InteractiveCanvas({
  data,
  stickerImage,
  isProcessing,
  placedStickers,
  selectedStickerId,
  onSelectSticker,
  onUpdateSticker,
  onDeleteSticker,
  onCanvasClick,
  mode,
  backgroundImage,
  storyPreviewRef,
  storyReceiptUrl,
}: {
  data: ReceiptData
  stickerImage: string | null
  isProcessing?: boolean
  placedStickers: PlacedSticker[]
  selectedStickerId: string | null
  onSelectSticker: (id: string | null) => void
  onUpdateSticker: (id: string, updates: Partial<PlacedSticker>) => void
  onDeleteSticker: (id: string) => void
  onCanvasClick: () => void
  mode: "story" | "receipt"
  backgroundImage: string | null
  storyPreviewRef?: React.RefObject<HTMLDivElement | null>
  storyReceiptUrl?: string | null
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  const customizations: string[] = []
  if (data.iceTemp) customizations.push(toTitleCase(data.iceTemp))
  if (data.iceLevel) customizations.push(`${toTitleCase(data.iceLevel)} Ice`)
  if (data.sugarLevel) customizations.push(`${toTitleCase(data.sugarLevel)} Sugar`)
  const milkDisplay = data.milk === "other" && data.otherMilk ? data.otherMilk : data.milk
  if (milkDisplay) customizations.push(`${toTitleCase(milkDisplay)} Milk`)
  if (data.toppings.length > 0) customizations.push(...data.toppings.map(toTitleCase))
  if (data.otherCustomizations) customizations.push(toTitleCase(data.otherCustomizations))

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "YYYYMMDD"
    return dateStr.replace(/-/g, "")
  }

  const formatTime = (timeStr: string) => {
    if (!timeStr) return "12:00 AM"
    const [hours, minutes] = timeStr.split(":")
    const h = parseInt(hours, 10)
    const ampm = h >= 12 ? "PM" : "AM"
    const h12 = h % 12 || 12
    return `${h12}:${minutes} ${ampm}`
  }

  const handleContainerClick = (e: React.MouseEvent) => {
    if (e.target === containerRef.current) {
      onCanvasClick()
    }
  }

  if (mode === "story" && backgroundImage) {
    // Story mode: 9:16 aspect ratio, constrained so download button is never pushed off screen
    return (
      <div
        ref={(el) => { (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el; if (storyPreviewRef) (storyPreviewRef as React.MutableRefObject<HTMLDivElement | null>).current = el }}
        onClick={handleContainerClick}
        className="relative mx-auto overflow-hidden"
        style={{
          width: "min(220px, 100%)",
          aspectRatio: "9 / 16",
          maxHeight: "calc(100vh - 280px)",
        }}
      >
        {/* Background image */}
        <img
          src={backgroundImage}
          alt="Background"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: "brightness(0.9)" }}
        />

        {/* Receipt overlay — screenshot of the real receipt, scaled to fit */}
        {storyReceiptUrl && (
          <img
            src={storyReceiptUrl}
            alt="receipt"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ width: "70%", display: "block", borderRadius: 4 }}
            draggable={false}
          />
        )}

        {/* Placed stickers */}
        {placedStickers.map((sticker) => (
          <DraggableSticker
            key={sticker.id}
            sticker={sticker}
            isSelected={selectedStickerId === sticker.id}
            onSelect={() => onSelectSticker(sticker.id)}
            onUpdate={(updates) => onUpdateSticker(sticker.id, updates)}
            onDelete={() => onDeleteSticker(sticker.id)}
            containerRef={containerRef}
          />
        ))}
      </div>
    )
  }

  // Receipt mode — no animation, no rotation, stickers bounded to receipt
  return (
    <div className="relative mx-auto flex items-center justify-center" style={{ width: "min(320px, 100%)" }}>
      <div
        ref={containerRef}
        onClick={handleContainerClick}
        className="relative w-[280px] rounded-sm px-5 py-6 shadow-md overflow-hidden"
        style={{ backgroundColor: RECEIPT_BG }}
      >
        <ReceiptContent
          data={data}
          stickerImage={stickerImage}
          isProcessing={isProcessing}
          customizations={customizations}
          formatDate={formatDate}
          formatTime={formatTime}
        />

        {/* Placed stickers — inside receipt div so they are bounded to it */}
        {placedStickers.map((sticker) => (
          <DraggableSticker
            key={sticker.id}
            sticker={sticker}
            isSelected={selectedStickerId === sticker.id}
            onSelect={() => onSelectSticker(sticker.id)}
            onUpdate={(updates) => onUpdateSticker(sticker.id, updates)}
            onDelete={() => onDeleteSticker(sticker.id)}
            containerRef={containerRef}
          />
        ))}
      </div>
    </div>
  )
}

/* ============================================================
   Receipt Content (shared between preview modes)
   ============================================================ */

function ReceiptContent({
  data,
  stickerImage,
  isProcessing,
  customizations,
  formatDate,
  formatTime,
  small,
}: {
  data: ReceiptData
  stickerImage: string | null
  isProcessing?: boolean
  customizations: string[]
  formatDate: (d: string) => string
  formatTime: (t: string) => string
  small?: boolean
}) {
  const textSize = small ? "text-[8px]" : "text-xs"
  const titleSize = small ? "text-sm" : "text-lg"
  const ratingSize = small ? "size-10 text-sm" : "size-14 text-lg"

  return (
    <>
      {/* Rating circle */}
      <div className={cn("mb-3 flex justify-center", small && "mb-1")}>
        <div
          className={cn("flex items-center justify-center rounded-full border-2", ratingSize)}
          style={{ borderColor: TEXT_COLOR }}
        >
          <span className="font-mono font-normal" style={{ color: TEXT_COLOR }}>
            {data.rating || "10.0"}
          </span>
        </div>
      </div>

      {/* Cafe name */}
      <p
        className={cn("mb-3 text-center font-mono font-medium", textSize)}
        style={{ color: TEXT_COLOR }}
      >
        {data.cafeName || "cafe"}
      </p>

      {/* Drink name */}
      <h3
        className={cn("mb-3 text-center font-mono font-medium leading-tight", titleSize)}
        style={{ color: TEXT_COLOR }}
      >
        {data.drinkName || "Beverage"}
      </h3>

      {/* Customizations */}
      {customizations.length > 0 && (
        <p
          className={cn("mb-3 text-center font-mono font-medium", textSize)}
          style={{ color: TEXT_COLOR }}
        >
          {customizations.join(", ")}
        </p>
      )}

      {/* Drink sticker */}
      {isProcessing ? (
        <div className="my-3 flex justify-center">
          <div className="flex flex-col items-center gap-1">
            <div className="size-6 animate-spin rounded-full border-2 border-muted border-t-foreground" />
            <span className="text-[8px] text-muted-foreground">removing background...</span>
          </div>
        </div>
      ) : stickerImage ? (
        <div className="my-3 flex justify-center">
          <img
            src={stickerImage}
            alt="Drink sticker"
            className={cn("object-contain", small ? "max-h-[80px] max-w-[110px]" : "max-h-[140px] max-w-full")}
          />
        </div>
      ) : null}

      {/* Notes */}
      {data.comments && (
        <p className={cn("mb-3 font-mono font-light", textSize)} style={{ color: TEXT_COLOR }}>
          Notes: {data.comments}
        </p>
      )}

      {/* Location */}
      {data.location && (
        <p className={cn("font-mono font-light", textSize)} style={{ color: TEXT_COLOR }}>
          {data.location}
        </p>
      )}

      {/* Date/Time */}
      <p className={cn("mb-3 font-mono font-light", textSize)} style={{ color: TEXT_COLOR }}>
        {formatDate(data.date)} {formatTime(data.time)}
      </p>

      {/* Divider */}
      <div className="mb-3 border-t" style={{ borderColor: TEXT_COLOR, opacity: 0.2 }} />

      {/* Footer */}
      <p className={cn("text-center font-mono font-normal", textSize)} style={{ color: TEXT_COLOR }}>
        Ranked with <span className="font-medium">drank</span>
      </p>
    </>
  )
}

/* ============================================================
   Draggable Sticker with Handles
   ============================================================ */

function DraggableSticker({
  sticker,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  containerRef,
}: {
  sticker: PlacedSticker
  isSelected: boolean
  onSelect: () => void
  onUpdate: (updates: Partial<PlacedSticker>) => void
  onDelete: () => void
  containerRef: React.RefObject<HTMLDivElement | null>
}) {
  const stickerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isRotating, setIsRotating] = useState(false)
  const dragStartRef = useRef<{ x: number; y: number; stickerX: number; stickerY: number } | null>(null)
  const resizeStartRef = useRef<{ scale: number; startDistance: number } | null>(null)
  const rotateStartRef = useRef<{ rotation: number; startAngle: number } | null>(null)

  const getEventPosition = (e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
    if ("touches" in e && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
    if ("clientX" in e) {
      return { x: e.clientX, y: e.clientY }
    }
    return { x: 0, y: 0 }
  }

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    onSelect()

    if (!containerRef.current) return
    const pos = getEventPosition(e)

    setIsDragging(true)
    dragStartRef.current = {
      x: pos.x,
      y: pos.y,
      stickerX: sticker.x,
      stickerY: sticker.y,
    }
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!dragStartRef.current || !containerRef.current) return
      const bounds = containerRef.current.getBoundingClientRect()
      const pos = getEventPosition(e)

      const deltaX = ((pos.x - dragStartRef.current.x) / bounds.width) * 100
      const deltaY = ((pos.y - dragStartRef.current.y) / bounds.height) * 100

      onUpdate({
        x: Math.max(0, Math.min(100, dragStartRef.current.stickerX + deltaX)),
        y: Math.max(0, Math.min(100, dragStartRef.current.stickerY + deltaY)),
      })
    }

    const handleUp = () => {
      setIsDragging(false)
      dragStartRef.current = null
    }

    document.addEventListener("mousemove", handleMove)
    document.addEventListener("mouseup", handleUp)
    document.addEventListener("touchmove", handleMove)
    document.addEventListener("touchend", handleUp)

    return () => {
      document.removeEventListener("mousemove", handleMove)
      document.removeEventListener("mouseup", handleUp)
      document.removeEventListener("touchmove", handleMove)
      document.removeEventListener("touchend", handleUp)
    }
  }, [isDragging, containerRef, onUpdate])

  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    onSelect()

    const pos = getEventPosition(e)
    if (!containerRef.current) return
    const bounds = containerRef.current.getBoundingClientRect()
    const centerX = bounds.left + (sticker.x / 100) * bounds.width
    const centerY = bounds.top + (sticker.y / 100) * bounds.height
    const distance = Math.hypot(pos.x - centerX, pos.y - centerY)

    setIsResizing(true)
    resizeStartRef.current = {
      scale: sticker.scale,
      startDistance: distance,
    }
  }

  useEffect(() => {
    if (!isResizing) return

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!resizeStartRef.current || !containerRef.current) return
      const bounds = containerRef.current.getBoundingClientRect()
      const pos = getEventPosition(e)

      const centerX = bounds.left + (sticker.x / 100) * bounds.width
      const centerY = bounds.top + (sticker.y / 100) * bounds.height
      const currentDistance = Math.hypot(pos.x - centerX, pos.y - centerY)

      const scaleRatio = currentDistance / resizeStartRef.current.startDistance
      const newScale = Math.max(0.3, Math.min(3, resizeStartRef.current.scale * scaleRatio))

      onUpdate({ scale: newScale })
    }

    const handleUp = () => {
      setIsResizing(false)
      resizeStartRef.current = null
    }

    document.addEventListener("mousemove", handleMove)
    document.addEventListener("mouseup", handleUp)
    document.addEventListener("touchmove", handleMove)
    document.addEventListener("touchend", handleUp)

    return () => {
      document.removeEventListener("mousemove", handleMove)
      document.removeEventListener("mouseup", handleUp)
      document.removeEventListener("touchmove", handleMove)
      document.removeEventListener("touchend", handleUp)
    }
  }, [isResizing, containerRef, sticker.x, sticker.y, onUpdate])

  const handleRotateStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    onSelect()

    const pos = getEventPosition(e)
    if (!containerRef.current) return
    const bounds = containerRef.current.getBoundingClientRect()
    const centerX = bounds.left + (sticker.x / 100) * bounds.width
    const centerY = bounds.top + (sticker.y / 100) * bounds.height
    const angle = Math.atan2(pos.y - centerY, pos.x - centerX) * (180 / Math.PI)

    setIsRotating(true)
    rotateStartRef.current = {
      rotation: sticker.rotation,
      startAngle: angle,
    }
  }

  useEffect(() => {
    if (!isRotating) return

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!rotateStartRef.current || !containerRef.current) return
      const bounds = containerRef.current.getBoundingClientRect()
      const pos = getEventPosition(e)

      const centerX = bounds.left + (sticker.x / 100) * bounds.width
      const centerY = bounds.top + (sticker.y / 100) * bounds.height
      const currentAngle = Math.atan2(pos.y - centerY, pos.x - centerX) * (180 / Math.PI)
      const deltaAngle = currentAngle - rotateStartRef.current.startAngle

      onUpdate({ rotation: rotateStartRef.current.rotation + deltaAngle })
    }

    const handleUp = () => {
      setIsRotating(false)
      rotateStartRef.current = null
    }

    document.addEventListener("mousemove", handleMove)
    document.addEventListener("mouseup", handleUp)
    document.addEventListener("touchmove", handleMove)
    document.addEventListener("touchend", handleUp)

    return () => {
      document.removeEventListener("mousemove", handleMove)
      document.removeEventListener("mouseup", handleUp)
      document.removeEventListener("touchmove", handleMove)
      document.removeEventListener("touchend", handleUp)
    }
  }, [isRotating, containerRef, sticker.x, sticker.y, onUpdate])

  return (
    <div
      ref={stickerRef}
      className="absolute cursor-move select-none"
      style={{
        left: `${sticker.x}%`,
        top: `${sticker.y}%`,
        transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg) scale(${sticker.scale})`,
        zIndex: isSelected ? 50 : 10,
      }}
      onMouseDown={handlePointerDown}
      onTouchStart={handlePointerDown}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Sticker content */}
      <div
        className="rounded-full px-3 py-1.5 font-sans text-xs font-semibold whitespace-nowrap"
        style={{
          backgroundColor: sticker.bg,
          color: sticker.textColor,
        }}
      >
        {sticker.text}
      </div>

      {/* Selection handles */}
      {isSelected && (
        <>
          {/* Selection outline */}
          <div className="pointer-events-none absolute -inset-2 border-2 border-dashed border-pink-dark" />

          {/* Delete button — outside top-right corner, z-index above resize handle */}
          <button
            className="absolute flex size-5 items-center justify-center rounded-full bg-pink-dark text-white shadow-md"
            style={{ top: "-20px", right: "-20px", zIndex: 60 }}
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
          >
            <X className="size-3" />
          </button>

          {/* Rotation handle — dot at top of line, line extends down to selection box */}
          <div
            className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center"
            style={{ bottom: "calc(100% + 8px)" }}
          >
            <div
              className="size-3 cursor-grab rounded-full border-2 border-pink-dark bg-white"
              onMouseDown={handleRotateStart}
              onTouchStart={handleRotateStart}
            />
            <div className="h-4 w-px bg-pink-dark" />
          </div>

          {/* Corner resize handles — all identical size-3 */}
          {[
            { pos: "-left-2 -top-2", cursor: "nwse-resize" },
            { pos: "-right-2 -top-2", cursor: "nesw-resize" },
            { pos: "-left-2 -bottom-2", cursor: "nesw-resize" },
            { pos: "-right-2 -bottom-2", cursor: "nwse-resize" },
          ].map((handle, i) => (
            <div
              key={i}
              className={cn(
                "absolute size-3 rounded-sm border-2 border-pink-dark bg-white",
                handle.pos
              )}
              style={{ cursor: handle.cursor }}
              onMouseDown={handleResizeStart}
              onTouchStart={handleResizeStart}
            />
          ))}
        </>
      )}
    </div>
  )
}

/* ============================================================
   Foreground Selection Modal
   ============================================================ */

function ForegroundSelectionModal({
  image,
  initialRect,
  onConfirm,
  onCancel,
}: {
  image: string
  initialRect: SelectionRect | null
  onConfirm: (rect: SelectionRect) => void
  onCancel: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null)
  const [rect, setRect] = useState<SelectionRect | null>(initialRect)
  const [selectionError, setSelectionError] = useState<string | null>(null)

  const getRelativePosition = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return null
    const bounds = containerRef.current.getBoundingClientRect()

    let clientX: number
    let clientY: number

    if ("touches" in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else if ("clientX" in e) {
      clientX = e.clientX
      clientY = e.clientY
    } else {
      return null
    }

    const x = ((clientX - bounds.left) / bounds.width) * 100
    const y = ((clientY - bounds.top) / bounds.height) * 100

    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) }
  }, [])

  const handlePointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const pos = getRelativePosition(e)
    if (!pos) return

    setIsDragging(true)
    setStartPoint(pos)
    setRect(null)
    setSelectionError(null)
  }, [getRelativePosition])

  const handlePointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || !startPoint) return

    const pos = getRelativePosition(e)
    if (!pos) return

    const x = Math.min(startPoint.x, pos.x)
    const y = Math.min(startPoint.y, pos.y)
    const width = Math.abs(pos.x - startPoint.x)
    const height = Math.abs(pos.y - startPoint.y)

    setRect({ x, y, width, height })
  }, [isDragging, startPoint, getRelativePosition])

  const handlePointerUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleConfirm = useCallback(() => {
    if (!rect || rect.width <= 5 || rect.height <= 5) {
      setSelectionError(pickError(ERRORS.noSelection))
      return
    }
    const bounds = containerRef.current?.getBoundingClientRect()
    onConfirm({
      ...rect,
      containerWidth: bounds?.width,
      containerHeight: bounds?.height,
    })
  }, [rect, onConfirm])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col gap-4 rounded-xl bg-card p-4">
        <div className="text-center">
          <h3 className="font-mono text-lg font-medium text-foreground">Select Your Drink</h3>
          <p className="text-sm text-muted-foreground">Draw a rectangle around the drink to create a sticker</p>
        </div>

        {/* container uses object-contain so the full image is always visible */}
        <div
          ref={containerRef}
          data-selection-container
          className="relative cursor-crosshair overflow-hidden rounded-lg bg-black"
          style={{ maxHeight: "60vh" }}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
        >
          <img
            src={image}
            alt="Select area"
            className="block w-full h-full object-contain"
            style={{ maxHeight: "60vh" }}
            draggable={false}
          />

          {/* Selection rectangle */}
          {rect && (
            <div
              className="absolute border-2 border-dashed border-pink-dark bg-pink/20"
              style={{
                left: `${rect.x}%`,
                top: `${rect.y}%`,
                width: `${rect.width}%`,
                height: `${rect.height}%`,
              }}
            />
          )}
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 bg-brown text-white hover:bg-brown/90"
            onClick={handleConfirm}
          >
            Confirm Selection
          </Button>
        </div>
        {selectionError && (
          <p className="text-center font-mono text-xs text-destructive">{selectionError}</p>
        )}
      </div>
    </div>
  )
}

/* ============================================================
   Canvas Generation Functions
   ============================================================ */

async function generateReceiptCanvas(
  canvas: HTMLCanvasElement | null,
  data: ReceiptData,
  stickerImg: HTMLImageElement | null,
  placedStickers: PlacedSticker[]
): Promise<string | null> {
  if (!canvas) return null

  // Render at 2x for sharpness. All coords are logical (1x) pixels.
  const SCALE = 2
  const LW = 280  // logical width — matches preview receipt width
  const LP = 20   // logical side padding — matches px-5
  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  // Pre-load fonts before measuring/drawing
  await Promise.all([
    document.fonts.load("600 12px 'Instrument Sans'"),
    document.fonts.load("400 12px 'Space Mono'"),
    document.fonts.load("500 12px 'Space Mono'"),
    document.fonts.load("300 12px 'Space Mono'"),
    document.fonts.load("400 18px 'Space Mono'"),
    document.fonts.load("500 18px 'Space Mono'"),
  ])

  // textBaseline "top" means y always = top of character, matching CSS behaviour
  ctx.textBaseline = "top"

  const customizations: string[] = []
  if (data.iceTemp) customizations.push(toTitleCase(data.iceTemp))
  if (data.iceLevel) customizations.push(`${toTitleCase(data.iceLevel)} Ice`)
  if (data.sugarLevel) customizations.push(`${toTitleCase(data.sugarLevel)} Sugar`)
  const milkDisplay = data.milk === "other" && data.otherMilk ? data.otherMilk : data.milk
  if (milkDisplay) customizations.push(`${toTitleCase(milkDisplay)} Milk`)
  if (data.toppings.length > 0) customizations.push(...data.toppings.map(toTitleCase))
  if (data.otherCustomizations) customizations.push(toTitleCase(data.otherCustomizations))

  // ── Pre-measure total height ───────────────────────────────────────────────
  // These match the Tailwind classes in ReceiptContent exactly:
  // py-6 = 24px top+bottom, mb-2 = 8px, text-xs = 12px, text-lg = 18px, etc.
  const ratingDiam = 56   // size-14 = 56px
  const ratingR = ratingDiam / 2

  // Set a dummy canvas size for measuring
  canvas.width = LW * SCALE
  canvas.height = 10
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.scale(SCALE, SCALE)
  ctx.textBaseline = "top"

  // Measure drink name wrapping (text-lg = 18px, font-medium)
  ctx.font = "500 18px 'Space Mono', monospace"
  const drinkWords = (data.drinkName || "Beverage").split(" ")
  let drinkLine = "", drinkLines: string[] = []
  for (const word of drinkWords) {
    const test = drinkLine ? `${drinkLine} ${word}` : word
    if (ctx.measureText(test).width > LW - LP * 2) { drinkLines.push(drinkLine); drinkLine = word }
    else drinkLine = test
  }
  if (drinkLine) drinkLines.push(drinkLine)

  // Measure notes wrapping (text-xs = 12px)
  let noteLines: string[] = []
  if (data.comments) {
    ctx.font = "300 12px 'Space Mono', monospace"
    const nWords = `Notes: ${data.comments}`.split(" ")
    let nLine = ""
    for (const word of nWords) {
      const test = nLine ? `${nLine} ${word}` : word
      if (ctx.measureText(test).width > LW - LP * 2) { noteLines.push(nLine); nLine = word }
      else nLine = test
    }
    if (nLine) noteLines.push(nLine)
  }

  // Build height from top — mirror ReceiptContent exactly
  // py-6 = 24px top padding
  let h = 24
  h += ratingDiam + 12   // rating circle + mb-3
  h += 12 + 12           // cafe text-xs + mb-3
  h += drinkLines.length * 22 + 12  // drink name lines (18px + ~4px leading) + mb-3
  if (customizations.length > 0) h += 12 + 12  // text-xs + mb-3
  if (stickerImg) {
    const maxW = LW - LP * 2, maxH = 140
    const s = Math.min(maxW / stickerImg.width, maxH / stickerImg.height)
    h += 12 + stickerImg.height * s + 12  // my-3 top + sticker + my-3 bottom
  }
  if (data.comments) h += noteLines.length * 16 + 12  // notes + mb-3
  if (data.location) h += 12 + 4                      // location + small gap
  h += 12 + 12   // date/time text + mb-3
  h += 1 + 12    // divider border + mb-3
  h += 12       // footer text-xs
  h += 24       // py-6 bottom padding

  // ── Set final canvas size and redraw ──────────────────────────────────────
  canvas.width = LW * SCALE
  canvas.height = h * SCALE
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.scale(SCALE, SCALE)
  ctx.textBaseline = "top"

  // Background
  ctx.fillStyle = RECEIPT_BG
  roundRect(ctx, 0, 0, LW, h, RECEIPT_RADIUS)
  ctx.fill()

  let y = 24  // start after py-6 top

  // ── Rating circle ─────────────────────────────────────────────────────────
  const cx = LW / 2
  ctx.beginPath()
  ctx.arc(cx, y + ratingR, ratingR, 0, Math.PI * 2)
  ctx.strokeStyle = TEXT_COLOR
  ctx.lineWidth = 2
  ctx.stroke()
  // Center the rating text inside the circle using actual glyph metrics for true visual centering.
  // With textBaseline="alphabetic", fillText draws so the baseline lands at the given y.
  // Circle center is at (cx, y + ratingR).
  // We want: baseline = circleCenterY + ascent - totalGlyphHeight/2
  //        = circleCenterY + ascent - (ascent + descent)/2
  //        = circleCenterY + (ascent - descent) / 2
  ctx.fillStyle = TEXT_COLOR
  ctx.font = "400 18px 'Space Mono', monospace"
  ctx.textAlign = "center"
  ctx.textBaseline = "alphabetic"
  const ratingText = data.rating || "10.0"
  const rMetrics = ctx.measureText(ratingText)
  const rTextY = y + ratingR + (rMetrics.actualBoundingBoxAscent - rMetrics.actualBoundingBoxDescent) / 2
  ctx.fillText(ratingText, cx, rTextY)
  ctx.textBaseline = "top"
  y += ratingDiam + 12  // circle height + mb-3

  // ── Cafe name (text-xs, font-medium, mb-1) ────────────────────────────────
  ctx.font = "500 12px 'Space Mono', monospace"
  ctx.fillStyle = TEXT_COLOR
  ctx.textAlign = "center"
  ctx.fillText(data.cafeName || "cafe", cx, y)
  y += 12 + 12  // font size + mb-3

  // ── Drink name (text-lg, font-medium, mb-2) ───────────────────────────────
  ctx.font = "500 18px 'Space Mono', monospace"
  for (const l of drinkLines) { ctx.fillText(l, cx, y); y += 22 }
  y += 12  // mb-3

  // ── Customizations (text-xs, font-medium, mb-2) ───────────────────────────
  if (customizations.length > 0) {
    ctx.font = "500 12px 'Space Mono', monospace"
    ctx.fillText(customizations.join(", "), cx, y)
    y += 12 + 12  // font + mb-3
  }

  // ── Drink sticker (my-1) ──────────────────────────────────────────────────
  if (stickerImg) {
    const maxW = LW - LP * 2, maxH = 140
    const s = Math.min(maxW / stickerImg.width, maxH / stickerImg.height)
    const sw = stickerImg.width * s, sh = stickerImg.height * s
    y += 12  // my-3 top
    ctx.drawImage(stickerImg, (LW - sw) / 2, y, sw, sh)
    y += sh + 12  // sticker + my-3 bottom
  }

  // ── Notes (text-xs, font-light, mb-2, left-aligned) ──────────────────────
  if (data.comments) {
    ctx.font = "300 12px 'Space Mono', monospace"
    ctx.textAlign = "left"
    for (const l of noteLines) { ctx.fillText(l, LP, y); y += 16 }
    y += 12  // mb-3
  }

  // ── Location (text-xs, font-light) ────────────────────────────────────────
  if (data.location) {
    ctx.font = "300 12px 'Space Mono', monospace"
    ctx.textAlign = "left"
    ctx.fillText(data.location, LP, y)
    y += 12 + 4
  }

  // ── Date/Time (text-xs, font-light, mb-2) ─────────────────────────────────
  const dateStr = data.date ? data.date.replace(/-/g, "") : "YYYYMMDD"
  const timeStr = data.time ? (() => {
    const [hours, minutes] = data.time.split(":")
    const hh = parseInt(hours, 10)
    const ampm = hh >= 12 ? "PM" : "AM"
    const h12 = hh % 12 || 12
    return `${h12}:${minutes} ${ampm}`
  })() : "12:00 AM"
  ctx.font = "300 12px 'Space Mono', monospace"
  ctx.textAlign = "left"
  ctx.fillText(`${dateStr} ${timeStr}`, LP, y)
  y += 12 + 12  // font + mb-3

  // ── Divider (mb-2) ────────────────────────────────────────────────────────
  ctx.strokeStyle = TEXT_COLOR
  ctx.globalAlpha = 0.2
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(LP, y)
  ctx.lineTo(LW - LP, y)
  ctx.stroke()
  ctx.globalAlpha = 1
  y += 1 + 12  // line + mb-3

  // ── Footer ────────────────────────────────────────────────────────────────
  ctx.fillStyle = TEXT_COLOR
  ctx.textAlign = "center"
  ctx.font = "400 12px 'Space Mono', monospace"
  const normW = ctx.measureText("Ranked with ").width
  ctx.font = "500 12px 'Space Mono', monospace"
  const boldW = ctx.measureText("drank").width
  const totalFW = normW + boldW
  ctx.font = "400 12px 'Space Mono', monospace"
  ctx.fillText("Ranked with ", cx - totalFW / 2 + normW / 2, y)
  ctx.font = "500 12px 'Space Mono', monospace"
  ctx.fillText("drank", cx - totalFW / 2 + normW + boldW / 2, y)

  // ── Placed stickers ───────────────────────────────────────────────────────
  ctx.textBaseline = "middle"
  for (const sticker of placedStickers) {
    const sx = (sticker.x / 100) * LW
    const sy = (sticker.y / 100) * h
    ctx.save()
    ctx.translate(sx, sy)
    ctx.rotate((sticker.rotation * Math.PI) / 180)
    ctx.scale(sticker.scale, sticker.scale)
    ctx.font = "600 12px 'Instrument Sans', sans-serif"
    const tw = ctx.measureText(sticker.text).width
    const pillW = tw + 24, pillH = 26, pr = pillH / 2
    ctx.fillStyle = sticker.bg
    ctx.beginPath()
    ctx.moveTo(-pillW / 2 + pr, -pillH / 2)
    ctx.lineTo(pillW / 2 - pr, -pillH / 2)
    ctx.arc(pillW / 2 - pr, 0, pr, -Math.PI / 2, Math.PI / 2)
    ctx.lineTo(-pillW / 2 + pr, pillH / 2)
    ctx.arc(-pillW / 2 + pr, 0, pr, Math.PI / 2, -Math.PI / 2)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = sticker.textColor
    ctx.textAlign = "center"
    ctx.fillText(sticker.text, 0, 0)
    ctx.restore()
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  return canvas.toDataURL("image/png")
}

async function generateStoryCanvas(
  receiptCapture: HTMLCanvasElement,
  placedStickers: PlacedSticker[],
  backgroundImageSrc: string,
  storyPreviewEl: HTMLDivElement | null
): Promise<string | null> {
  const W = 1080
  const H = 1920

  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = H

  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  // ── Background ────────────────────────────────────────────────────────────
  const bgImg = new window.Image()
  bgImg.crossOrigin = "anonymous"
  await new Promise<void>((resolve) => {
    bgImg.onload = () => resolve()
    bgImg.onerror = () => resolve()
    bgImg.src = backgroundImageSrc
  })
  const bgScale = Math.max(W / bgImg.width, H / bgImg.height)
  const bgW = bgImg.width * bgScale, bgH = bgImg.height * bgScale
  ctx.filter = "brightness(0.9)"
  ctx.drawImage(bgImg, (W - bgW) / 2, (H - bgH) / 2, bgW, bgH)
  ctx.filter = "none"

  // ── Receipt capture — composite centered at 70% of story width ────────────
  const exportReceiptW = Math.round(W * 0.70)
  const exportReceiptH = Math.round(receiptCapture.height / receiptCapture.width * exportReceiptW)
  const rX = Math.round((W - exportReceiptW) / 2)
  const rY = Math.round((H - exportReceiptH) / 2)
  ctx.drawImage(receiptCapture, rX, rY, exportReceiptW, exportReceiptH)

  // ── Placed stickers ───────────────────────────────────────────────────────
  const previewW = storyPreviewEl?.getBoundingClientRect().width ?? 220
  const SCALE = W / previewW
  ctx.textBaseline = "middle"
  for (const sticker of placedStickers) {
    const sx = (sticker.x / 100) * W
    const sy = (sticker.y / 100) * H
    ctx.save()
    ctx.translate(sx, sy)
    ctx.rotate((sticker.rotation * Math.PI) / 180)
    ctx.scale(sticker.scale * SCALE, sticker.scale * SCALE)
    ctx.font = "600 12px 'Instrument Sans', sans-serif"
    const tw = ctx.measureText(sticker.text).width
    const pillW = tw + 24, pillH = 28, pr = pillH / 2
    ctx.fillStyle = sticker.bg
    ctx.beginPath()
    ctx.moveTo(-pillW / 2 + pr, -pillH / 2)
    ctx.lineTo(pillW / 2 - pr, -pillH / 2)
    ctx.arc(pillW / 2 - pr, 0, pr, -Math.PI / 2, Math.PI / 2)
    ctx.lineTo(-pillW / 2 + pr, pillH / 2)
    ctx.arc(-pillW / 2 + pr, 0, pr, Math.PI / 2, -Math.PI / 2)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = sticker.textColor
    ctx.textAlign = "center"
    ctx.fillText(sticker.text, 0, 0)
    ctx.restore()
  }

  return canvas.toDataURL("image/png")
}


function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}