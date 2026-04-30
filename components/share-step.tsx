"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { RotateCcw, ArrowLeft, Upload, X, CupSoda } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ReceiptData, StickerItem } from "@/components/decorate-step"
import { removeBackground } from "@imgly/background-removal"
import { ERRORS, pickError } from "@/lib/errors"
import { updateReceipt, resizeImage, getStorageStatus, type StoredSticker } from "@/lib/receipt-store"

/* ============================================================
   Rotating Loading Message
   ============================================================ */

const BG_REMOVAL_MESSAGES = [
  "finding your drink...",
  "cutting out the background...",
  "separating drink from chaos...",
  "this takes a minute, we promise it's worth it",
  "running the magic scissors...",
  "your drink is becoming a sticker",
  "clipping paths, not coupons",
  "hang tight, this part is hard",
  "doing the hard work so you don't have to",
]

const PHOTO_CONVERTING_MESSAGES = [
  "converting your photo...",
  "reading the pixels...",
  "wrangling the file...",
  "almost ready...",
]

function RotatingMessage({ messages, className }: { messages: string[]; className?: string }) {
  const [idx, setIdx] = useState(0)
  const [visible, setVisible] = useState(true)
  // Shuffle order on mount so messages don't always start the same
  const order = useRef<number[]>([])
  if (order.current.length === 0) {
    const arr = messages.map((_, i) => i)
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    order.current = arr
  }
  const posRef = useRef(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        posRef.current = (posRef.current + 1) % order.current.length
        setIdx(order.current[posRef.current])
        setVisible(true)
      }, 250)
    }, 5500)
    return () => clearInterval(interval)
  }, [])

  return (
    <span
      className={cn("transition-opacity duration-[250ms]", visible ? "opacity-100" : "opacity-0", className)}
    >
      {messages[idx]}
    </span>
  )
}

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
    { text: "solid",           bg: "#E3E91B", textColor: "#96003F",     rotation: -4 },
    { text: "good not great",  bg: "#96003F", textColor: "#CADFF4",     rotation:  2 },
  ],
  // Row 2: Mixed → negative
  [
    { text: "so-so",           bg: "#FDE45F", textColor: "#2A2A00",     rotation:  3 },
    { text: "meh",             bg: "#E3E91B", textColor: "#FF7347",     rotation: -3 },
    { text: "kinda mid",       bg: "#FF7347", textColor: "#CADFF4",     rotation:  4 },
    { text: "not for me",      bg: "#96003F", textColor: "#FFE657",     rotation: -2 },
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
  isNew?: boolean // cleared after first render to avoid re-triggering
}

/* ============================================================
   Main Component
   ============================================================ */

interface ShareStepProps {
  data: ReceiptData
  image: string | null
  stickers: StickerItem[]
  receiptId: string
  onReset: () => void
  onBack: () => void
  onImageUpload: (image: string, exifDate?: string) => void
  /** Restored from history edit — pre-populate share step state */
  initialReceiptStickers?: StoredSticker[]
  initialStoryStickers?: StoredSticker[]
  initialShowDrinkSticker?: boolean
  initialBgRemovedImage?: string
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
const RECEIPT_BG = "rgba(254,252,244,0.9)"
const RECEIPT_RADIUS = 8
const TEXT_COLOR = "#473C23"

export function ShareStep({
  data,
  image,
  receiptId,
  onReset,
  onBack,
  onImageUpload,
  initialReceiptStickers,
  initialStoryStickers,
  initialShowDrinkSticker,
  initialBgRemovedImage,
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
  const [showDrinkSticker, setShowDrinkSticker] = useState(initialShowDrinkSticker ?? false)
  const [bgRemovedImage, setBgRemovedImage] = useState<string | null>(initialBgRemovedImage ?? null)
  const [isBgProcessing, setIsBgProcessing] = useState(false)
  const [bgError, setBgError] = useState<string | null>(null)
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null)
  const [showSelectionModal, setShowSelectionModal] = useState(false)
  // If restoring from edit with an existing bg-removed image, treat it as already selected
  const [hasEverSelected, setHasEverSelected] = useState(!!(initialBgRemovedImage))

  const [activeTab, setActiveTab] = useState<"story" | "receipt">(image ? "story" : "receipt")
  const [hasSaved, setHasSaved] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastVariant, setToastVariant] = useState<"success" | "error">("success")
  const [showStorageInfo, setShowStorageInfo] = useState(false)

  // Separate sticker arrays for each canvas — restored from edit if available
  const [receiptStickers, setReceiptStickers] = useState<PlacedSticker[]>(
    () => (initialReceiptStickers ?? []) as PlacedSticker[]
  )
  const [storyStickers, setStoryStickers] = useState<PlacedSticker[]>(
    () => (initialStoryStickers ?? []) as PlacedSticker[]
  )
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

        // Add 2% padding in image pixels on each side
        const padPx = Math.max(imgW2, imgH2) * 0.02
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

