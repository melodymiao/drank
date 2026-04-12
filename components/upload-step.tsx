"use client"

import { useCallback, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Camera, Upload, X } from "lucide-react"
import { ERRORS, pickError } from "@/lib/errors"

interface UploadStepProps {
  image: string | null
  onImageUpload: (image: string, exifDate?: string, exifLocation?: string, exifCafe?: string) => void
  onNext: () => void
  onSkip: () => void
}

/**
 * Extract date and GPS location from any image file using exifr.
 * Works with JPEG and HEIC/HEIF on the raw bytes before any conversion.
 */
async function extractExifData(file: File): Promise<{ date?: string; location?: string; cafe?: string }> {
  try {
    const exifr = (await import("exifr")).default
    const exif = await exifr.parse(file, {
      pick: ["DateTimeOriginal", "GPSLatitude", "GPSLongitude", "GPSLatitudeRef", "GPSLongitudeRef"],
    })

    console.log("exifr raw result:", exif)

    if (!exif) return {}

    // Extract date
    let date: string | undefined
    if (exif.DateTimeOriginal instanceof Date) {
      const d = exif.DateTimeOriginal
      const y = d.getFullYear()
      const mo = String(d.getMonth() + 1).padStart(2, "0")
      const day = String(d.getDate()).padStart(2, "0")
      const h = String(d.getHours()).padStart(2, "0")
      const min = String(d.getMinutes()).padStart(2, "0")
      date = `${y}-${mo}-${day}T${h}:${min}`
    }

    // Extract GPS and reverse-geocode to city + nearby business name
    let location: string | undefined
    let cafe: string | undefined
    if (exif.GPSLatitude != null && exif.GPSLongitude != null) {
      try {
        // Convert DMS array [degrees, minutes, seconds] to signed decimal
        const [latD, latM, latS] = exif.GPSLatitude as number[]
        const [lngD, lngM, lngS] = exif.GPSLongitude as number[]
        const lat = (latD + latM / 60 + latS / 3600) * (exif.GPSLatitudeRef === "S" ? -1 : 1)
        const lng = (lngD + lngM / 60 + lngS / 3600) * (exif.GPSLongitudeRef === "W" ? -1 : 1)

        console.log("computed coords:", { lat, lng })

        const params = new URLSearchParams({ latlng: `${lat},${lng}` })
        const res = await fetch(`/api/geocode?${params}`)
        const json = await res.json()

        console.log("geocode response:", json)

        if (json.city) location = json.city
        if (json.businessName) cafe = json.businessName
      } catch (err) {
        console.error("GPS geocode failed:", err)
      }
    }

    console.log("extractExifData returning:", { date, location, cafe })
    return { date, location, cafe }
  } catch (err) {
    console.error("extractExifData error:", err)
    return {}
  }
}

/**
 * Convert a HEIC/HEIF file to a JPEG data URL using heic2any.
 * Dynamically imported so it doesn't bloat the initial bundle.
 */
async function convertHeicToJpeg(file: File): Promise<string> {
  const heic2any = (await import("heic2any")).default
  const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 })
  const jpegBlob = Array.isArray(blob) ? blob[0] : blob
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error("FileReader failed on converted HEIC"))
    reader.readAsDataURL(jpegBlob)
  })
}

/** Returns true if the file is a HEIC/HEIF image */
function isHeicFile(file: File): boolean {
  return (
    file.type.toLowerCase() === "image/heic" ||
    file.type.toLowerCase() === "image/heif" ||
    /\.(heic|heif)$/i.test(file.name)
  )
}

