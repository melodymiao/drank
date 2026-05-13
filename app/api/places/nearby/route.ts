import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const latlng = searchParams.get("latlng")

  if (!latlng) {
    return NextResponse.json({ error: "Missing latlng" }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 })
  }

  try {
    const [latStr, lngStr] = latlng.split(",")
    const lat = parseFloat(latStr)
    const lng = parseFloat(lngStr)

    // Search for cafes, restaurants, and bakeries nearby
    const types = ["cafe", "restaurant", "bakery"]
    const allResults: { name: string; distance: number }[] = []

    await Promise.all(
      types.map(async (type) => {
        const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json")
        url.searchParams.set("location", latlng)
        url.searchParams.set("rankby", "distance")
        url.searchParams.set("type", type)
        url.searchParams.set("key", apiKey)

        const res = await fetch(url.toString())
        const json = await res.json()

        for (const place of json.results?.slice(0, 5) ?? []) {
          const placeLat: number = place.geometry?.location?.lat
          const placeLng: number = place.geometry?.location?.lng
          if (placeLat == null || placeLng == null || !place.name) continue

          const dLat = ((placeLat - lat) * Math.PI) / 180
          const dLng = ((placeLng - lng) * Math.PI) / 180
          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos((lat * Math.PI) / 180) *
              Math.cos((placeLat * Math.PI) / 180) *
              Math.sin(dLng / 2) ** 2
          const distance = 2 * 6371000 * Math.asin(Math.sqrt(a))

          if (distance <= 200) {
            allResults.push({ name: place.name, distance })
          }
        }
      })
    )

    // Deduplicate by name, sort by distance, return top 5
    const seen = new Set<string>()
    const names = allResults
      .sort((a, b) => a.distance - b.distance)
      .filter(({ name }) => {
        if (seen.has(name)) return false
        seen.add(name)
        return true
      })
      .slice(0, 5)
      .map(({ name }) => name)

    return NextResponse.json({ names })
  } catch (err) {
    console.error("[nearby] error:", err)
    return NextResponse.json({ names: [] }, { status: 500 })
  }
}