  const handleSave = useCallback(async () => {
    const url = activeTab === "story" ? storyUrl : receiptUrl
    if (!url) return

    const isFirstSave = !hasSaved

    // Check storage before attempting — warn if near capacity
    const storageStatus = getStorageStatus()
    let savedToHistory = true

    if (storageStatus.level === "critical") {
      // Don't even attempt — it will fail
      savedToHistory = false
    } else {
      // Try to save; catch quota errors
      try {
        const priority = showDrinkSticker ? 1 : 0
        updateReceipt(receiptId, {
          receiptStickers,
          storyStickers,
          showDrinkSticker,
          savedCanvasDataUrl: receiptUrl ?? url,
          savedCanvasPriority: priority,
          ...(bgRemovedImage ? { bgRemovedImageDataUrl: bgRemovedImage } : {}),
        })
        setHasSaved(true)
      } catch {
        savedToHistory = false
      }
    }

    if (savedToHistory) {
      const msg = isFirstSave ? "Saved to drank history" : "Drank history updated"
      setToastVariant("success")
      setToastMessage(msg)
    } else {
      // Storage full — show error toast but still allow download/share
      const errorMessages = [
        "not enough storage to save to history",
        "delete old receipts to save to history",
      ]
      setToastVariant("error")
      setToastMessage(errorMessages[Math.floor(Math.random() * errorMessages.length)])
    }
    setShowStorageInfo(false)
    setTimeout(() => { setToastMessage(null); setShowStorageInfo(false) }, 5000)

    const drinkSlug = data.drinkName?.replace(/\s+/g, "-").toLowerCase() || "receipt"
    const filename = activeTab === "story"
      ? `drank-${drinkSlug}-story.png`
      : `drank-${drinkSlug}.png`

    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

    if (isMobile) {
      try {
        const res = await fetch(url)
        const blob = await res.blob()
        const file = new File([blob], filename, { type: "image/png" })
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file] })
          return
        }
      } catch {
        // fall through to link download
      }
    }

    const link = document.createElement("a")
    link.download = filename
    link.href = url
    link.click()
  }, [activeTab, storyUrl, receiptUrl, hasSaved, receiptId, receiptStickers, storyStickers, showDrinkSticker, bgRemovedImage, data.drinkName])
  
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
      setActiveTab("story")

      // Persist the newly uploaded image to the store so it survives edit/reload
      Promise.all([
        resizeImage(dataUrl, 800, 0.82),
        resizeImage(dataUrl, 400, 0.82),
      ]).then(([imageDataUrl, thumbnailDataUrl]) => {
        updateReceipt(receiptId, { imageDataUrl, thumbnailDataUrl })
      }).catch(() => { /* non-critical */ })
    },
    [onImageUpload, receiptId]
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
      isNew: true,
    }
    setActiveStickers((prev) => [...prev, newSticker])
    setSelectedStickerId(newSticker.id)
    // Clear isNew after animation completes so it doesn't retrigger on re-render
    setTimeout(() => {
      setActiveStickers((prev) =>
        prev.map((s) => s.id === newSticker.id ? { ...s, isNew: false } : s)
      )
    }, 350)
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
          <div className="size-4 shrink-0 animate-spin rounded-full border-2 border-muted border-t-foreground" />
          <RotatingMessage messages={PHOTO_CONVERTING_MESSAGES} className="font-sans text-sm text-muted-foreground" />
        </span>
      ) : isBgProcessing ? (
        <span className="flex items-center gap-1.5 font-sans text-sm text-muted-foreground">
          <div className="size-4 shrink-0 animate-spin rounded-full border-2 border-muted border-t-foreground" />
          <RotatingMessage messages={BG_REMOVAL_MESSAGES} className="font-sans text-sm text-muted-foreground" />
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
            <span className="flex items-center gap-1 font-sans text-sm text-pink-dark">
              Drink Sticker
              <CupSoda className="size-3.5" />
            </span>
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
        {canShowStory ? "Story" : "No Photo"}
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
      {/* Toast notification */}
      {toastMessage && (
        <div
          className={cn(
            "fixed left-4 top-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col gap-1.5 rounded-lg px-4 py-2.5 shadow-lg transition-opacity",
            toastVariant === "error"
              ? "bg-red-50 border border-red-200"
              : "bg-green-light"
          )}
          style={{ animation: "drank-toast-in 0.2s ease-out, drank-toast-out 0.4s ease-in 4.6s forwards" }}
        >
          <div className="flex items-center gap-2">
            {toastVariant === "success" ? (
              <a
                href="/history"
                className="flex items-center gap-2 hover:opacity-80"
                style={{ textDecoration: "none" }}
              >
                <p className="font-mono text-xs text-green-dark">{toastMessage}</p>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 text-green-dark opacity-60">
                  <path d="M2.5 6h7M6.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            ) : (
              <>
                <p className="font-mono text-xs text-red-600">{toastMessage}</p>
                <button
                  onClick={() => setShowStorageInfo((v) => !v)}
                  className="flex size-4 shrink-0 items-center justify-center rounded-full border border-red-300 font-mono text-[10px] text-red-400 transition-colors hover:border-red-400 hover:text-red-500"
                  aria-label="More info"
                >
                  i
                </button>
              </>
            )}
          </div>
          {toastVariant === "error" && showStorageInfo && (
            <p className="font-sans text-[11px] leading-snug text-red-500">
              thanks for trying drank! your storage limit is being reached (but i&apos;m working on increasing this). you can still save receipts to your device.
            </p>
          )}
        </div>
      )}

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
                onClick={handleSave}
                disabled={isGenerating || (activeTab === "story" && !storyUrl)}
              >
                {activeTab === "story" ? "Save Story" : "Save Receipt"}
              </Button>
            </div>

            {/* Mobile-only: drink sticker control — pt-4 keeps it off the canvas above */}
            <div className="mb-2 flex justify-center pt-4 md:hidden">
              {DrinkStickerControl}
            </div>
          </div>

          {/* Right column: Controls */}
          <div className="flex flex-col gap-4 pb-28 md:min-h-0 md:flex-1 md:overflow-hidden md:pb-6">
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

              {/* Rank Another — mobile only, between toggle and sticker panel */}
              <div className="flex justify-center md:hidden">
                <button
                  onClick={onReset}
                  className="flex items-center gap-2 font-sans text-sm text-pink-dark transition-colors hover:opacity-70"
                >
                  <RotateCcw className="size-4" />
                  Rank Another
                </button>
              </div>

              {/* Stickers panel - single responsive wrapping group */}
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="mb-3 text-center font-sans text-xs text-muted-foreground">
                  select a sticker to place it on your {activeTab === "story" ? "story" : "receipt"}
                </p>
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

      {/* Mobile fixed bottom bar — Save only */}
      <div className="fixed inset-x-0 bottom-0 z-20 p-4 md:hidden">
        <Button
          size="lg"
          className="w-full bg-brown px-8 font-sans text-sm text-white hover:bg-brown/90"
          style={{ paddingTop: 24, paddingBottom: 24 }}
          onClick={handleSave}
          disabled={isGenerating || (activeTab === "story" && !storyUrl)}
        >
          {activeTab === "story" ? "Save Story" : "Save Receipt"}
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

/* ============================================================
   Snap line types
   ============================================================ */

interface SnapLine {
  id: string
  axis: "x" | "y"
  pct: number // 0-100 percentage position along the perpendicular axis
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
  const storyReceiptImgRef = useRef<HTMLImageElement | null>(null)
  const [activeSnapLineIds, setActiveSnapLineIds] = useState<string[]>([])

  const customizations: string[] = []
  if (data.iceTemp) customizations.push(toTitleCase(data.iceTemp))
  if (data.iceLevel) customizations.push(`${toTitleCase(data.iceLevel)} Ice`)
  if (data.sugarLevel) customizations.push(`${toTitleCase(data.sugarLevel)} Sugar`)
  const milkDisplay = data.milk === "other" && data.otherMilk ? data.otherMilk : data.milk
  if (milkDisplay) customizations.push(`${toTitleCase(milkDisplay)} Milk`)
  if (data.toppings.length > 0) customizations.push(...data.toppings.map(toTitleCase))
  if (data.otherCustomizations) customizations.push(toTitleCase(data.otherCustomizations))

  const formatDateLocal = (dateStr: string) => {
    if (!dateStr) return "YYYYMMDD"
    return dateStr.replace(/-/g, "")
  }

  const formatTimeLocal = (timeStr: string) => {
    if (!timeStr) return "12:00 AM"
    const [hours, minutes] = timeStr.split(":")
    const h = parseInt(hours, 10)
    const ampm = h >= 12 ? "PM" : "AM"
    const h12 = h % 12 || 12
    return `${h12}:${minutes} ${ampm}`
  }

  const handleContainerClick = (e: React.MouseEvent) => {
    onCanvasClick()
  }

  // Compute the static snap lines for this canvas mode.
  // Called at render time — reads refs so always reflects current layout.
  const getStaticSnapLines = (): SnapLine[] => {
    const lines: SnapLine[] = [
      { id: "cx", axis: "x", pct: 50 },
      { id: "cy", axis: "y", pct: 50 },
    ]

    if (mode === "story" && storyReceiptImgRef.current && containerRef.current) {
      const cRect = containerRef.current.getBoundingClientRect()
      const rRect = storyReceiptImgRef.current.getBoundingClientRect()
      if (cRect.width > 0 && cRect.height > 0) {
        const left   = ((rRect.left   - cRect.left)  / cRect.width)  * 100
        const right  = ((rRect.right  - cRect.left)  / cRect.width)  * 100
        const top    = ((rRect.top    - cRect.top)    / cRect.height) * 100
        const bottom = ((rRect.bottom - cRect.top)    / cRect.height) * 100
        lines.push(
          { id: "r-left",   axis: "x", pct: left             },
          { id: "r-right",  axis: "x", pct: right            },
          { id: "r-top",    axis: "y", pct: top              },
          { id: "r-bottom", axis: "y", pct: bottom           },
          { id: "r-cx",     axis: "x", pct: (left + right)/2 },
          { id: "r-cy",     axis: "y", pct: (top + bottom)/2 },
        )
      }
    }

    return lines
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

        {/* Receipt overlay — screenshot of the real receipt, scaled to fit, 90% opacity */}
        {storyReceiptUrl && (
          <img
            ref={storyReceiptImgRef}
            src={storyReceiptUrl}
            alt="receipt"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ width: "70%", display: "block", borderRadius: 4, opacity: 0.9 }}
            draggable={false}
          />
        )}

        {/* Snap guidelines — only render lines that are currently active */}
        {activeSnapLineIds.map((id) => {
          // Resolve line definition: static center lines or other-sticker lines
          const allStatic = getStaticSnapLines()
          const allOther = placedStickers
            .filter(s => s.id !== selectedStickerId)
            .flatMap(s => ([
              { id: `s-${s.id}-cx`, axis: "x" as const, pct: s.x },
              { id: `s-${s.id}-cy`, axis: "y" as const, pct: s.y },
            ]))
          const line = [...allStatic, ...allOther].find(l => l.id === id)
          if (!line) return null
          return line.axis === "x" ? (
            <div key={id} className="pointer-events-none absolute inset-y-0" style={{ left: `${line.pct}%`, width: 1, backgroundColor: "rgba(155,207,236,0.85)", zIndex: 40 }} />
          ) : (
            <div key={id} className="pointer-events-none absolute inset-x-0" style={{ top: `${line.pct}%`, height: 1, backgroundColor: "rgba(155,207,236,0.85)", zIndex: 40 }} />
          )
        })}

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
            otherStickers={placedStickers.filter(s => s.id !== sticker.id)}
            getStaticSnapLines={getStaticSnapLines}
            onSnapChange={setActiveSnapLineIds}
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
        className="relative w-[280px] rounded-sm px-5 py-6 overflow-hidden"
        style={{ backgroundColor: "rgba(254,252,244,0.9)", fontFamily: "'IBM Plex Mono', monospace", boxShadow: "0 4px 32px rgba(0,0,0,0.08)" }}

      >
        <ReceiptContent
          data={data}
          stickerImage={stickerImage}
          isProcessing={isProcessing}
          customizations={customizations}
          formatDate={formatDateLocal}
          formatTime={formatTimeLocal}
        />

        {/* Snap guidelines — only render lines that are currently active */}
        {activeSnapLineIds.map((id) => {
          const allOther = placedStickers
            .filter(s => s.id !== selectedStickerId)
            .flatMap(s => ([
              { id: `s-${s.id}-cx`, axis: "x" as const, pct: s.x },
              { id: `s-${s.id}-cy`, axis: "y" as const, pct: s.y },
            ]))
          const staticR = getStaticSnapLines()
          const line = [...staticR, ...allOther].find(l => l.id === id)
          if (!line) return null
          return line.axis === "x" ? (
            <div key={id} className="pointer-events-none absolute inset-y-0" style={{ left: `${line.pct}%`, width: 1, backgroundColor: "rgba(155,207,236,0.7)", zIndex: 40 }} />
          ) : (
            <div key={id} className="pointer-events-none absolute inset-x-0" style={{ top: `${line.pct}%`, height: 1, backgroundColor: "rgba(155,207,236,0.7)", zIndex: 40 }} />
          )
        })}

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
            otherStickers={placedStickers.filter(s => s.id !== sticker.id)}
            getStaticSnapLines={getStaticSnapLines}
            onSnapChange={setActiveSnapLineIds}
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
  const textSize = small ? "text-[8px]" : "text-xs"        // café, notes, location, date, footer
  const customSize = small ? "text-[8px]" : "text-sm"      // customizations
  const titleSize = small ? "text-sm" : "text-2xl"          // drink name
  const ratingSize = small ? "size-10 text-sm" : "size-14 text-lg"

  const IBM_PLEX_MONO: React.CSSProperties = { fontFamily: "'IBM Plex Mono', monospace" }

  return (
    <>
      {/* Rating circle */}
      <div className={cn("mb-3 flex justify-center", small && "mb-1")}>
        <div
          className={cn("flex items-center justify-center rounded-full border-2", ratingSize)}
          style={{ borderColor: TEXT_COLOR }}
        >
          <span className="font-normal" style={{ ...IBM_PLEX_MONO, color: TEXT_COLOR }}>
            {data.rating || "10.0"}
          </span>
        </div>
      </div>

      {/* Cafe name */}
      <p
        className={cn("mb-3 break-words text-center font-medium", textSize)}
        style={{ ...IBM_PLEX_MONO, color: TEXT_COLOR }}
      >
        {data.cafeName || "cafe"}
      </p>

      {/* Drink name */}
      <h3
        className={cn("mb-3 break-words text-center font-medium leading-tight", titleSize)}
        style={{ ...IBM_PLEX_MONO, color: TEXT_COLOR }}
      >
        {data.drinkName || "Beverage"}
      </h3>

      {/* Customizations */}
      {customizations.length > 0 && (
        <p
          className={cn("mb-3 break-words text-center font-medium", customSize)}
          style={{ ...IBM_PLEX_MONO, color: TEXT_COLOR }}
        >
          {customizations.join(", ")}
        </p>
      )}

      {/* Drink sticker */}
      {isProcessing ? (
        <div className="my-3 flex justify-center">
          <div className="flex flex-col items-center gap-1">
            <div className="size-6 animate-spin rounded-full border-2 border-muted border-t-foreground" />
            <RotatingMessage messages={BG_REMOVAL_MESSAGES} className="w-[120px] text-center text-[8px] text-muted-foreground" />
          </div>
        </div>
      ) : stickerImage ? (
        <div className="mb-1 flex justify-center">
          <img
            src={stickerImage}
            alt="Drink sticker"
            className={cn("object-contain", small ? "max-h-[80px] max-w-[110px]" : "max-h-[140px] max-w-full")}
          />
        </div>
      ) : null}

      {/* Notes */}
      {data.comments && (
        <p className={cn("mb-3 break-words font-light", textSize)} style={{ ...IBM_PLEX_MONO, color: TEXT_COLOR }}>
          Notes: {data.comments}
        </p>
      )}

      {/* Location */}
      {data.location && (
        <p className={cn("break-words font-light", textSize)} style={{ ...IBM_PLEX_MONO, color: TEXT_COLOR }}>
          {data.location}
        </p>
      )}

      {/* Date/Time */}
      <p className={cn("mb-3 font-light", textSize)} style={{ ...IBM_PLEX_MONO, color: TEXT_COLOR }}>
        {formatDate(data.date)} {formatTime(data.time)}
      </p>

      {/* Divider */}
      <div className="mb-3 border-t" style={{ borderColor: TEXT_COLOR, opacity: 0.2 }} />

      {/* Footer */}
      <p className={cn("text-center font-normal", textSize)} style={{ ...IBM_PLEX_MONO, color: TEXT_COLOR }}>
        Ranked with <span className="font-medium" style={IBM_PLEX_MONO}>drank</span>
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
  otherStickers = [],
  getStaticSnapLines = () => [{ id: "cx", axis: "x" as const, pct: 50 }, { id: "cy", axis: "y" as const, pct: 50 }],
  onSnapChange,
}: {
  sticker: PlacedSticker
  isSelected: boolean
  onSelect: () => void
  onUpdate: (updates: Partial<PlacedSticker>) => void
  onDelete: () => void
  containerRef: React.RefObject<HTMLDivElement | null>
  otherStickers?: PlacedSticker[]
  getStaticSnapLines?: () => SnapLine[]
  onSnapChange?: (ids: string[]) => void
}) {
  const stickerRef = useRef<HTMLDivElement>(null)

  // Refs for snap data — read at drag-move time so always fresh (no stale closures)
  const getStaticSnapLinesRef = useRef(getStaticSnapLines)
  const otherStickersRef = useRef(otherStickers)
  const onSnapChangeRef = useRef(onSnapChange)
  useEffect(() => { getStaticSnapLinesRef.current = getStaticSnapLines })
  useEffect(() => { otherStickersRef.current = otherStickers })
  useEffect(() => { onSnapChangeRef.current = onSnapChange })

  const dragStartRef = useRef<{
    clientX: number
    clientY: number
    startX: number
    startY: number
  } | null>(null)

  // Resize state
  const resizeStartRef = useRef<{
    clientX: number
    clientY: number
    startScale: number
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)

  // Rotate state
  const rotateStartRef = useRef<{
    originX: number
    originY: number
    startAngle: number
    startRotation: number
  } | null>(null)

  // Pinch-to-zoom state
  const pinchStartRef = useRef<{
    startDist: number
    startScale: number
    startAngle: number
    startRotation: number
  } | null>(null)

  const getContainerBounds = () => containerRef.current?.getBoundingClientRect() ?? null

  const getClient = (e: MouseEvent | TouchEvent) => {
    if ("touches" in e && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY }
    if ("clientX" in e) return { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY }
    return { x: 0, y: 0 }
  }

  // ── Drag (with pinch-to-zoom+rotate on two-finger touch) ──────────────────

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    onSelect()
    // Two-finger touch → start pinch, not drag
    if ("touches" in e && e.touches.length === 2) {
      const dx = e.touches[1].clientX - e.touches[0].clientX
      const dy = e.touches[1].clientY - e.touches[0].clientY
      pinchStartRef.current = {
        startDist: Math.hypot(dx, dy),
        startScale: sticker.scale,
        startAngle: Math.atan2(dy, dx) * (180 / Math.PI),
        startRotation: sticker.rotation,
      }
      dragStartRef.current = null
      return
    }
    const client = "touches" in e
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
      : { x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY }
    dragStartRef.current = { clientX: client.x, clientY: client.y, startX: sticker.x, startY: sticker.y }
  }

  // Catch second finger arriving after drag has already started
  useEffect(() => {
    const handleSecondTouch = (e: TouchEvent) => {
      if (e.touches.length === 2 && dragStartRef.current) {
        dragStartRef.current = null
        const dx = e.touches[1].clientX - e.touches[0].clientX
        const dy = e.touches[1].clientY - e.touches[0].clientY
        pinchStartRef.current = {
          startDist: Math.hypot(dx, dy),
          startScale: sticker.scale,
          startAngle: Math.atan2(dy, dx) * (180 / Math.PI),
          startRotation: sticker.rotation,
        }
      }
    }
    document.addEventListener("touchstart", handleSecondTouch)
    return () => document.removeEventListener("touchstart", handleSecondTouch)
  }, [sticker.scale, sticker.rotation])

  useEffect(() => {
    const SNAP_THRESH = 3.5 // percentage points within which snap activates

    const handleMove = (e: MouseEvent | TouchEvent) => {
      // Pinch move (two fingers) — update scale and rotation simultaneously
      if ("touches" in e && e.touches.length === 2 && pinchStartRef.current) {
        const dx = e.touches[1].clientX - e.touches[0].clientX
        const dy = e.touches[1].clientY - e.touches[0].clientY
        const dist = Math.hypot(dx, dy)
        if (pinchStartRef.current.startDist < 1) return
        const newScale = Math.max(0.3, Math.min(4, pinchStartRef.current.startScale * (dist / pinchStartRef.current.startDist)))
        const currentAngle = Math.atan2(dy, dx) * (180 / Math.PI)
        const rawRotation = pinchStartRef.current.startRotation + (currentAngle - pinchStartRef.current.startAngle)
        // Snap rotation to 0°
        const norm = ((rawRotation % 360) + 360) % 360
        const nearZero = norm <= 5 || norm >= 355
        onUpdate({ scale: newScale, rotation: nearZero ? 0 : rawRotation })
        return
      }
      if (!dragStartRef.current) return
      const bounds = getContainerBounds()
      if (!bounds) return
      const { x, y } = getClient(e)
      const rawDx = ((x - dragStartRef.current.clientX) / bounds.width) * 100
      const rawDy = ((y - dragStartRef.current.clientY) / bounds.height) * 100
      let newX = Math.max(0, Math.min(100, dragStartRef.current.startX + rawDx))
      let newY = Math.max(0, Math.min(100, dragStartRef.current.startY + rawDy))

      // Build all snap targets — call getter at move time so rect values are always fresh
      const allLines: SnapLine[] = [
        ...getStaticSnapLinesRef.current(),
        ...otherStickersRef.current.flatMap(s => ([
          { id: `s-${s.id}-cx`, axis: "x" as const, pct: s.x },
          { id: `s-${s.id}-cy`, axis: "y" as const, pct: s.y },
        ])),
      ]

      const snappedIds: string[] = []
      for (const line of allLines) {
        if (line.axis === "x" && Math.abs(newX - line.pct) < SNAP_THRESH) {
          newX = line.pct
          snappedIds.push(line.id)
        }
        if (line.axis === "y" && Math.abs(newY - line.pct) < SNAP_THRESH) {
          newY = line.pct
          snappedIds.push(line.id)
        }
      }

      onSnapChangeRef.current?.(snappedIds)
      onUpdate({ x: newX, y: newY })
    }
    const handleUp = (e: MouseEvent | TouchEvent) => {
      if ("touches" in e && e.touches.length < 2) pinchStartRef.current = null
      dragStartRef.current = null
      onSnapChangeRef.current?.([])
    }
    document.addEventListener("mousemove", handleMove)
    document.addEventListener("mouseup", handleUp)
    document.addEventListener("touchmove", handleMove, { passive: false })
    document.addEventListener("touchend", handleUp)
    return () => {
      document.removeEventListener("mousemove", handleMove)
      document.removeEventListener("mouseup", handleUp)
      document.removeEventListener("touchmove", handleMove)
      document.removeEventListener("touchend", handleUp)
    }
  }, [sticker.x, sticker.y, sticker.scale, sticker.rotation])

  // ── Resize ────────────────────────────────────────────────────────────────

  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const client = "touches" in e
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
      : { x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY }
    const bounds = getContainerBounds()
    if (!bounds) return
    const originX = bounds.left + (sticker.x / 100) * bounds.width
    const originY = bounds.top + (sticker.y / 100) * bounds.height
    resizeStartRef.current = {
      clientX: client.x,
      clientY: client.y,
      startScale: sticker.scale,
      startX: sticker.x,
      startY: sticker.y,
      originX,
      originY,
    }
  }

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!resizeStartRef.current) return
      const { x, y } = getClient(e)
      const { originX, originY, clientX, clientY, startScale } = resizeStartRef.current
      const startDist = Math.hypot(clientX - originX, clientY - originY)
      const currDist = Math.hypot(x - originX, y - originY)
      if (startDist < 1) return
      const newScale = Math.max(0.3, Math.min(4, startScale * (currDist / startDist)))
      onUpdate({ scale: newScale })
    }
    const handleUp = () => { resizeStartRef.current = null }
    document.addEventListener("mousemove", handleMove)
    document.addEventListener("mouseup", handleUp)
    document.addEventListener("touchmove", handleMove, { passive: true })
    document.addEventListener("touchend", handleUp)
    return () => {
      document.removeEventListener("mousemove", handleMove)
      document.removeEventListener("mouseup", handleUp)
      document.removeEventListener("touchmove", handleMove)
      document.removeEventListener("touchend", handleUp)
    }
  }, [])  // empty deps: handler reads resizeStartRef which is always current

  // ── Rotate ────────────────────────────────────────────────────────────────

  const handleRotateStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const client = "touches" in e
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
      : { x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY }
    const bounds = getContainerBounds()
    if (!bounds) return
    const originX = bounds.left + (sticker.x / 100) * bounds.width
    const originY = bounds.top + (sticker.y / 100) * bounds.height
    const startAngle = Math.atan2(client.y - originY, client.x - originX) * (180 / Math.PI)
    rotateStartRef.current = { originX, originY, startAngle, startRotation: sticker.rotation }
  }

  useEffect(() => {
    const ROTATION_SNAP_DEG = 5 // degrees within which rotation snaps to 0
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!rotateStartRef.current) return
      const { x, y } = getClient(e)
      const { originX, originY, startAngle, startRotation } = rotateStartRef.current
      const angle = Math.atan2(y - originY, x - originX) * (180 / Math.PI)
      const rawRotation = startRotation + (angle - startAngle)
      // Normalize to -180..180 for snap check
      const norm = ((rawRotation % 360) + 360) % 360
      const nearZero = norm <= ROTATION_SNAP_DEG || norm >= (360 - ROTATION_SNAP_DEG)
      onUpdate({ rotation: nearZero ? 0 : rawRotation })
    }
    const handleUp = () => { rotateStartRef.current = null }
    document.addEventListener("mousemove", handleMove)
    document.addEventListener("mouseup", handleUp)
    document.addEventListener("touchmove", handleMove, { passive: true })
    document.addEventListener("touchend", handleUp)
    return () => {
      document.removeEventListener("mousemove", handleMove)
      document.removeEventListener("mouseup", handleUp)
      document.removeEventListener("touchmove", handleMove)
      document.removeEventListener("touchend", handleUp)
    }
  }, [sticker.rotation])

  // Pill dimensions (approximate — matches canvas drawing)
  const PILL_H = 26
  const PILL_W_APPROX = sticker.text.length * 7 + 24

  // Scaled pill half-dimensions — used to position controls relative to pill edge
  const halfW = (PILL_W_APPROX * sticker.scale) / 2
  const halfH = (PILL_H * sticker.scale) / 2

  // Selection box padding beyond the pill edge
  const PAD = 6

  return (
    <>
      {/* ── Scaled pill (drag target) ───────────────────────────────────────── */}
      <div
        ref={stickerRef}
        className="absolute"
        style={{
          left: `${sticker.x}%`,
          top: `${sticker.y}%`,
          // Positioning + rotation only — scale lives on inner scaler div
          transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg)`,
          transformOrigin: "center center",
          userSelect: "none",
          touchAction: "none",
          zIndex: isSelected ? 20 : 10,
        }}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scale wrapper — animation owns transform when isNew, inline style takes over after */}
        <div
          style={{
            // When isNew: animation drives scale (inline transform must be absent so keyframe wins)
            // After isNew: inline transform sets the current scale
            transform: sticker.isNew ? undefined : `scale(${sticker.scale})`,
            transformOrigin: "center center",
            animation: sticker.isNew
              ? `drank-sticker-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards`
              : undefined,
            // CSS var lets the keyframe know the target scale to land on
            ["--sticker-scale" as string]: sticker.scale,
          }}
        >
          <div
            className="flex items-center justify-center rounded-full px-3 font-sans text-xs font-semibold"
            style={{
              backgroundColor: sticker.bg,
              color: sticker.textColor,
              height: PILL_H,
              whiteSpace: "nowrap",
              cursor: "grab",
            }}
          >
            {sticker.text}
          </div>
        </div>
      </div>

      {/* ── Unscaled controls overlay (always fixed size, rotated to match pill) */}
      {isSelected && (
        <div
          className="absolute"
          style={{
            left: `${sticker.x}%`,
            top: `${sticker.y}%`,
            transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg)`,
            transformOrigin: "center center",
            pointerEvents: "none",
            zIndex: 25,
          }}
        >
          {/* Dashed selection box */}
          <div
            style={{
              position: "absolute",
              left: -(halfW + PAD),
              top: -(halfH + PAD),
              width: halfW * 2 + PAD * 2,
              height: halfH * 2 + PAD * 2,
              border: "2px dashed rgba(203,68,106,0.8)",
              borderRadius: 4,
              pointerEvents: "none",
            }}
          />

          {/* X (delete) — top-right corner, counter-rotated to stay upright */}
          <button
            onMouseDown={(e) => { e.stopPropagation(); onDelete() }}
            onTouchStart={(e) => { e.stopPropagation(); onDelete() }}
            onClick={(e) => e.stopPropagation()}
            className="absolute flex items-center justify-center rounded-full bg-pink-dark text-white"
            style={{
              width: 20,
              height: 20,
              top: -(halfH + PAD + 10),
              right: -(halfW + PAD + 10),
              transform: `rotate(${-sticker.rotation}deg)`,
              transformOrigin: "center center",
              zIndex: 30,
              cursor: "pointer",
              touchAction: "none",
              pointerEvents: "auto",
            }}
          >
            <X className="size-3" />
          </button>

          {/* Rotation handle — above center */}
          <div
            className="absolute left-1/2 -translate-x-1/2 flex"
            style={{ top: -(halfH + PAD + 28), flexDirection: "column", alignItems: "center", gap: 0, pointerEvents: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              onMouseDown={handleRotateStart}
              onTouchStart={handleRotateStart}
              className="flex items-center justify-center rounded-full bg-pink-dark"
              style={{ width: 14, height: 14, cursor: "grab", touchAction: "none", zIndex: 30 }}
            />
            <div style={{ width: 1, height: 16, backgroundColor: "rgba(203,68,106,0.5)" }} />
          </div>

          {/* Resize handle — top-left (desktop only) */}
          <div
            onMouseDown={handleResizeStart}
            onTouchStart={handleResizeStart}
            onClick={(e) => e.stopPropagation()}
            className="absolute rounded-sm bg-pink-dark block"
            style={{
              width: 12, height: 12,
              top: -(halfH + PAD + 6),
              left: -(halfW + PAD + 6),
              cursor: "nw-resize",
              touchAction: "none",
              zIndex: 30,
              pointerEvents: "auto",
            }}
          />

          {/* Resize handle — bottom-left (desktop only) */}
          <div
            onMouseDown={handleResizeStart}
            onTouchStart={handleResizeStart}
            onClick={(e) => e.stopPropagation()}
            className="absolute rounded-sm bg-pink-dark block"
            style={{
              width: 12, height: 12,
              bottom: -(halfH + PAD + 6),
              left: -(halfW + PAD + 6),
              cursor: "sw-resize",
              touchAction: "none",
              zIndex: 30,
              pointerEvents: "auto",
            }}
          />

          {/* Resize handle — bottom-right (desktop only) */}
          <div
            onMouseDown={handleResizeStart}
            onTouchStart={handleResizeStart}
            onClick={(e) => e.stopPropagation()}
            className="absolute rounded-sm bg-pink-dark block"
            style={{
              width: 12, height: 12,
              bottom: -(halfH + PAD + 6),
              right: -(halfW + PAD + 6),
              cursor: "se-resize",
              touchAction: "none",
              zIndex: 30,
              pointerEvents: "auto",
            }}
          />
        </div>
      )}
    </>
  )
}