/** Format a Date as YYYY-MM-DD using local time (not UTC) */
function localDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function UploadStep({ image, onImageUpload, onNext, onSkip }: UploadStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isConverting, setIsConverting] = useState(false)

  const MAX_FILE_SIZE_MB = 20

  const processFile = useCallback(
    async (file: File) => {
      setUploadError(null)

      // File type check — allow common image types + HEIC/HEIF
      const allowed = [
        "image/jpeg", "image/png", "image/webp", "image/gif",
        "image/heic", "image/heif",
      ]
      const isAllowedType = allowed.includes(file.type.toLowerCase()) ||
        /\.(heic|heif)$/i.test(file.name)
      if (!isAllowedType) {
        setUploadError(pickError(ERRORS.fileType))
        return
      }

      // File size check
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setUploadError(pickError(ERRORS.fileSize))
        return
      }

      try {
        // Extract EXIF from raw file bytes BEFORE any conversion
        const { date: exifDate, location: exifLocation, cafe: exifCafe } = await extractExifData(file)
        console.log("processFile got exif:", { exifDate, exifLocation, exifCafe })

        let dataUrl: string

        if (isHeicFile(file)) {
          setIsConverting(true)
          try {
            dataUrl = await convertHeicToJpeg(file)
          } finally {
            setIsConverting(false)
          }
        } else {
          dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.onerror = () => reject(new Error("FileReader failed"))
            reader.readAsDataURL(file)
          })
        }

        onImageUpload(dataUrl, exifDate, exifLocation, exifCafe)
      } catch {
        setIsConverting(false)
        setUploadError(pickError(ERRORS.uploadFailed))
      }
    },
    [onImageUpload]
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) processFile(file)
    },
    [processFile]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files?.[0]
      if (file) processFile(file)
    },
    [processFile]
  )

  const handleRemoveImage = useCallback(() => {
    onImageUpload("")
    setUploadError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
    if (cameraInputRef.current) cameraInputRef.current.value = ""
  }, [onImageUpload])

  // suppress unused warning — localDateString kept for future use
  void localDateString

  return (
    <div className="flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-4">
      <p className="shrink-0 mb-3 text-center text-sm text-muted-foreground">
        upload a photo to get started
      </p>

      {!image ? (
        <>
          {/* Squiggly border container — shrinks to fit available height on short viewports */}
          <div
            className="relative min-h-0 w-full max-w-[359px] max-h-[522px] flex-1"
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            {/* Inline squiggly SVG border — matches decorate step exactly */}
            <div className="absolute inset-0 pointer-events-none">
              <svg
                viewBox="0 0 359 522"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="pointer-events-none h-full w-full"
              >
                <path
                  d="M5.96748 32.9781C5.95608 42.1204 5.73755 70.7878 5.7661 101.173C5.77559 111.275 3.69791 131.095 5.54229 152.072C6.46891 162.61 9.12923 168.948 9.13488 199.274C9.13788 215.346 7.34902 233.861 8.49242 249.847C9.21612 259.965 8.76806 270.007 8.06387 280.923C7.18042 294.618 9.05917 310.492 11.0821 326.559C15.2014 359.275 10.7358 369.518 9.64203 376.352C8.49639 383.51 8.77003 400.764 9.15834 412.022C9.37227 418.224 11.7736 424.181 14.6133 433.019C16.9656 440.339 16.7185 449.266 17.4192 501.866C17.5514 511.789 18.4694 510.552 19.5636 509.915C25.2935 506.577 33.6387 510.437 40.9995 512.637C51.4711 515.767 63.6581 515.569 75.0355 515.995C82.3874 516.27 89.4128 519.687 94.4326 519.988C99.4488 520.288 103.762 515.048 109.025 513.338C114.074 511.697 119.562 508.594 127.347 510.145C133.64 511.399 139.727 511.456 145.424 512.662C154.827 514.653 168.315 514.095 177.375 513.518C184.76 513.048 191.902 509.906 213.679 508.79C228.501 508.03 237.648 509.08 241.874 512.811C248.081 518.291 255.789 512.616 261.908 511.526C269.243 510.218 279.181 510.994 294.438 511.273C302.089 511.413 307.582 511.77 312.854 512.413C324.464 513.829 341.654 512.703 344.183 511.178C345.426 510.428 346.574 509.699 346.739 508.028C347.165 503.715 344.644 497.568 344.176 491.601C343.628 484.61 350.519 478.37 353.387 465.279C359.02 439.567 356.36 423.159 356.452 403.102C356.498 393.158 352.523 373.768 350.528 361.389C349.273 353.6 349.342 340.553 349.985 326.875C351.463 295.434 351.946 287.699 351.501 268.772C351.29 259.752 351.277 252.944 351.951 245.574C353.162 232.312 348.627 226.265 347.34 212.039C343.83 173.266 346.012 167.201 347.619 161.254C349.349 154.855 346.977 149.117 345.858 143.343C344.647 137.09 344.331 130.28 343.336 124.113C342.093 116.399 344.265 110.018 345.254 104.031C346.612 95.8097 345.254 83.9833 344.786 76.5974C344.195 67.255 343.762 56.6641 342.484 50.14C341.203 43.5967 340.718 33.619 340.041 24.2919C339.521 17.1379 339.43 11.3536 338.102 9.11157C335.311 4.39764 317.196 6.89516 304.559 8.7068C287.644 11.1319 281.368 8.40142 275.595 7.15735C269.789 5.90601 265.13 3.18534 254.357 2.56724C220.376 0.617687 214.273 4.27899 208.268 4.77712C202.943 5.21878 196.708 6.88322 189.381 7.61991C185.418 8.01845 181.982 8.1129 179.303 8.3679C176.627 8.62267 153.642 8.76012 119.861 8.8068C93.5059 8.84321 70.6441 9.79826 64.4299 10.5245C54.3227 11.7056 42.7259 11.583 35.0346 12.3277C21.9552 12.6858 16.1885 13.7051 7.56054 14.7525C5.79666 15.3788 4.95975 16.5638 2.00049 18.137"
                  stroke="#9BCFEC"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            {/* Content inside the border — fills container height, no fixed aspect ratio */}
            <div className={`relative flex h-full w-full flex-col items-center justify-center gap-4 transition-all duration-300 ${isDragging ? "scale-[0.98]" : ""
              }`}>
              {isConverting ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
                  <p className="font-mono text-xs text-muted-foreground">converting photo…</p>
                </div>
              ) : (
                <div className="flex w-[200px] flex-col gap-3">
                  <Button
                    variant="default"
                    size="lg"
                    className="w-full gap-2 rounded-full bg-brown px-6 font-sans text-sm text-card hover:bg-brown/90"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="size-4" />
                    Choose Photo
                  </Button>

                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full gap-2 rounded-full border-2 border-border bg-card px-6 font-sans text-sm text-foreground hover:text-muted-foreground"
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    <Camera className="size-4" />
                    Take Photo
                  </Button>
                </div>
              )}

              <p className="text-xs text-muted-foreground">or drag & drop</p>
            </div>
          </div>

          {/* Skip link — shrink-0 so it is always visible below the SVG container */}
          <button
            onClick={onSkip}
            className="shrink-0 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
            ... or skip and <span className="underline">rank without photo</span>
          </button>

          {uploadError && (
            <p className="shrink-0 font-mono text-xs text-destructive">
              {uploadError}
            </p>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-6 w-full">
          <div className="relative w-full max-w-[280px]">
            <div className="aspect-[3/4] overflow-hidden rounded-2xl border border-border shadow-lg">
              <img
                src={image}
                alt="Your uploaded drink"
                className="size-full object-cover"
              />
            </div>
            <button
              onClick={handleRemoveImage}
              className="absolute -right-2 -top-2 flex size-8 items-center justify-center rounded-full bg-foreground text-background shadow-md transition-transform hover:scale-110"
              aria-label="Remove image"
            >
              <X className="size-4" />
            </button>
          </div>

          <Button
            size="lg"
            className="w-full max-w-[200px] bg-brown px-8 font-sans text-sm text-white hover:bg-brown/90"
            style={{ paddingTop: 24, paddingBottom: 24 }}
            onClick={onNext}
          >
            Rank Your Drink
          </Button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={handleFileChange}
        aria-label="Upload photo from device"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
        aria-label="Take photo with camera"
      />
    </div>
  )
}