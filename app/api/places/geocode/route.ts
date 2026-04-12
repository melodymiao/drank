import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const latlng = searchParams.get("latlng")

  console.log("[geocode] called with latlng:", latlng)

  if (!latlng) {
    console.log("[geocode] missing latlng param")
    return NextResponse.json({ error: "Missing latlng" }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    console.error("[geocode] GOOGLE_MAPS_API_KEY is not set")
    return NextResponse.json({ error: "Missing API key" }, { status: 500 })
  }

  try {
    // ── 1. Reverse geocode → city name ──────────────────────────────────────
    const geocodeUrl = new URL("https://maps.googleapis.com/maps/api/geocode/json")
    geocodeUrl.searchParams.set("latlng", latlng)
    geocodeUrl.searchParams.set("key", apiKey)

    console.log("[geocode] fetching geocode URL:", geocodeUrl.toString().replace(apiKey, "REDACTED"))
    const geocodeRes = await fetch(geocodeUrl.toString())
    const geocodeJson = await geocodeRes.json()
    console.log("[geocode] geocode status:", geocodeJson.status, "results count:", geocodeJson.results?.length)

    const city =
      geocodeJson.results
        ?.flatMap((r: { address_components: { types: string[]; long_name: string }[] }) => r.address_components)
        ?.find((c: { types: string[]; long_name: string }) => c.types.includes("locality"))
        ?.long_name ?? null

    console.log("[geocode] extracted city:", city)

    // ── 2. Places Nearby → business name within 50m ─────────────────────────
    const [lat, lng] = latlng.split(",")
    const nearbyUrl = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json")
    nearbyUrl.searchParams.set("location", latlng)
    nearbyUrl.searchParams.set("rankby", "distance")
    nearbyUrl.searchParams.set("type", "cafe")
    nearbyUrl.searchParams.set("key", apiKey)

    console.log("[geocode] fetching nearby URL:", nearbyUrl.toString().replace(apiKey, "REDACTED"))
    const nearbyRes = await fetch(nearbyUrl.toString())
    const nearbyJson = await nearbyRes.json()
    console.log("[geocode] nearby status:", nearbyJson.status, "results count:", nearbyJson.results?.length)
    console.log("[geocode] nearby top 3:", nearbyJson.results?.slice(0, 3).map((r: { name: string; geometry: { location: { lat: number; lng: number } } }) => ({
      name: r.name,
      lat: r.geometry?.location?.lat,
      lng: r.geometry?.location?.lng,
    })))

    const nearest = nearbyJson.results?.[0]
    let businessName: string | null = null

    if (nearest) {
      const placeLat: number = nearest.geometry?.location?.lat
      const placeLng: number = nearest.geometry?.location?.lng
      if (placeLat != null && placeLng != null) {
        const dLat = ((placeLat - parseFloat(lat)) * Math.PI) / 180
        const dLng = ((placeLng - parseFloat(lng)) * Math.PI) / 180
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((parseFloat(lat) * Math.PI) / 180) *
            Math.cos((placeLat * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2
        const distanceMetres = 2 * 6371000 * Math.asin(Math.sqrt(a))

        console.log("[geocode] nearest place:", nearest.name, "distance:", Math.round(distanceMetres), "m")

        if (distanceMetres <= 50) {
          businessName = nearest.name ?? null
          console.log("[geocode] using business name:", businessName)
        } else {
          console.log("[geocode] nearest place too far (>50m), not using business name")
        }
      }
    } else {
      console.log("[geocode] no nearby results")
    }

    console.log("[geocode] returning:", { city, businessName })
    return NextResponse.json({ city, businessName })
  } catch (err) {
    console.error("[geocode] error:", err)
    return NextResponse.json({ city: null, businessName: null }, { status: 500 })
  }
}