/* ============================================================
   Save Image Modal (mobile)
   ============================================================ */

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

  // Minimum box size in percent of container to prevent it from disappearing
  const MIN_SIZE = 10

  // Default box: centered 50×50%
  const defaultRect: SelectionRect = initialRect ?? { x: 25, y: 25, width: 50, height: 50 }
  const [rect, setRect] = useState<SelectionRect>(defaultRect)

  // What the user is dragging: "move" | "nw"|"ne"|"sw"|"se" corner
  type DragMode = "move" | "nw" | "ne" | "sw" | "se" | null
  const dragModeRef = useRef<DragMode>(null)
  const dragStartRef = useRef<{
    clientX: number; clientY: number
    rect: SelectionRect
  } | null>(null)

  const getClient = (e: MouseEvent | TouchEvent) => {
    if ("touches" in e && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY }
    if ("clientX" in e) return { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY }
    return { x: 0, y: 0 }
  }

  const startDrag = useCallback((mode: DragMode, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const client = "touches" in e
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
      : { x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY }
    dragModeRef.current = mode
    dragStartRef.current = { clientX: client.x, clientY: client.y, rect: { ...rect } }
  }, [rect])

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!dragModeRef.current || !dragStartRef.current || !containerRef.current) return
      e.preventDefault()

      const bounds = containerRef.current.getBoundingClientRect()
      const { x: cx, y: cy } = getClient(e)
      const dx = ((cx - dragStartRef.current.clientX) / bounds.width) * 100
      const dy = ((cy - dragStartRef.current.clientY) / bounds.height) * 100
      const r = dragStartRef.current.rect

      let { x, y, width, height } = r

      if (dragModeRef.current === "move") {
        x = Math.max(0, Math.min(100 - width, r.x + dx))
        y = Math.max(0, Math.min(100 - height, r.y + dy))
      } else {
        let x2 = r.x + r.width
        let y2 = r.y + r.height

        if (dragModeRef.current === "nw") {
          x = Math.min(x2 - MIN_SIZE, Math.max(0, r.x + dx))
          y = Math.min(y2 - MIN_SIZE, Math.max(0, r.y + dy))
          width = x2 - x
          height = y2 - y
        } else if (dragModeRef.current === "ne") {
          y = Math.min(y2 - MIN_SIZE, Math.max(0, r.y + dy))
          width = Math.max(MIN_SIZE, Math.min(100 - r.x, r.width + dx))
          height = y2 - y
        } else if (dragModeRef.current === "sw") {
          x = Math.min(x2 - MIN_SIZE, Math.max(0, r.x + dx))
          width = x2 - x
          height = Math.max(MIN_SIZE, Math.min(100 - r.y, r.height + dy))
        } else if (dragModeRef.current === "se") {
          width = Math.max(MIN_SIZE, Math.min(100 - r.x, r.width + dx))
          height = Math.max(MIN_SIZE, Math.min(100 - r.y, r.height + dy))
        }
      }

      setRect({ x, y, width, height })
    }

    const handleUp = () => {
      dragModeRef.current = null
      dragStartRef.current = null
    }

    document.addEventListener("mousemove", handleMove)
    document.addEventListener("mouseup", handleUp)
    document.addEventListener("touchmove", handleMove, { passive: false })
    document.addEventListener("touchend", handleUp)
    return () => {
      document.removeEventListener("mousemove", handleMove)
      document.removeEventListener("mouseup", handleUp)
      document.removeEventListener("touchmove", handleMove)
      document.removeEventListener("touchend", handleUp)
    }
  }, [])

  const handleConfirm = () => {
    if (!containerRef.current) return
    const bounds = containerRef.current.getBoundingClientRect()
    onConfirm({
      ...rect,
      containerWidth: bounds.width,
      containerHeight: bounds.height,
    })
  }

  const HANDLE_SIZE = 16

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-md p-4 shadow-xl" style={{ backgroundColor: "oklch(0.958 0.012 85)" }}>
        <p className="text-center font-sans text-sm text-foreground">
          drag the box around your drink
        </p>

        {/* Image container */}
        <div
          ref={containerRef}
          className="relative mx-auto w-full overflow-hidden rounded-lg"
          style={{ maxHeight: "55vh", aspectRatio: "auto" }}
        >
          <img
            src={image}
            alt="Select foreground"
            className="h-full w-full object-contain"
            draggable={false}
          />

          {/* Dark overlay outside the selection box */}
          <div className="pointer-events-none absolute inset-0">
            {/* Top strip */}
            <div
              className="absolute left-0 right-0 top-0 bg-black/50"
              style={{ height: `${rect.y}%` }}
            />
            {/* Bottom strip */}
            <div
              className="absolute bottom-0 left-0 right-0 bg-black/50"
              style={{ top: `${rect.y + rect.height}%` }}
            />
            {/* Left strip */}
            <div
              className="absolute bg-black/50"
              style={{
                top: `${rect.y}%`,
                left: 0,
                width: `${rect.x}%`,
                height: `${rect.height}%`,
              }}
            />
            {/* Right strip */}
            <div
              className="absolute bg-black/50"
              style={{
                top: `${rect.y}%`,
                left: `${rect.x + rect.width}%`,
                right: 0,
                height: `${rect.height}%`,
              }}
            />
          </div>

          {/* Selection box border */}
          <div
            className="absolute border-2 border-white"
            style={{
              left: `${rect.x}%`,
              top: `${rect.y}%`,
              width: `${rect.width}%`,
              height: `${rect.height}%`,
            }}
          >
            {/* Move handle (interior) */}
            <div
              className="absolute inset-0 cursor-move"
              onMouseDown={(e) => startDrag("move", e)}
              onTouchStart={(e) => startDrag("move", e)}
            />

            {/* Corner handles */}
            {(["nw", "ne", "sw", "se"] as const).map((corner) => (
              <div
                key={corner}
                onMouseDown={(e) => startDrag(corner, e)}
                onTouchStart={(e) => startDrag(corner, e)}
                className="absolute rounded-sm bg-white"
                style={{
                  width: HANDLE_SIZE,
                  height: HANDLE_SIZE,
                  ...(corner === "nw" ? { top: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2, cursor: "nw-resize" } : {}),
                  ...(corner === "ne" ? { top: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2, cursor: "ne-resize" } : {}),
                  ...(corner === "sw" ? { bottom: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2, cursor: "sw-resize" } : {}),
                  ...(corner === "se" ? { bottom: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2, cursor: "se-resize" } : {}),
                  touchAction: "none",
                  zIndex: 10,
                }}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            size="lg"
            className="flex-1 rounded-full border-2 border-border font-sans text-sm text-foreground hover:brightness-95"
            style={{ backgroundColor: "oklch(0.958 0.012 85)" }}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            size="lg"
            className="flex-1 rounded-full bg-brown font-sans text-sm text-card hover:bg-brown/90"
            onClick={handleConfirm}
          >
            Confirm
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   Canvas Export Functions
   ============================================================ */

async function generateReceiptCanvas(
  canvas: HTMLCanvasElement | null,
  data: ReceiptData,
  stickerImg: HTMLImageElement | null,
  placedStickers: PlacedSticker[]
): Promise<string | null> {
  if (!canvas) return null

  const SCALE = 2       // render at 2× for sharpness
  const LW = 280        // logical width — matches w-[280px]
  const LP = 20         // logical side padding — matches px-5
  const SM = 0          // no side margin on receipt canvas

  canvas.width = (LW + SM * 2) * SCALE

  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  ctx.scale(SCALE, SCALE)

  // ── Pre-load font (all weights used in canvas draws) ─────────────────────
  try {
    await document.fonts.ready
    await Promise.all([
      document.fonts.load("300 12px 'IBM Plex Mono'"),
      document.fonts.load("400 12px 'IBM Plex Mono'"),
      document.fonts.load("500 12px 'IBM Plex Mono'"),
      document.fonts.load("500 14px 'IBM Plex Mono'"),
      document.fonts.load("400 18px 'IBM Plex Mono'"),
      document.fonts.load("500 24px 'IBM Plex Mono'"),
    ])
  } catch {}

  // ── Build customizations list (mirrors InteractiveCanvas logic) ───────────
  const toTitleCaseLocal = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : ""
  const customizations: string[] = []
  if (data.iceTemp) customizations.push(toTitleCaseLocal(data.iceTemp))
  if (data.iceLevel) customizations.push(`${toTitleCaseLocal(data.iceLevel)} Ice`)
  if (data.sugarLevel) customizations.push(`${toTitleCaseLocal(data.sugarLevel)} Sugar`)
  const milkDisplay = data.milk === "other" && data.otherMilk ? data.otherMilk : data.milk
  if (milkDisplay) customizations.push(`${toTitleCaseLocal(milkDisplay)} Milk`)
  if (data.toppings?.length > 0) customizations.push(...data.toppings.map(toTitleCaseLocal))
  if (data.otherCustomizations) customizations.push(toTitleCaseLocal(data.otherCustomizations))

  // ── Text wrapping helper ──────────────────────────────────────────────────
  const wrapText = (text: string, maxWidth: number): string[] => {
    const words = text.split(" ")
    const lines: string[] = []
    let line = ""
    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line)
        line = word
      } else {
        line = test
      }
    }
    if (line) lines.push(line)
    return lines
  }

  // ── Pass 1: Measure height ────────────────────────────────────────────────
  canvas.height = 10 * SCALE
  ctx.scale(SCALE, SCALE)

  let h = 24  // py-6 top padding

  // Rating circle
  const ratingDiam = 56  // size-14
  h += ratingDiam + 12   // circle + mb-3

  // Cafe name
  h += 12 + 12  // text-xs + mb-3

  // Drink name (wrapping, text-2xl = 24px, line height ~28px)
  ctx.font = "500 24px 'IBM Plex Mono', monospace"
  const drinkLines = wrapText(data.drinkName?.trim() || "Beverage", LW - LP * 2)
  h += drinkLines.length * 28 + 12  // lines + mb-3

  // Customizations
  if (customizations.length > 0) {
    ctx.font = "500 14px 'IBM Plex Mono', monospace"
    const custText = customizations.join(", ")
    const customizationLines = wrapText(custText, LW - LP * 2)
    h += customizationLines.length * 18 + 12  // lines + mb-3
  }

  // Drink sticker
  if (stickerImg) {
    const maxW = LW - LP * 2, maxH = 140
    const s = Math.min(maxW / stickerImg.width, maxH / stickerImg.height)
    h += stickerImg.height * s + 4  // sticker height + my-1 bottom
  }

  // Notes
  if (data.comments?.trim()) {
    ctx.font = "300 12px 'IBM Plex Mono', monospace"
    const noteLines = wrapText(`Notes: ${data.comments.trim()}`, LW - LP * 2)
    h += noteLines.length * 16 + 12  // lines + mb-3
  }

  // Location
  if (data.location?.trim()) {
    h += 12 + 4  // text-xs + small gap
  }

  // Date/time
  h += 12 + 12  // text-xs + mb-3

  // Divider
  h += 1 + 12  // border + mb-3

  // Footer
  h += 12  // text-xs

  // Bottom padding
  h += 24  // py-6 bottom

  // ── Pass 2: Draw ──────────────────────────────────────────────────────────
  canvas.width = (LW + SM * 2) * SCALE
  canvas.height = (h + SM * 2) * SCALE
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.scale(SCALE, SCALE)

  // Background
  ctx.fillStyle = "#FEFCF4"
  roundRect(ctx, SM, SM, LW, h, RECEIPT_RADIUS)
  ctx.fill()

  const cx = SM + LW / 2
  let y = SM + 24  // py-6

  ctx.fillStyle = TEXT_COLOR
  ctx.textBaseline = "top"

  // Rebuild computed values for pass 2
  ctx.font = "500 24px 'IBM Plex Mono', monospace"
  const drinkLines2 = wrapText(data.drinkName?.trim() || "Beverage", LW - LP * 2)

  let customizationLines2: string[] = []
  if (customizations.length > 0) {
    ctx.font = "500 14px 'IBM Plex Mono', monospace"
    customizationLines2 = wrapText(customizations.join(", "), LW - LP * 2)
  }

  let noteLines2: string[] = []
  if (data.comments?.trim()) {
    ctx.font = "300 12px 'IBM Plex Mono', monospace"
    noteLines2 = wrapText(`Notes: ${data.comments.trim()}`, LW - LP * 2)
  }

  // ── Rating circle ─────────────────────────────────────────────────────────
  const ratingR = 28  // radius = size-14 / 2
  ctx.strokeStyle = TEXT_COLOR
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(cx, y + ratingR, ratingR, 0, Math.PI * 2)
  ctx.stroke()
  ctx.font = "400 18px 'IBM Plex Mono', monospace"
  ctx.textAlign = "center"
  ctx.textBaseline = "alphabetic"
  const ratingText = data.rating || "10.0"
  const rMetrics = ctx.measureText(ratingText)
  const rTextY = y + ratingR + (rMetrics.actualBoundingBoxAscent - rMetrics.actualBoundingBoxDescent) / 2
  ctx.fillText(ratingText, cx, rTextY)
  ctx.textBaseline = "top"
  y += ratingDiam + 12  // circle height + mb-3

  // ── Cafe name (text-xs, font-medium, mb-3) ────────────────────────────────
  ctx.font = "500 12px 'IBM Plex Mono', monospace"
  ctx.fillStyle = TEXT_COLOR
  ctx.textAlign = "center"
  ctx.fillText((data.cafeName?.trim()) || "cafe", cx, y)
  y += 12 + 12  // font size + mb-3

  // ── Drink name (text-2xl, font-medium, mb-3) ───────────────────────────────
  ctx.font = "500 24px 'IBM Plex Mono', monospace"
  for (const l of drinkLines2) { ctx.fillText(l, cx, y); y += 28 }
  y += 12  // mb-3

  // ── Customizations (text-sm, font-medium, mb-3) ───────────────────────────
  if (customizations.length > 0) {
    ctx.font = "500 14px 'IBM Plex Mono', monospace"
    ctx.textAlign = "center"
    for (const l of customizationLines2) { ctx.fillText(l, cx, y); y += 18 }
    y += 12  // mb-3
  }

  // ── Drink sticker (my-1) ──────────────────────────────────────────────────
  if (stickerImg) {
    const maxW = LW - LP * 2, maxH = 140
    const s = Math.min(maxW / stickerImg.width, maxH / stickerImg.height)
    const sw = stickerImg.width * s, sh = stickerImg.height * s
    ctx.drawImage(stickerImg, SM + (LW - sw) / 2, y, sw, sh)
    y += sh + 4  // sticker + my-1 bottom
  }

  // ── Notes (text-xs, font-light, mb-3, left-aligned) ──────────────────────
  if (data.comments?.trim()) {
    ctx.font = "300 12px 'IBM Plex Mono', monospace"
    ctx.textAlign = "left"
    for (const l of noteLines2) { ctx.fillText(l, SM + LP, y); y += 16 }
    y += 12  // mb-3
  }

  // ── Location (text-xs, font-light, no bottom margin) ─────────────────────
  if (data.location?.trim()) {
    ctx.font = "300 12px 'IBM Plex Mono', monospace"
    ctx.textAlign = "left"
    ctx.fillText(data.location.trim(), SM + LP, y)
    y += 12 + 4  // font + small gap before date
  }

  // ── Date/Time (text-xs, font-light, mb-3) ─────────────────────────────────
  const dateStr = data.date ? data.date.replace(/-/g, "") : "YYYYMMDD"
  const timeStr = data.time ? (() => {
    const [hours, minutes] = data.time.split(":")
    const hh = parseInt(hours, 10)
    const ampm = hh >= 12 ? "PM" : "AM"
    const h12 = hh % 12 || 12
    return `${h12}:${minutes} ${ampm}`
  })() : "12:00 AM"
  ctx.font = "300 12px 'IBM Plex Mono', monospace"
  ctx.textAlign = "left"
  ctx.fillText(`${dateStr} ${timeStr}`, SM + LP, y)
  y += 12 + 12  // font + mb-3

  // ── Divider (mb-3) ────────────────────────────────────────────────────────
  ctx.strokeStyle = TEXT_COLOR
  ctx.globalAlpha = 0.2
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(SM + LP, y)
  ctx.lineTo(SM + LW - LP, y)
  ctx.stroke()
  ctx.globalAlpha = 1
  y += 1 + 12  // line + mb-3

  // ── Footer ────────────────────────────────────────────────────────────────
  ctx.fillStyle = TEXT_COLOR
  ctx.textAlign = "center"
  ctx.font = "400 12px 'IBM Plex Mono', monospace"
  const normW = ctx.measureText("Ranked with ").width
  ctx.font = "500 12px 'IBM Plex Mono', monospace"
  const boldW = ctx.measureText("drank").width
  const totalFW = normW + boldW
  ctx.font = "400 12px 'IBM Plex Mono', monospace"
  ctx.fillText("Ranked with ", cx - totalFW / 2 + normW / 2, y)
  ctx.font = "500 12px 'IBM Plex Mono', monospace"
  ctx.fillText("drank", cx - totalFW / 2 + normW + boldW / 2, y)

  // ── Placed stickers ───────────────────────────────────────────────────────
  // Sticker x/y percentages are relative to the receipt card area (LW × h),
  // offset by SM on both axes to align with the shifted card.
  ctx.textBaseline = "middle"
  for (const sticker of placedStickers) {
    const sx = SM + (sticker.x / 100) * LW
    const sy = SM + (sticker.y / 100) * h
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

  // ── Receipt capture — composite centered at 70% of story width, 90% opacity ─
  const exportReceiptW = Math.round(W * 0.70)
  const exportReceiptH = Math.round(receiptCapture.height / receiptCapture.width * exportReceiptW)
  const rX = Math.round((W - exportReceiptW) / 2)
  const rY = Math.round((H - exportReceiptH) / 2)
  ctx.globalAlpha = 0.9
  ctx.drawImage(receiptCapture, rX, rY, exportReceiptW, exportReceiptH)
  ctx.globalAlpha = 1

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